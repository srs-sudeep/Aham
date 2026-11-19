from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from core_api.modules.billing.repository import BillingRepository
from core_api.modules.billing.service import BillingService
from platform_kit.db import SessionDep
from platform_kit.providers import ManualPaymentProvider
from platform_kit.redis import RedisClient


def get_billing_service(session: SessionDep, request: Request) -> BillingService:
    redis: RedisClient = request.app.state.redis
    if redis is None:
        raise RuntimeError("SaaS billing requires Redis (PLATFORM_PROFILE=saas, REDIS_URL)")
    svc = BillingService(BillingRepository(session), redis, payment=ManualPaymentProvider())
    request.app.state.entitlements = svc.store
    return svc


BillingServiceDep = Annotated[BillingService, Depends(get_billing_service)]
