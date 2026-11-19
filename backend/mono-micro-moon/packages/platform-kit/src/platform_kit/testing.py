"""Test helpers shared by every service (install `platform-kit[testing]`)."""

import time
from collections.abc import AsyncIterator, Iterable
from contextlib import asynccontextmanager

import httpx
import jwt
from fastapi import FastAPI

from platform_kit.config import ServiceSettings
from platform_kit.rbac import find_unprotected_routes


def make_token(
    settings: ServiceSettings,
    *,
    sub: str = "test-user",
    permissions: Iterable[str] = (),
    roles: Iterable[str] = (),
    tid: str | None = None,
    ver: int = 0,
    kind: str = "user",
    expires_in: int = 3600,
) -> str:
    now = int(time.time())
    claims: dict[str, object] = {
        "sub": sub,
        "iat": now,
        "exp": now + expires_in,
        "permissions": list(permissions),
        "roles": list(roles),
        "ver": ver,
        "kind": kind,
    }
    if tid:
        claims["tid"] = tid
    if settings.jwt_audience:
        claims["aud"] = settings.jwt_audience
    if settings.jwt_issuer:
        claims["iss"] = settings.jwt_issuer
    return jwt.encode(claims, settings.jwt_secret.get_secret_value(), algorithm=settings.jwt_algorithm)


def auth_headers(settings: ServiceSettings, *permissions: str, **kw: object) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(settings, permissions=permissions, **kw)}"}  # type: ignore[arg-type]


@asynccontextmanager
async def api_client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    """Runs the app lifespan (DB, broker) and yields an in-process HTTP client."""
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client


def assert_all_routes_protected(app: FastAPI) -> None:
    missing = find_unprotected_routes(app.routes)
    # A deliberate assert: this helper exists to be called from tests.
    assert not missing, f"Routes without RBAC: {missing}"  # noqa: S101
