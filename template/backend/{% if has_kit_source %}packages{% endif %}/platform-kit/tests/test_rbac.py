from enum import StrEnum

import pytest

from platform_kit.config import ServiceSettings
from platform_kit.errors import UnauthorizedError
from platform_kit.rbac import PUBLIC, Action, Permission, SecureRouter, find_unprotected_routes
from platform_kit.security import Principal, TokenVerifier, _claim_str_list
from platform_kit.testing import make_token


class Resource(StrEnum):
    ORDER = "orders.order"


def test_permission_string() -> None:
    assert str(Permission(Resource.ORDER, Action.CREATE)) == "orders.order:create"


def test_principal_wildcards() -> None:
    assert Principal(sub="a", permissions=frozenset({"*"})).has("x:y")
    assert Principal(sub="a", permissions=frozenset({"orders.order:*"})).has("orders.order:delete")
    assert not Principal(sub="a", permissions=frozenset({"orders.order:read"})).has("orders.order:delete")


def test_claim_str_list_rejects_bare_string() -> None:
    with pytest.raises(UnauthorizedError, match="list of strings"):
        _claim_str_list("*", "permissions")


def test_claim_str_list_accepts_list() -> None:
    assert _claim_str_list(["orders.order:read"], "permissions") == ["orders.order:read"]
    assert _claim_str_list(None, "roles") == []


@pytest.mark.asyncio
async def test_token_verifier_rejects_string_permissions_claim() -> None:
    settings = ServiceSettings()
    verifier = TokenVerifier(settings, {})
    now_token = make_token(settings, permissions=["orders.order:read"])
    # Forge a token with a string permissions claim (would become set("*") if unchecked).
    import time

    import jwt

    now = int(time.time())
    bad = jwt.encode(
        {"sub": "u", "iat": now, "exp": now + 3600, "permissions": "*"},
        settings.jwt_secret.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(UnauthorizedError, match="permissions"):
        await verifier.verify(bad)
    principal = await verifier.verify(now_token)
    assert "orders.order:read" in principal.permissions


def test_secure_router_marks_every_route() -> None:
    router = SecureRouter(prefix="/orders", tags=["orders"])

    @router.get("", permission=Permission(Resource.ORDER, Action.LIST), summary="List")
    async def list_orders() -> list[str]:
        return []

    @router.get("/ping", permission=PUBLIC, summary="Ping")
    async def ping() -> str:
        return "pong"

    assert find_unprotected_routes(router.api_router.routes) == []
    extras = [r.openapi_extra["x-permission"] for r in router.api_router.routes]  # type: ignore[attr-defined]
    assert extras == ["orders.order:list", "public"]


def test_secure_router_rejects_garbage_permission() -> None:
    router = SecureRouter(prefix="/x", tags=["x"])
    with pytest.raises(TypeError):
        router.get("", permission="orders:read", summary="bad")  # type: ignore[arg-type]
