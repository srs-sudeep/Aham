from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PlanOut(BaseModel):
    code: str
    name: str
    interval: str
    features: dict[str, bool | int] = Field(default_factory=dict)


class ActivateSubscriptionRequest(BaseModel):
    """Operator action: target any tenant."""

    tenant_id: UUID
    plan_code: str
    grace_days: int = 3


class OverrideRequest(BaseModel):
    """Operator action: sales/support override for any tenant."""

    tenant_id: UUID
    feature_key: str
    enabled: bool | None = None
    quota_limit: int | None = None
    reason: str | None = None


class SubscriptionOut(BaseModel):
    tenant_id: UUID
    plan_code: str
    status: str
    period_end: datetime
    grace_until: datetime | None
    features: dict[str, bool]
    quotas: dict[str, int]


class CheckoutRequest(BaseModel):
    """Self-service: always for the caller's own tenant (token `tid`)."""

    plan_code: str


class CheckoutResponse(BaseModel):
    checkout_url: str
