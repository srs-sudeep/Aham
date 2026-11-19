"""Per-tenant OIDC Authorization Code flow (enterprise SSO).

Connection metadata (stored on AuthConnection.metadata_json)::

    {
      "issuer": "https://login.microsoftonline.com/.../v2.0",
      "client_id": "...",
      "client_secret": "...",
      "authorize_url": "https://.../authorize",   # optional if discovery works
      "token_url": "https://.../token",
      "userinfo_url": "https://.../userinfo",
      "scopes": "openid email profile"
    }
"""

from __future__ import annotations

import secrets
from typing import Any
from urllib.parse import urlencode
from uuid import UUID

import httpx

from platform_kit.errors import BadRequestError, UnauthorizedError
from platform_kit.logging import get_logger
from platform_kit.redis import RedisClient

log = get_logger("platform_kit.oidc")


class OidcAuthFederator:
    def __init__(self, redis: RedisClient, *, http: httpx.AsyncClient | None = None) -> None:
        self.redis = redis
        self.http = http

    async def start_login(
        self,
        tenant_id: UUID,
        return_to: str,
        *,
        connection: dict[str, Any],
        redirect_uri: str,
    ) -> str:
        meta = _meta(connection)
        state = secrets.token_urlsafe(24)
        await self.redis.set(
            f"oidc_state:{state}",
            f"{tenant_id}|{return_to}",
            ex=600,
        )
        params = {
            "client_id": meta["client_id"],
            "response_type": "code",
            "scope": meta.get("scopes", "openid email profile"),
            "redirect_uri": redirect_uri,
            "state": state,
        }
        return f"{meta['authorize_url']}?{urlencode(params)}"

    async def handle_callback(
        self,
        *,
        code: str,
        state: str,
        connection: dict[str, Any],
        redirect_uri: str,
    ) -> dict[str, Any]:
        raw = await self.redis.get(f"oidc_state:{state}")
        if not raw:
            raise UnauthorizedError("SSO session expired. Please try again.", detail="oidc state miss")
        await self.redis.delete(f"oidc_state:{state}")
        tenant_id, return_to = raw.split("|", 1)
        meta = _meta(connection)
        client = self.http or httpx.AsyncClient(timeout=15.0)
        owns = self.http is None
        try:
            token_resp = await client.post(
                meta["token_url"],
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": meta["client_id"],
                    "client_secret": meta["client_secret"],
                },
                headers={"Accept": "application/json"},
            )
            if token_resp.status_code >= 400:
                raise UnauthorizedError(detail=f"oidc token exchange failed: {token_resp.text[:200]}")
            tokens = token_resp.json()
            access = tokens.get("access_token")
            if not access:
                raise UnauthorizedError(detail="oidc response missing access_token")
            userinfo: dict[str, Any]
            if meta.get("userinfo_url"):
                ui = await client.get(
                    meta["userinfo_url"],
                    headers={"Authorization": f"Bearer {access}"},
                )
                if ui.status_code >= 400:
                    raise UnauthorizedError(detail=f"oidc userinfo failed: {ui.text[:200]}")
                userinfo = ui.json()
            else:
                # Fallback: decode id_token without verify when JWKS not configured (dev only).
                import jwt

                userinfo = jwt.decode(tokens["id_token"], options={"verify_signature": False})
        finally:
            if owns:
                await client.aclose()

        email = (userinfo.get("email") or userinfo.get("preferred_username") or "").lower()
        if not email:
            raise BadRequestError(detail="oidc userinfo missing email")
        sub = str(userinfo.get("sub") or email)
        log.info("oidc_login", tenant_id=tenant_id, email=email)
        return {
            "tenant_id": tenant_id,
            "return_to": return_to,
            "email": email,
            "external_sub": sub,
            "claims": userinfo,
        }


def _meta(connection: dict[str, Any]) -> dict[str, str]:
    required = ("client_id", "client_secret", "authorize_url", "token_url")
    missing = [k for k in required if not connection.get(k)]
    if missing:
        raise BadRequestError(detail=f"oidc connection missing fields: {missing}")
    out = {k: str(connection[k]) for k in required}
    if connection.get("userinfo_url"):
        out["userinfo_url"] = str(connection["userinfo_url"])
    out["scopes"] = str(connection.get("scopes") or "openid email profile")
    return out
