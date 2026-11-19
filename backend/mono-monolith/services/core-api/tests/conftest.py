import os

# Must be set before the app is imported. CI overrides DATABASE_URL with Postgres.
os.environ.setdefault("ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("DB_AUTO_CREATE", "true")
os.environ.setdefault("KAFKA_ENABLED", "false")

from collections.abc import AsyncIterator, Callable

import httpx
import pytest

from platform_kit.testing import api_client, auth_headers


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    from core_api.main import app

    async with api_client(app) as c:
        yield c
        await app.state.db.drop_all()


@pytest.fixture
def auth() -> Callable[..., dict[str, str]]:
    """auth("core-api.item:create", ...) -> Authorization header with exactly those permissions."""
    from core_api.settings import settings

    return lambda *perms: auth_headers(settings, *perms)
