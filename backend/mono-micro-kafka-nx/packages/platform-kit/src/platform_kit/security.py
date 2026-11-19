"""Authentication: verify a JWT and turn it into a Principal.

Tokens are verified locally (no call to the auth server per request):
* real environments: RS256 via ``jwks_url`` (Keycloak, Entra ID, Auth0, Cognito ...)
* local dev / tests: HS256 with ``jwt_secret`` (see ``platform_kit.testing.make_token``)

Effective permissions = the ``permissions`` claim, plus the permissions mapped from
``roles`` via the service's ROLE_PERMISSIONS table (``permissions.py``).
"""

from typing import Annotated, Any

import anyio
import jwt
import structlog
from fastapi import Depends, Request
from pydantic import BaseModel, Field

from platform_kit.config import ServiceSettings
from platform_kit.context import auth_token_var, user_id_var
from platform_kit.errors import UnauthorizedError


class Principal(BaseModel):
    sub: str
    roles: list[str] = Field(default_factory=list)
    permissions: frozenset[str] = Field(default_factory=frozenset)
    claims: dict[str, Any] = Field(default_factory=dict, repr=False)

    def has(self, permission: str) -> bool:
        if "*" in self.permissions or permission in self.permissions:
            return True
        resource, _, _ = permission.partition(":")
        return f"{resource}:*" in self.permissions


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
        return Principal(sub=str(claims["sub"]), roles=roles, permissions=frozenset(perms), claims=claims)


def _claim_str_list(value: Any, claim: str) -> list[str]:
    """Require list[str] (or omit). A bare string like '*' must not become set('*') → superuser."""
    if value is None:
        return []
    if isinstance(value, str) or not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise UnauthorizedError(detail=f"invalid {claim} claim: expected a list of strings")
    return list(value)


async def get_current_principal(request: Request) -> Principal:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError(detail="missing bearer token")
    verifier: TokenVerifier = request.app.state.token_verifier
    principal = await verifier.verify(token)
    user_id_var.set(principal.sub)
    auth_token_var.set(token)  # forwarded by ServiceClient for on-behalf-of calls
    structlog.contextvars.bind_contextvars(user_id=principal.sub)
    return principal


CurrentPrincipal = Annotated[Principal, Depends(get_current_principal)]
