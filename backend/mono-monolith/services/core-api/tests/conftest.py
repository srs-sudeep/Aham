import os
import uuid
from collections.abc import AsyncIterator, Callable

# Must be set before the app is imported. CI overrides DATABASE_URL with Postgres.
os.environ.setdefault("ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("DB_AUTO_CREATE", "true")
os.environ.setdefault("KAFKA_ENABLED", "false")
os.environ.setdefault("REDIS_URL", "memory://")  # in-process fake; CI sets a real Redis

import httpx
import pytest

from platform_kit.entitlements import EntitlementSnapshot
from platform_kit.testing import api_client, auth_headers


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    from core_api.main import app

    async with api_client(app) as c:
        yield c
        await app.state.db.drop_all()


@pytest.fixture
def auth() -> Callable[..., dict[str, str]]:
    """auth("core-api.item:create", ..., tid=...) -> Authorization header."""
    from core_api.settings import settings

    def _auth(*perms: str, tid: str | None = None, **kw: object) -> dict[str, str]:
        return auth_headers(settings, *perms, tid=tid or str(uuid.uuid4()), **kw)  # type: ignore[arg-type]

    return _auth


@pytest.fixture
async def grant_catalog(client: httpx.AsyncClient) -> Callable[..., object]:
    """Put a catalog entitlement snapshot in Redis for the given tenant id."""
    from core_api.main import app

    async def _grant(tenant_id: str, *, catalog: bool = True) -> None:
        store = app.state.entitlements
        assert store is not None
        await store.put_snapshot(
            EntitlementSnapshot(
                tenant_id=tenant_id,
                features={"catalog": catalog},
                quotas={},
                status="active",
            )
        )

    return _grant
