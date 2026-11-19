"""API tests for billing tenant isolation: self-service uses the token's tenant; plan changes are operator-only."""

import uuid

import pytest

from platform_kit.testing import auth_headers

BILLING = "/api/v1/billing"


def _tenant_admin() -> tuple[str, dict[str, str]]:
    """A tenant admin holds `*` inside its own tenant, exactly what the identity module issues on signup."""
    from core_api.settings import settings

    tenant_id = str(uuid.uuid4())
    return tenant_id, auth_headers(settings, "*", sub=str(uuid.uuid4()), tid=tenant_id, roles=["owner"])


@pytest.fixture
def operator(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    from core_api.settings import settings

    tenant_id, headers = _tenant_admin()
    monkeypatch.setattr(settings, "platform_operator_tenant_id", uuid.UUID(tenant_id))
    return headers


async def test_tenant_admin_cannot_change_another_tenants_plan(client, operator) -> None:
    victim_id, _ = _tenant_admin()
    _, attacker = _tenant_admin()

    activate = await client.post(
        f"{BILLING}/subscription/activate",
        json={"tenant_id": victim_id, "plan_code": "enterprise"},
        headers=attacker,
    )
    assert activate.status_code == 403, activate.text

    override = await client.post(
        f"{BILLING}/overrides",
        json={"tenant_id": victim_id, "feature_key": "sso", "enabled": True},
        headers=attacker,
    )
    assert override.status_code == 403, override.text


async def test_operator_changes_plan_and_tenant_sees_only_its_own(client, operator) -> None:
    customer_id, customer = _tenant_admin()

    activated = await client.post(
        f"{BILLING}/subscription/activate",
        json={"tenant_id": customer_id, "plan_code": "pro"},
        headers=operator,
    )
    assert activated.status_code == 200, activated.text

    mine = await client.get(f"{BILLING}/subscription", headers=customer)
    assert mine.status_code == 200, mine.text
    assert mine.json()["tenant_id"] == customer_id
    assert mine.json()["plan_code"] == "pro"

    cancelled = await client.post(f"{BILLING}/subscription/cancel", headers=customer)
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["tenant_id"] == customer_id
    assert cancelled.json()["status"] == "canceled"
