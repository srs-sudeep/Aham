"""Wire IdentityService for a request."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from core_api.modules.identity.repository import IdentityRepository
from core_api.modules.identity.service import IdentityService
from platform_kit.audit import Audit
from platform_kit.db import SessionDep
from platform_kit.providers import LoggingEmailSender
from platform_kit.redis import RedisClient
from platform_kit.security import TokenIssuer


def get_identity_service(session: SessionDep, request: Request) -> IdentityService:
    import core_api.modules.identity.phase2 as _phase2  # noqa: F401

    settings = request.app.state.settings
    redis: RedisClient = request.app.state.redis
    issuer: TokenIssuer = request.app.state.token_issuer
    if redis is None or issuer is None:
        raise RuntimeError("SaaS identity requires Redis and TokenIssuer (PLATFORM_PROFILE=saas, REDIS_URL)")
    audit_writer = getattr(request.app.state, "audit_writer", None)
    audit = Audit(audit_writer) if audit_writer else Audit()
    svc = IdentityService(
        IdentityRepository(session),
        settings,
        issuer,
        redis,
        audit=audit,
        email=LoggingEmailSender(),
    )

    async def _api_key_lookup(raw: str):
        return await svc.lookup_api_key(raw)

    request.app.state.api_key_lookup = _api_key_lookup
    return svc


IdentityServiceDep = Annotated[IdentityService, Depends(get_identity_service)]
