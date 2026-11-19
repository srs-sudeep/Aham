"""Entitlement gates: features (boolean) and quotas (atomic Redis counters).

Billing answers "what did they buy"; this module answers "what may they do now"
from a local snapshot/cache — never call a payment provider on the hot path.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Annotated, Any, Protocol

from fastapi import Depends, Request
from pydantic import BaseModel, Field

from platform_kit.errors import ForbiddenError, PaymentRequiredError
from platform_kit.redis import RedisClient
from platform_kit.security import CurrentPrincipal
from platform_kit.tenancy import require_tenant


class EntitlementSnapshot(BaseModel):
    tenant_id: str
    features: dict[str, bool] = Field(default_factory=dict)
    quotas: dict[str, int] = Field(default_factory=dict)  # feature -> limit (-1 = unlimited)
    status: str = "active"  # active | trialing | past_due | canceled
    grace_until: datetime | None = None

    def is_commercially_active(self, *, now: datetime | None = None) -> bool:
        now = now or datetime.now(UTC)
        if self.status in ("active", "trialing"):
            return True
        return self.status == "past_due" and self.grace_until is not None and self.grace_until > now

    def has_feature(self, key: str) -> bool:
        return bool(self.features.get(key))

    def quota_limit(self, key: str) -> int | None:
        if key not in self.quotas:
            return None
        return self.quotas[key]


class EntitlementStore(Protocol):
    async def get_snapshot(self, tenant_id: str) -> EntitlementSnapshot | None: ...


class RedisEntitlementStore:
    """Hot-path reader. Identity/billing services write snapshots into Redis."""

    NAMESPACE = "entitlements"

    def __init__(
        self, redis: RedisClient, loader: Callable[[str], Awaitable[EntitlementSnapshot | None]] | None = None
    ) -> None:
        self.redis = redis
        self.loader = loader

    async def get_snapshot(self, tenant_id: str) -> EntitlementSnapshot | None:
        from platform_kit.cache import Cache

        cache = Cache(self.redis, prefix="saas")
        snap = await cache.get_model(self.NAMESPACE, tenant_id, EntitlementSnapshot)
        if snap is not None:
            return snap
        if self.loader is None:
            return None
        snap = await self.loader(tenant_id)
        if snap is not None:
            await cache.set_model(self.NAMESPACE, tenant_id, snap, ttl=60)
        return snap

    async def put_snapshot(self, snap: EntitlementSnapshot, *, ttl: int = 300) -> None:
        from platform_kit.cache import Cache

        await Cache(self.redis, prefix="saas").set_model(self.NAMESPACE, snap.tenant_id, snap, ttl=ttl)

    async def invalidate(self, tenant_id: str) -> None:
        from platform_kit.cache import Cache

        await Cache(self.redis, prefix="saas").delete(self.NAMESPACE, tenant_id)


async def _load_snapshot(request: Request, tenant_id: str) -> EntitlementSnapshot:
    store: EntitlementStore | None = getattr(request.app.state, "entitlements", None)
    if store is None:
        raise ForbiddenError(detail="entitlement store is not configured")
    snap = await store.get_snapshot(tenant_id)
    if snap is None:
        raise PaymentRequiredError(detail=f"no entitlements for tenant {tenant_id}")
    if not snap.is_commercially_active():
        raise PaymentRequiredError(
            "Your subscription is inactive. Please update billing.",
            detail=f"subscription status={snap.status}",
        )
    return snap


def require_feature(feature: str) -> Callable[..., Any]:
    async def _dep(request: Request, principal: CurrentPrincipal) -> EntitlementSnapshot:
        tid = str(require_tenant(principal))
        snap = await _load_snapshot(request, tid)
        if not snap.has_feature(feature):
            raise ForbiddenError(
                f"Feature '{feature}' is not included in your plan.",
                detail=f"missing feature {feature} for tenant {tid}",
            )
        return snap

    return _dep


def require_quota(feature: str, *, amount: int = 1) -> Callable[..., Any]:
    """Atomically consume ``amount`` of a quota; raise when limit exceeded."""

    async def _dep(request: Request, principal: CurrentPrincipal) -> EntitlementSnapshot:
        tid = str(require_tenant(principal))
        snap = await _load_snapshot(request, tid)
        limit = snap.quota_limit(feature)
        if limit is None:
            raise ForbiddenError(detail=f"quota {feature} not on plan for tenant {tid}")
        if limit < 0:
            return snap  # unlimited
        redis: RedisClient | None = getattr(request.app.state, "redis", None)
        if redis is None or not redis.enabled:
            raise RuntimeError("Redis required for quota enforcement")
        period = datetime.now(UTC).strftime("%Y-%m")
        key = f"quota:{tid}:{feature}:{period}"
        # Reserve slots one-by-one so concurrent requests cannot overshoot.
        for _ in range(amount):
            used = await redis.incr(key)
            if used == 1:
                await redis.expire(key, 40 * 24 * 3600)
            if used > limit:
                raise ForbiddenError(
                    f"Quota '{feature}' exceeded ({limit} per period).",
                    detail=f"quota {feature} used={used} limit={limit}",
                )
        return snap

    return _dep


FeatureDep = Annotated[EntitlementSnapshot, Depends(require_feature)]  # use require_feature("x") at call site
