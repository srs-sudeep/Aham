"""Append-only audit helper. Services persist via an injected writer; kit never deletes."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Protocol
from uuid import UUID

from pydantic import BaseModel, Field

from platform_kit.context import get_request_id
from platform_kit.logging import get_logger

log = get_logger("platform_kit.audit")


class AuditEvent(BaseModel):
    actor_type: str  # user | api_key | system | support
    actor_id: str | None = None
    tenant_id: str | None = None
    action: str  # e.g. auth.login.success, billing.subscription.activated
    target: str | None = None
    result: str = "success"  # success | failure
    ip: str | None = None
    user_agent: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    request_id: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AuditWriter(Protocol):
    async def write(self, event: AuditEvent) -> None: ...


class LoggingAuditWriter:
    """Dev fallback when no DB writer is wired."""

    async def write(self, event: AuditEvent) -> None:
        log.info(
            "audit_event",
            action=event.action,
            actor_type=event.actor_type,
            actor_id=event.actor_id,
            tenant_id=event.tenant_id,
            target=event.target,
            result=event.result,
            request_id=event.request_id or get_request_id(),
        )


class Audit:
    def __init__(self, writer: AuditWriter | None = None) -> None:
        self.writer: AuditWriter = writer or LoggingAuditWriter()

    async def record(
        self,
        action: str,
        *,
        actor_type: str = "user",
        actor_id: str | UUID | None = None,
        tenant_id: str | UUID | None = None,
        target: str | None = None,
        result: str = "success",
        ip: str | None = None,
        user_agent: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        # Never put secrets in payload (passwords, tokens, card data).
        event = AuditEvent(
            actor_type=actor_type,
            actor_id=str(actor_id) if actor_id else None,
            tenant_id=str(tenant_id) if tenant_id else None,
            action=action,
            target=target,
            result=result,
            ip=ip,
            user_agent=user_agent,
            payload=payload or {},
            request_id=get_request_id(),
        )
        await self.writer.write(event)
