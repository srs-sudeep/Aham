"""Billing HTTP endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import Request
from fastapi.responses import PlainTextResponse

from core_api.modules.billing.dependencies import BillingServiceDep
from core_api.modules.billing.schemas import (
    ActivateSubscriptionRequest,
    CheckoutRequest,
    CheckoutResponse,
    OverrideRequest,
    PlanOut,
    SubscriptionOut,
)
from core_api.permissions import Resource
from platform_kit import PUBLIC, Action, Permission, SecureRouter
from platform_kit.security import CurrentPrincipal

router = SecureRouter(prefix="/billing", tags=["billing"])


@router.get("/plans", permission=Permission(Resource.BILLING_PLAN, Action.LIST), summary="List plans")
async def list_plans(svc: BillingServiceDep) -> list[PlanOut]:
    return await svc.list_plans()


@router.get(
    "/subscription",
    permission=Permission(Resource.BILLING_SUBSCRIPTION, Action.READ),
    summary="Current tenant subscription",
)
async def get_subscription(svc: BillingServiceDep, principal: CurrentPrincipal) -> SubscriptionOut:
    return await svc.get_subscription(UUID(principal.tid))


@router.post(
    "/subscription/activate",
    permission=Permission(Resource.BILLING_SUBSCRIPTION, Action.UPDATE),
    summary="Activate or change plan (ManualProvider)",
)
async def activate(body: ActivateSubscriptionRequest, svc: BillingServiceDep) -> SubscriptionOut:
    return await svc.activate(body.tenant_id, body.plan_code, grace_days=body.grace_days)


@router.post(
    "/subscription/past-due",
    permission=Permission(Resource.BILLING_SUBSCRIPTION, Action.UPDATE),
    summary="Mark subscription past_due with grace",
)
async def past_due(body: ActivateSubscriptionRequest, svc: BillingServiceDep) -> SubscriptionOut:
    return await svc.mark_past_due(body.tenant_id, grace_days=body.grace_days)


@router.post(
    "/subscription/cancel",
    permission=Permission(Resource.BILLING_SUBSCRIPTION, Action.DELETE),
    summary="Cancel subscription",
)
async def cancel(body: ActivateSubscriptionRequest, svc: BillingServiceDep) -> SubscriptionOut:
    return await svc.cancel(body.tenant_id)


@router.post(
    "/overrides",
    permission=Permission(Resource.BILLING_SUBSCRIPTION, Action.UPDATE),
    summary="Sales/support entitlement override",
    status_code=201,
)
async def override(body: OverrideRequest, svc: BillingServiceDep) -> SubscriptionOut:
    return await svc.set_override(body)


@router.post(
    "/checkout",
    permission=Permission(Resource.BILLING_SUBSCRIPTION, Action.CREATE),
    summary="Create checkout session (optional Stripe — requires platform-kit[stripe] + STRIPE_*)",
)
async def checkout(body: CheckoutRequest, svc: BillingServiceDep) -> CheckoutResponse:
    url = await svc.create_checkout(body.tenant_id, body.plan_code)
    return CheckoutResponse(checkout_url=url)


@router.post(
    "/webhooks/stripe",
    permission=PUBLIC,
    summary="Stripe webhook (no-op unless Stripe is configured)",
)
async def stripe_webhook(request: Request, svc: BillingServiceDep) -> PlainTextResponse:
    body = await request.body()
    await svc.handle_stripe_webhook(dict(request.headers), body)
    return PlainTextResponse("ok")
