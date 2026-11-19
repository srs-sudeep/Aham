"""Stripe PaymentProvider: Checkout Session + webhook → local entitlement sync callbacks."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID

from platform_kit.errors import BadRequestError
from platform_kit.logging import get_logger

log = get_logger("platform_kit.stripe")

# Callbacks the billing service wires in.
ActivateFn = Callable[[UUID, str], Awaitable[None]]  # tenant_id, plan_code
CancelFn = Callable[[UUID], Awaitable[None]]
PastDueFn = Callable[[UUID], Awaitable[None]]


class StripePaymentProvider:
    def __init__(
        self,
        *,
        api_key: str,
        webhook_secret: str,
        success_url: str,
        cancel_url: str,
        price_by_plan: dict[str, str],
        on_activate: ActivateFn | None = None,
        on_cancel: CancelFn | None = None,
        on_past_due: PastDueFn | None = None,
    ) -> None:
        self.api_key = api_key
        self.webhook_secret = webhook_secret
        self.success_url = success_url
        self.cancel_url = cancel_url
        self.price_by_plan = price_by_plan
        self.on_activate = on_activate
        self.on_cancel = on_cancel
        self.on_past_due = on_past_due

    def _stripe(self) -> Any:
        import stripe

        stripe.api_key = self.api_key
        return stripe

    async def create_checkout(self, tenant_id: UUID, plan_code: str) -> str:
        price = self.price_by_plan.get(plan_code)
        if not price:
            raise BadRequestError(detail=f"no Stripe price mapped for plan {plan_code}")
        stripe = self._stripe()
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price, "quantity": 1}],
            success_url=self.success_url,
            cancel_url=self.cancel_url,
            client_reference_id=str(tenant_id),
            metadata={"tenant_id": str(tenant_id), "plan_code": plan_code},
        )
        return str(session.url)

    async def handle_webhook(self, headers: dict[str, str], body: bytes) -> None:
        stripe = self._stripe()
        sig = headers.get("stripe-signature") or headers.get("Stripe-Signature")
        if not sig:
            raise BadRequestError(detail="missing Stripe-Signature")
        try:
            event = stripe.Webhook.construct_event(body, sig, self.webhook_secret)
        except Exception as exc:  # noqa: BLE001 - stripe raises assorted types
            raise BadRequestError(detail=f"invalid stripe webhook: {exc}") from exc

        etype = event["type"]
        data = event["data"]["object"]
        log.info("stripe_webhook", type=etype)

        if etype == "checkout.session.completed":
            tenant = data.get("client_reference_id") or (data.get("metadata") or {}).get("tenant_id")
            plan = (data.get("metadata") or {}).get("plan_code", "pro")
            if tenant and self.on_activate:
                await self.on_activate(UUID(tenant), plan)
        elif etype in ("customer.subscription.deleted", "customer.subscription.canceled"):
            tenant = (data.get("metadata") or {}).get("tenant_id")
            if tenant and self.on_cancel:
                await self.on_cancel(UUID(tenant))
        elif etype == "invoice.payment_failed":
            tenant = (data.get("metadata") or {}).get("tenant_id")
            if tenant and self.on_past_due:
                await self.on_past_due(UUID(tenant))
