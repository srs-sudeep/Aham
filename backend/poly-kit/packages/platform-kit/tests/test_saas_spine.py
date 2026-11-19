"""Unit tests for SaaS spine helpers (no Postgres required)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from platform_kit.config import Environment, ServiceSettings
from platform_kit.entitlements import EntitlementSnapshot
from platform_kit.security import Principal
from platform_kit.tenancy import assert_same_tenant, enable_rls_sql, require_tenant
from platform_kit.errors import ForbiddenError


def test_principal_has_permission_wildcards() -> None:
    p = Principal(sub="u1", tid="t1", permissions=frozenset({"orders.item:*"}))
    assert p.has("orders.item:read")
    assert not p.has("billing.plan:read")


def test_require_tenant_fail_closed() -> None:
    with pytest.raises(ForbiddenError):
        require_tenant(Principal(sub="u1"))


def test_assert_same_tenant() -> None:
    p = Principal(sub="u1", tid="11111111-1111-1111-1111-111111111111")
    assert_same_tenant("11111111-1111-1111-1111-111111111111", p)
    with pytest.raises(ForbiddenError):
        assert_same_tenant("22222222-2222-2222-2222-222222222222", p)


def test_entitlement_grace_window() -> None:
    snap = EntitlementSnapshot(
        tenant_id="t1",
        features={"sso": True},
        quotas={"api_calls": 10},
        status="past_due",
        grace_until=datetime.now(UTC) + timedelta(days=1),
    )
    assert snap.is_commercially_active()
    assert snap.has_feature("sso")
    assert snap.quota_limit("api_calls") == 10

    expired = snap.model_copy(update={"grace_until": datetime.now(UTC) - timedelta(days=1)})
    assert not expired.is_commercially_active()


def test_rls_sql_contains_policy() -> None:
    sql = enable_rls_sql("items")
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "tenant_isolation" in sql


def test_saas_settings_accept_redis_in_dev() -> None:
    s = ServiceSettings(
        env=Environment.DEV,
        platform_profile="saas",
        redis_url="redis://localhost:6379/0",
        jwt_audience="api://local",
        jwt_issuer="https://auth.local",
    )
    assert s.is_saas
