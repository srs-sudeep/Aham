"""Sliding-window rate limits backed by Redis (IP, email, tenant)."""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Annotated, Any

from fastapi import Depends, Request

from platform_kit.errors import RateLimitError
from platform_kit.redis import RedisClient


class RateLimiter:
    def __init__(self, redis: RedisClient) -> None:
        self.redis = redis

    async def hit(self, key: str, *, limit: int, window_seconds: int) -> None:
        """Increment and raise RateLimitError when ``limit`` is exceeded within the window."""
        client = self.redis.require()
        now = time.time()
        bucket = f"rl:{key}"
        pipe = client.pipeline()
        pipe.zremrangebyscore(bucket, 0, now - window_seconds)
        pipe.zadd(bucket, {f"{now}": now})
        pipe.zcard(bucket)
        pipe.expire(bucket, window_seconds)
        results = await pipe.execute()
        count = int(results[2])
        if count > limit:
            raise RateLimitError(
                detail=f"rate limit exceeded for {key}: {count}/{limit} per {window_seconds}s",
                limit=limit,
                window_seconds=window_seconds,
            )


def rate_limit(
    *,
    limit: int,
    window_seconds: int = 60,
    key_fn: Callable[[Request], str],
) -> Callable[..., Any]:
    """FastAPI dependency factory: ``Depends(rate_limit(limit=10, key_fn=...))``."""

    async def _dep(request: Request) -> None:
        redis: RedisClient | None = getattr(request.app.state, "redis", None)
        if redis is None or not redis.enabled:
            return
        limiter = RateLimiter(redis)
        await limiter.hit(key_fn(request), limit=limit, window_seconds=window_seconds)

    return _dep


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def get_rate_limiter(request: Request) -> RateLimiter:
    redis: RedisClient | None = getattr(request.app.state, "redis", None)
    if redis is None or not redis.enabled:
        raise RuntimeError("Redis required for RateLimiter")
    return RateLimiter(redis)


RateLimiterDep = Annotated[RateLimiter, Depends(get_rate_limiter)]
