from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from core_api.modules.billing.repository import BillingRepository
from core_api.modules.billing.service import BillingService
from platform_kit.db import SessionDep
from platform_kit.errors import BadRequestError
from platform_kit.providers import ManualPaymentProvider
from platform_kit.redis import RedisClient


def get_billing_service(session: SessionDep, request: Request) -> BillingService:
    redis: RedisClient = request.app.state.redis
    if redis is None:
        raise RuntimeError("SaaS billing requires Redis (PLATFORM_PROFILE=saas, REDIS_URL)")
    settings = request.app.state.settings
    repo = BillingRepository(session)
    svc = BillingService(repo, redis, payment=ManualPaymentProvider())

    api_key = settings.stripe_api_key.get_secret_value() if settings.stripe_api_key else None
    wh_secret = settings.stripe_webhook_secret.get_secret_value() if settings.stripe_webhook_secret else None
    if api_key and wh_secret:
        try:
            from platform_kit.stripe_billing import StripePaymentProvider
        except ImportError as exc:
            raise BadRequestError(
                detail="STRIPE_* is set but the stripe package is missing — "
                "install with: uv sync --extra stripe / platform-kit[stripe]"
            ) from exc

        async def _activate(tenant_id, plan_code):  # noqa: ANN001
            await svc.activate(tenant_id, plan_code)

        async def _cancel(tenant_id):  # noqa: ANN001
            await svc.cancel(tenant_id)

        async def _past_due(tenant_id):  # noqa: ANN001
            await svc.mark_past_due(tenant_id)

        svc.payment = StripePaymentProvider(
            api_key=api_key,
            webhook_secret=wh_secret,
            success_url=settings.stripe_success_url,
            cancel_url=settings.stripe_cancel_url,
            price_by_plan=settings.stripe_price_by_plan,
            on_activate=_activate,
            on_cancel=_cancel,
            on_past_due=_past_due,
        )

    request.app.state.entitlements = svc.store
    return svc


BillingServiceDep = Annotated[BillingService, Depends(get_billing_service)]
