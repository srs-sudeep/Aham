"""Billing + entitlement snapshots (ManualProvider for v1)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from core_api.modules.billing.errors import PlanNotFoundError, SubscriptionNotFoundError
from core_api.modules.billing.models import (
    EntitlementOverride,
    EntitlementSnapshotRow,
    Feature,
    Plan,
    PlanFeature,
    Subscription,
)
from core_api.modules.billing.repository import BillingRepository
from core_api.modules.billing.schemas import OverrideRequest, PlanOut, SubscriptionOut
from platform_kit.entitlements import EntitlementSnapshot, RedisEntitlementStore
from platform_kit.providers import ManualPaymentProvider, PaymentProvider
from platform_kit.redis import RedisClient

DEFAULT_CATALOG: list[tuple[str, str, str, str | None]] = [
    ("sso", "Enterprise SSO", "boolean", None),
    ("audit_export", "Audit log export", "boolean", None),
    ("api_calls", "API calls per month", "quota", "calls"),
    ("seats", "User seats", "quota", "seats"),
]

DEFAULT_PLANS: dict[str, dict[str, bool | int]] = {
    "free": {"audit_export": False, "sso": False, "api_calls": 1000, "seats": 3},
    "pro": {"audit_export": True, "sso": False, "api_calls": 100_000, "seats": 25},
    "enterprise": {"audit_export": True, "sso": True, "api_calls": -1, "seats": -1},
}


class BillingService:
    def __init__(
        self,
        repo: BillingRepository,
        redis: RedisClient,
        payment: PaymentProvider | None = None,
    ) -> None:
        self.repo = repo
        self.redis = redis
        self.payment = payment or ManualPaymentProvider()
        self.store = RedisEntitlementStore(redis, loader=self._load_snapshot)

    async def seed_catalog(self) -> None:
        if await self.repo.get_plan_by_code("free"):
            return
        features: dict[str, Feature] = {}
        for key, desc, kind, unit in DEFAULT_CATALOG:
            f = Feature(key=key, description=desc, kind=kind, unit=unit)
            self.repo.session.add(f)
            await self.repo.session.flush()
            features[key] = f
        for code, mapping in DEFAULT_PLANS.items():
            plan = Plan(code=code, name=code.title(), interval="month")
            self.repo.session.add(plan)
            await self.repo.session.flush()
            for key, value in mapping.items():
                feat = features[key]
                limit = value if feat.kind == "quota" else None
                enabled = bool(value) if feat.kind == "boolean" else True
                if feat.kind == "boolean" and not enabled:
                    continue
                self.repo.session.add(
                    PlanFeature(
                        plan_id=plan.id, feature_id=feat.id, limit_value=limit if feat.kind == "quota" else None
                    )
                )
        await self.repo.commit()

    async def list_plans(self) -> list[PlanOut]:
        await self.seed_catalog()
        out: list[PlanOut] = []
        for plan in await self.repo.list_plans():
            feats: dict[str, bool | int] = {}
            for feature, pf in await self.repo.plan_features(plan.id):
                if feature.kind == "quota":
                    feats[feature.key] = pf.limit_value if pf.limit_value is not None else 0
                else:
                    feats[feature.key] = True
            out.append(PlanOut(code=plan.code, name=plan.name, interval=plan.interval, features=feats))
        return out

    async def activate(self, tenant_id: UUID, plan_code: str, *, grace_days: int = 3) -> SubscriptionOut:
        await self.seed_catalog()
        plan = await self.repo.get_plan_by_code(plan_code)
        if plan is None:
            raise PlanNotFoundError(detail=plan_code)
        now = datetime.now(UTC)
        sub = await self.repo.get_subscription(tenant_id)
        if sub is None:
            sub = Subscription(
                tenant_id=tenant_id,
                plan_id=plan.id,
                status="active",
                period_start=now,
                period_end=now + timedelta(days=30),
                grace_until=None,
            )
            self.repo.session.add(sub)
        else:
            sub.plan_id = plan.id
            sub.status = "active"
            sub.period_start = now
            sub.period_end = now + timedelta(days=30)
            sub.grace_until = None
        snap = await self._rebuild_snapshot(tenant_id, plan, status="active", grace_until=None)
        await self.repo.commit()
        await self.store.put_snapshot(snap)
        return await self.get_subscription(tenant_id)

    async def mark_past_due(self, tenant_id: UUID, *, grace_days: int = 3) -> SubscriptionOut:
        sub = await self.repo.get_subscription(tenant_id)
        if sub is None:
            raise SubscriptionNotFoundError()
        sub.status = "past_due"
        sub.grace_until = datetime.now(UTC) + timedelta(days=grace_days)
        plan = await self.repo.session.get(Plan, sub.plan_id)
        assert plan is not None
        snap = await self._rebuild_snapshot(tenant_id, plan, status="past_due", grace_until=sub.grace_until)
        await self.repo.commit()
        await self.store.put_snapshot(snap)
        return await self.get_subscription(tenant_id)

    async def cancel(self, tenant_id: UUID) -> SubscriptionOut:
        sub = await self.repo.get_subscription(tenant_id)
        if sub is None:
            raise SubscriptionNotFoundError()
        sub.status = "canceled"
        plan = await self.repo.session.get(Plan, sub.plan_id)
        assert plan is not None
        snap = await self._rebuild_snapshot(tenant_id, plan, status="canceled", grace_until=None)
        await self.repo.commit()
        await self.store.put_snapshot(snap)
        return await self.get_subscription(tenant_id)

    async def set_override(self, body: OverrideRequest) -> SubscriptionOut:
        row = EntitlementOverride(
            tenant_id=body.tenant_id,
            feature_key=body.feature_key,
            enabled=body.enabled,
            quota_limit=body.quota_limit,
            reason=body.reason,
        )
        self.repo.session.add(row)
        sub = await self.repo.get_subscription(body.tenant_id)
        if sub is None:
            raise SubscriptionNotFoundError()
        plan = await self.repo.session.get(Plan, sub.plan_id)
        assert plan is not None
        snap = await self._rebuild_snapshot(body.tenant_id, plan, status=sub.status, grace_until=sub.grace_until)
        await self.repo.commit()
        await self.store.put_snapshot(snap)
        return await self.get_subscription(body.tenant_id)

    async def get_subscription(self, tenant_id: UUID) -> SubscriptionOut:
        sub = await self.repo.get_subscription(tenant_id)
        if sub is None:
            raise SubscriptionNotFoundError()
        plan = await self.repo.session.get(Plan, sub.plan_id)
        assert plan is not None
        snap = await self.store.get_snapshot(str(tenant_id)) or await self._load_snapshot(str(tenant_id))
        assert snap is not None
        return SubscriptionOut(
            tenant_id=tenant_id,
            plan_code=plan.code,
            status=sub.status,
            period_end=sub.period_end,
            grace_until=sub.grace_until,
            features=snap.features,
            quotas=snap.quotas,
        )

    async def _rebuild_snapshot(
        self,
        tenant_id: UUID,
        plan: Plan,
        *,
        status: str,
        grace_until: datetime | None,
    ) -> EntitlementSnapshot:
        features: dict[str, bool] = {}
        quotas: dict[str, int] = {}
        for feature, pf in await self.repo.plan_features(plan.id):
            if feature.kind == "quota":
                quotas[feature.key] = pf.limit_value if pf.limit_value is not None else 0
            else:
                features[feature.key] = True
        for ov in await self.repo.list_overrides(tenant_id):
            if ov.enabled is not None:
                features[ov.feature_key] = ov.enabled
            if ov.quota_limit is not None:
                quotas[ov.feature_key] = ov.quota_limit
        snap = EntitlementSnapshot(
            tenant_id=str(tenant_id),
            features=features,
            quotas=quotas,
            status=status,
            grace_until=grace_until,
        )
        row = await self.repo.get_snapshot(tenant_id)
        if row is None:
            row = EntitlementSnapshotRow(
                tenant_id=tenant_id,
                features=features,
                quotas=quotas,
                status=status,
                grace_until=grace_until,
            )
            self.repo.session.add(row)
        else:
            row.features = features
            row.quotas = quotas
            row.status = status
            row.grace_until = grace_until
        await self.repo.session.flush()
        return snap

    async def _load_snapshot(self, tenant_id: str) -> EntitlementSnapshot | None:
        row = await self.repo.get_snapshot(UUID(tenant_id))
        if row is None:
            return None
        return EntitlementSnapshot(
            tenant_id=tenant_id,
            features={k: bool(v) for k, v in (row.features or {}).items()},
            quotas={k: int(v) for k, v in (row.quotas or {}).items()},
            status=row.status,
            grace_until=row.grace_until,
        )
