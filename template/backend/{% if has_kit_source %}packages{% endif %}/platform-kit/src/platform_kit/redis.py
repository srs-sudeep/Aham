"""Async Redis client used for cache, refresh tokens, rate limits, and quota counters."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from platform_kit.config import ServiceSettings
from platform_kit.logging import get_logger

log = get_logger("platform_kit.redis")


class RedisClient:
    """Thin wrapper so call sites never import redis.asyncio directly."""

    def __init__(self, settings: ServiceSettings) -> None:
        self.settings = settings
        self._client: Any = None

    async def connect(self) -> None:
        if not self.settings.redis_url:
            return
        from redis.asyncio import Redis

        self._client = Redis.from_url(self.settings.redis_url, decode_responses=True)
        await self._client.ping()
        log.info("redis_connected")

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def require(self) -> Any:
        if self._client is None:
            raise RuntimeError("Redis is not configured (set REDIS_URL / platform_profile=saas)")
        return self._client

    async def ping(self) -> None:
        await self.require().ping()

    async def get(self, key: str) -> str | None:
        return await self.require().get(key)

    async def set(self, key: str, value: str, *, ex: int | None = None) -> None:
        await self.require().set(key, value, ex=ex)

    async def delete(self, *keys: str) -> None:
        if keys:
            await self.require().delete(*keys)

    async def incr(self, key: str) -> int:
        return int(await self.require().incr(key))

    async def expire(self, key: str, seconds: int) -> None:
        await self.require().expire(key, seconds)

    async def exists(self, key: str) -> bool:
        return bool(await self.require().exists(key))


@asynccontextmanager
async def lifespan_redis(settings: ServiceSettings) -> AsyncIterator[RedisClient | None]:
    if not settings.redis_url:
        yield None
        return
    client = RedisClient(settings)
    await client.connect()
    try:
        yield client
    finally:
        await client.close()
