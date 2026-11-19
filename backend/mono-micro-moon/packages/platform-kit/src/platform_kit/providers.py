"""Extension ports for email, SSO, SCIM, and payments.

v1 used stubs; Phase 2 ships real OIDC / Stripe adapters (see oidc.py, stripe_billing.py).
"""

from __future__ import annotations

from typing import Any, Protocol
from uuid import UUID

from platform_kit.oidc import OidcAuthFederator
from platform_kit.stripe_billing import StripePaymentProvider

__all__ = [
    "AuthFederator",
    "EmailSender",
    "LoggingEmailSender",
    "ManualPaymentProvider",
    "OidcAuthFederator",
    "PaymentProvider",
    "ScimDirectory",
    "StripePaymentProvider",
    "UnsupportedAuthFederator",
    "UnsupportedScimDirectory",
]


class EmailSender(Protocol):
    async def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None: ...


class LoggingEmailSender:
    """Dev stub: logs the message instead of delivering."""

    async def send(self, *, to: str, subject: str, body: str, html: str | None = None) -> None:
        from platform_kit.logging import get_logger

        get_logger("platform_kit.email").info("email_send_stub", to=to, subject=subject, body_preview=body[:200])


class AuthFederator(Protocol):
    async def start_login(self, tenant_id: UUID, return_to: str, *, connection: dict[str, Any], redirect_uri: str) -> str: ...

    async def handle_callback(
        self, *, code: str, state: str, connection: dict[str, Any], redirect_uri: str
    ) -> dict[str, Any]: ...


class UnsupportedAuthFederator:
    async def start_login(self, tenant_id: UUID, return_to: str, *, connection: dict[str, Any], redirect_uri: str) -> str:
        raise NotImplementedError("Configure an OIDC AuthConnection for this tenant")

    async def handle_callback(
        self, *, code: str, state: str, connection: dict[str, Any], redirect_uri: str
    ) -> dict[str, Any]:
        raise NotImplementedError("Configure an OIDC AuthConnection for this tenant")


class ScimDirectory(Protocol):
    async def upsert_user(self, tenant_id: UUID, scim_user: dict[str, Any]) -> dict[str, Any]: ...

    async def deactivate_user(self, tenant_id: UUID, external_id: str) -> None: ...


class UnsupportedScimDirectory:
    async def upsert_user(self, tenant_id: UUID, scim_user: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError("SCIM not wired")

    async def deactivate_user(self, tenant_id: UUID, external_id: str) -> None:
        raise NotImplementedError("SCIM not wired")


class PaymentProvider(Protocol):
    async def create_checkout(self, tenant_id: UUID, plan_code: str) -> str: ...

    async def handle_webhook(self, headers: dict[str, str], body: bytes) -> None: ...


class ManualPaymentProvider:
    """Admin activates/cancels subscriptions in-app; no external billing."""

    async def create_checkout(self, tenant_id: UUID, plan_code: str) -> str:
        raise NotImplementedError("ManualProvider has no checkout URL — use admin activate API")

    async def handle_webhook(self, headers: dict[str, str], body: bytes) -> None:
        return None
