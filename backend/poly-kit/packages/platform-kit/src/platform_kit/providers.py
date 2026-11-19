"""Phase-2 extension ports. v1 ships stubs so SSO/SCIM/Stripe/email can plug in later."""

from __future__ import annotations

from typing import Any, Protocol
from uuid import UUID


class EmailSender(Protocol):
    async def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None: ...


class LoggingEmailSender:
    """Dev stub: logs the message instead of delivering."""

    async def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None:
        from platform_kit.logging import get_logger

        get_logger("platform_kit.email").info("email_send_stub", to=to, subject=subject, body_preview=body[:200])


class AuthFederator(Protocol):
    """Per-tenant SAML/OIDC (phase 2)."""

    async def start_login(self, tenant_id: UUID, return_to: str) -> str: ...

    async def handle_callback(self, tenant_id: UUID, payload: dict[str, Any]) -> dict[str, Any]: ...


class UnsupportedAuthFederator:
    async def start_login(self, tenant_id: UUID, return_to: str) -> str:
        raise NotImplementedError("SSO federation is phase 2 — configure auth_connections later")

    async def handle_callback(self, tenant_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError("SSO federation is phase 2")


class ScimDirectory(Protocol):
    """Per-tenant SCIM 2.0 (phase 2)."""

    async def upsert_user(self, tenant_id: UUID, scim_user: dict[str, Any]) -> dict[str, Any]: ...

    async def deactivate_user(self, tenant_id: UUID, external_id: str) -> None: ...


class UnsupportedScimDirectory:
    async def upsert_user(self, tenant_id: UUID, scim_user: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError("SCIM is phase 2")

    async def deactivate_user(self, tenant_id: UUID, external_id: str) -> None:
        raise NotImplementedError("SCIM is phase 2")


class PaymentProvider(Protocol):
    """Stripe (or other) adapter — syncs into local entitlement snapshots (phase 2)."""

    async def create_checkout(self, tenant_id: UUID, plan_code: str) -> str: ...

    async def handle_webhook(self, headers: dict[str, str], body: bytes) -> None: ...


class ManualPaymentProvider:
    """v1: admin activates/cancels subscriptions in-app; no external billing."""

    async def create_checkout(self, tenant_id: UUID, plan_code: str) -> str:
        raise NotImplementedError("ManualProvider has no checkout URL — use admin activate API")

    async def handle_webhook(self, headers: dict[str, str], body: bytes) -> None:
        return None
