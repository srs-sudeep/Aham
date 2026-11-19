"""Resolve role → permissions: Redis cache → DB loader → code fallback (ROLE_PERMISSIONS)."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable

from platform_kit.redis import RedisClient


class PermissionResolver:
    def __init__(
        self,
        *,
        code_fallback: dict[str, list[str]],
        redis: RedisClient | None = None,
        db_loader: Callable[[str], Awaitable[list[str]]] | None = None,
        ttl: int = 60,
    ) -> None:
        self.code_fallback = code_fallback
        self.redis = redis
        self.db_loader = db_loader
        self.ttl = ttl

    async def permissions_for_roles(self, roles: list[str]) -> list[str]:
        out: set[str] = set()
        for role in roles:
            out.update(await self._for_role(role))
        if "*" in out:
            return ["*"]
        return sorted(out)

    async def _for_role(self, role: str) -> list[str]:
        if self.redis is not None and self.redis.enabled:
            cached = await self.redis.get(f"role_perms:{role}")
            if cached is not None:
                return list(json.loads(cached))
        if self.db_loader is not None:
            perms = await self.db_loader(role)
            if perms:
                if self.redis is not None and self.redis.enabled:
                    await self.redis.set(f"role_perms:{role}", json.dumps(perms), ex=self.ttl)
                return perms
        return list(self.code_fallback.get(role, []))

    async def invalidate(self, role: str) -> None:
        if self.redis is not None and self.redis.enabled:
            await self.redis.delete(f"role_perms:{role}")
