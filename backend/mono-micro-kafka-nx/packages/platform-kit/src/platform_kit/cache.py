"""Typed cache helpers on top of RedisClient."""

from __future__ import annotations

import json
from typing import Any, TypeVar

from pydantic import BaseModel, TypeAdapter

from platform_kit.redis import RedisClient

T = TypeVar("T", bound=BaseModel)


class Cache:
    def __init__(self, redis: RedisClient, *, prefix: str = "cache") -> None:
        self.redis = redis
        self.prefix = prefix

    def _key(self, namespace: str, key: str) -> str:
        return f"{self.prefix}:{namespace}:{key}"

    async def get_json(self, namespace: str, key: str) -> Any | None:
        raw = await self.redis.get(self._key(namespace, key))
        return None if raw is None else json.loads(raw)

    async def set_json(self, namespace: str, key: str, value: Any, *, ttl: int = 60) -> None:
        await self.redis.set(self._key(namespace, key), json.dumps(value), ex=ttl)

    async def get_model(self, namespace: str, key: str, model: type[T]) -> T | None:
        data = await self.get_json(namespace, key)
        return None if data is None else TypeAdapter(model).validate_python(data)

    async def set_model(self, namespace: str, key: str, value: T, *, ttl: int = 60) -> None:
        await self.set_json(namespace, key, value.model_dump(mode="json"), ttl=ttl)

    async def delete(self, namespace: str, key: str) -> None:
        await self.redis.delete(self._key(namespace, key))

    async def invalidate_prefix(self, namespace: str) -> None:
        client = self.redis.require()
        pattern = f"{self.prefix}:{namespace}:*"
        async for key in client.scan_iter(match=pattern, count=100):
            await client.delete(key)
