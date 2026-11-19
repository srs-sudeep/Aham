"""Authentication: issue and verify JWTs; opaque refresh tokens in Redis.

Access tokens are short-lived JWTs (sub, tid, roles, permissions, ver, kind).
Refresh tokens are opaque, hashed in Redis, rotated on use with reuse detection.
"""

from __future__ import annotations

import hashlib
import secrets
import time
from typing import Annotated, Any, Literal
from uuid import UUID

import anyio
import jwt
import structlog
from fastapi import Depends, Request
from pydantic import BaseModel, Field

from platform_kit.config import ServiceSettings
from platform_kit.context import auth_token_var, tenant_id_var, user_id_var
from platform_kit.errors import ForbiddenError, UnauthorizedError
from platform_kit.redis import RedisClient


class Principal(BaseModel):
    sub: str
    tid: str | None = None
    roles: list[str] = Field(default_factory=list)
    permissions: frozenset[str] = Field(default_factory=frozenset)
    ver: int = 0
    kind: Literal["user", "api_key"] = "user"
    claims: dict[str, Any] = Field(default_factory=dict, repr=False)

    def has(self, permission: str) -> bool:
        if "*" in self.permissions or permission in self.permissions:
            return True
        resource, _, _ = permission.partition(":")
        return f"{resource}:*" in self.permissions


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    tenant_id: str | None = None


class TokenVerifier:
    def __init__(self, settings: ServiceSettings, role_permissions: dict[str, list[str]]) -> None:
        self.settings = settings
        self.role_permissions = role_permissions
        self._jwks = jwt.PyJWKClient(settings.jwks_url, cache_keys=True) if settings.jwks_url else None

    async def verify(self, token: str) -> Principal:
        s = self.settings
        try:
            if self._jwks is not None:
                signing_key = await anyio.to_thread.run_sync(self._jwks.get_signing_key_from_jwt, token)
                key: Any = signing_key.key
                algorithms = ["RS256", "ES256"]
            else:
                key = s.jwt_secret.get_secret_value()
                algorithms = [s.jwt_algorithm]
            claims = jwt.decode(
                token,
                key,
                algorithms=algorithms,
                audience=s.jwt_audience,
                issuer=s.jwt_issuer,
                options={"require": ["sub", "exp"], "verify_aud": s.jwt_audience is not None},
            )
        except jwt.ExpiredSignatureError as exc:
            raise UnauthorizedError("Your session has expired. Please sign in again.", detail=str(exc)) from exc
        except jwt.PyJWTError as exc:
            raise UnauthorizedError(detail=f"invalid token: {exc}") from exc

        roles = _claim_str_list(claims.get("roles"), "roles")
        perms = set(_claim_str_list(claims.get("permissions"), "permissions"))
        for role in roles:
            perms.update(self.role_permissions.get(role, []))
        tid = claims.get("tid")
        kind = claims.get("kind", "user")
        if kind not in ("user", "api_key"):
            raise UnauthorizedError(detail=f"invalid kind claim: {kind}")
        return Principal(
            sub=str(claims["sub"]),
            tid=str(tid) if tid else None,
            roles=roles,
            permissions=frozenset(perms),
            ver=int(claims.get("ver") or 0),
            kind=kind,  # type: ignore[arg-type]
            claims=claims,
        )


class TokenIssuer:
    """Issues access JWTs and stores hashed refresh tokens in Redis."""

    def __init__(self, settings: ServiceSettings, redis: RedisClient) -> None:
        self.settings = settings
        self.redis = redis

    def issue_access(
        self,
        *,
        sub: str,
        tid: str | UUID | None,
        roles: list[str],
        permissions: list[str],
        ver: int = 0,
        kind: Literal["user", "api_key"] = "user",
        extra: dict[str, Any] | None = None,
    ) -> str:
        s = self.settings
        now = int(time.time())
        claims: dict[str, Any] = {
            "sub": sub,
            "iat": now,
            "exp": now + s.access_token_ttl_seconds,
            "roles": roles,
            "permissions": permissions,
            "ver": ver,
            "kind": kind,
        }
        if tid is not None:
            claims["tid"] = str(tid)
        if s.jwt_audience:
            claims["aud"] = s.jwt_audience
        if s.jwt_issuer:
            claims["iss"] = s.jwt_issuer
        if extra:
            claims.update(extra)
        return jwt.encode(claims, s.jwt_secret.get_secret_value(), algorithm=s.jwt_algorithm)

    async def issue_pair(
        self,
        *,
        sub: str,
        tid: str | UUID,
        roles: list[str],
        permissions: list[str],
        ver: int = 0,
        family: str | None = None,
    ) -> TokenPair:
        access = self.issue_access(sub=sub, tid=tid, roles=roles, permissions=permissions, ver=ver)
        refresh, family_id = await self._store_refresh(sub=sub, tid=str(tid), ver=ver, family=family)
        return TokenPair(
            access_token=access,
            refresh_token=refresh,
            expires_in=self.settings.access_token_ttl_seconds,
            tenant_id=str(tid),
        )

    async def rotate_refresh(self, raw_refresh: str) -> tuple[str, str, int, str]:
        """Validate refresh, detect reuse, return (sub, tid, ver, family). Caller re-issues pair."""
        digest = _hash_token(raw_refresh)
        key = f"refresh:{digest}"
        raw = await self.redis.get(key)
        if raw is None:
            # Possible reuse after rotation — kill family if encoded in token metadata map
            meta = await self.redis.get(f"refresh_meta:{digest}")
            if meta and ":" in meta:
                family = meta.split(":", 1)[0]
                await self.revoke_family(family)
            raise UnauthorizedError("Invalid or expired refresh token.", detail="refresh miss")
        await self.redis.delete(key)
        # payload: family:sub:tid:ver
        family, sub, tid, ver_s = raw.split(":", 3)
        return sub, tid, int(ver_s), family

    async def revoke_refresh(self, raw_refresh: str) -> None:
        digest = _hash_token(raw_refresh)
        await self.redis.delete(f"refresh:{digest}", f"refresh_meta:{digest}")

    async def revoke_family(self, family: str) -> None:
        client = self.redis.require()
        async for key in client.scan_iter(match=f"refresh_family:{family}:*", count=100):
            digest = key.rsplit(":", 1)[-1]
            await client.delete(key, f"refresh:{digest}", f"refresh_meta:{digest}")

    async def _store_refresh(
        self, *, sub: str, tid: str, ver: int, family: str | None
    ) -> tuple[str, str]:
        family_id = family or secrets.token_urlsafe(16)
        raw = secrets.token_urlsafe(48)
        digest = _hash_token(raw)
        ttl = self.settings.refresh_token_ttl_seconds
        payload = f"{family_id}:{sub}:{tid}:{ver}"
        await self.redis.set(f"refresh:{digest}", payload, ex=ttl)
        await self.redis.set(f"refresh_meta:{digest}", f"{family_id}:{sub}", ex=ttl)
        await self.redis.set(f"refresh_family:{family_id}:{digest}", "1", ex=ttl)
        return raw, family_id


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _claim_str_list(value: Any, claim: str) -> list[str]:
    """Require list[str] (or omit). A bare string like '*' must not become set('*') → superuser."""
    if value is None:
        return []
    if isinstance(value, str) or not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise UnauthorizedError(detail=f"invalid {claim} claim: expected a list of strings")
    return list(value)


async def get_current_principal(request: Request) -> Principal:
    # API keys: Authorization: Bearer aham_... or X-API-Key
    api_key = request.headers.get("x-api-key")
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if api_key or (scheme.lower() == "bearer" and token.startswith("aham_")):
        raw = api_key or token
        lookup = getattr(request.app.state, "api_key_lookup", None)
        if lookup is None:
            raise UnauthorizedError(detail="API keys are not enabled")
        principal = await lookup(raw)
        user_id_var.set(principal.sub)
        if principal.tid:
            tenant_id_var.set(principal.tid)
        auth_token_var.set(raw)
        structlog.contextvars.bind_contextvars(user_id=principal.sub, tenant_id=principal.tid, kind="api_key")
        return principal
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError(detail="missing bearer token")
    verifier: TokenVerifier = request.app.state.token_verifier
    principal = await verifier.verify(token)
    # Optional token-version check against Redis (session revoke)
    redis: RedisClient | None = getattr(request.app.state, "redis", None)
    if redis is not None and redis.enabled and principal.ver >= 0:
        min_ver = await redis.get(f"token_ver:{principal.sub}")
        if min_ver is not None and principal.ver < int(min_ver):
            raise UnauthorizedError("Session was revoked. Please sign in again.", detail="token ver stale")
    user_id_var.set(principal.sub)
    if principal.tid:
        tenant_id_var.set(principal.tid)
    auth_token_var.set(token)
    structlog.contextvars.bind_contextvars(user_id=principal.sub, tenant_id=principal.tid)
    return principal


async def require_user_principal(principal: Annotated[Principal, Depends(get_current_principal)]) -> Principal:
    if principal.kind != "user":
        raise ForbiddenError(detail="user principal required")
    return principal


CurrentPrincipal = Annotated[Principal, Depends(get_current_principal)]
