"""Phase 2: OIDC SSO, SCIM, API keys, MFA — base class of IdentityService."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import select

from core_api.modules.identity.errors import InvalidCredentialsError, MembershipNotFoundError, UserDisabledError
from core_api.modules.identity.models import (
    ApiKey,
    AuthConnection,
    Membership,
    Role,
    ScimToken,
    User,
    UserMfa,
)
from core_api.modules.identity.schemas import (
    CreateApiKeyResponse,
    MfaEnrollResponse,
    ScimTokenResponse,
    SsoLoginResult,
    SsoStartResponse,
    TokenResponse,
    UpsertOidcConnectionRequest,
)
from platform_kit.api_keys import hash_api_key, issue_api_key
from platform_kit.errors import expect
from platform_kit.mfa import generate_recovery_codes, generate_totp_secret, provisioning_uri, require_totp
from platform_kit.oidc import OidcAuthFederator
from platform_kit.security import Principal

if TYPE_CHECKING:
    from core_api.modules.identity.repository import IdentityRepository
    from platform_kit.audit import Audit
    from platform_kit.config import ServiceSettings
    from platform_kit.redis import RedisClient


class Phase2Mixin:
    """SSO / SCIM / API keys / MFA. `IdentityService` inherits this and provides the state below."""

    repo: IdentityRepository
    settings: ServiceSettings
    redis: RedisClient
    audit: Audit

    async def _issue_for_membership(self, user: User, tenant_id: UUID, role: Role) -> TokenResponse:
        raise NotImplementedError

    async def _perms(self, role: Role) -> list[str]:
        raise NotImplementedError

    async def complete_mfa(self, mfa_token: str, code: str, *, ip: str | None = None) -> TokenResponse:
        uid = await self.redis.get(f"mfa_pending:{mfa_token}")
        if not uid:
            raise InvalidCredentialsError(detail="mfa session expired")
        await self.redis.delete(f"mfa_pending:{mfa_token}")
        user = await self.repo.get(UUID(uid))
        if user is None:
            raise InvalidCredentialsError()
        mfa = await self.repo.session.scalar(select(UserMfa).where(UserMfa.user_id == user.id))
        if mfa is None:
            raise InvalidCredentialsError(detail="mfa missing")
        require_totp(mfa.totp_secret, code)
        memberships = await self.repo.list_memberships(user.id)
        if not memberships:
            raise MembershipNotFoundError()
        _, tenant, role = memberships[0]
        await self.audit.record("auth.mfa.success", actor_id=user.id, tenant_id=tenant.id, ip=ip)
        return await self._issue_for_membership(user, tenant.id, role)

    async def enroll_mfa(self, user_id: UUID) -> MfaEnrollResponse:
        user = await self.repo.get(user_id)
        if user is None:
            raise InvalidCredentialsError()
        secret = generate_totp_secret()
        codes = generate_recovery_codes()
        existing = await self.repo.session.scalar(select(UserMfa).where(UserMfa.user_id == user_id))
        if existing:
            existing.totp_secret = secret
            existing.recovery_hashes = [_sha256(c) for c in codes]
            existing.confirmed = False
        else:
            self.repo.session.add(
                UserMfa(
                    user_id=user_id,
                    totp_secret=secret,
                    recovery_hashes=[_sha256(c) for c in codes],
                    confirmed=False,
                )
            )
        await self.repo.commit()
        return MfaEnrollResponse(
            secret=secret,
            provisioning_uri=provisioning_uri(secret=secret, email=user.email, issuer=self.settings.mfa_issuer),
            recovery_codes=codes,
        )

    async def confirm_mfa(self, user_id: UUID, code: str) -> None:
        mfa = await self.repo.session.scalar(select(UserMfa).where(UserMfa.user_id == user_id))
        if mfa is None:
            raise InvalidCredentialsError(detail="enroll first")
        require_totp(mfa.totp_secret, code)
        mfa.confirmed = True
        user = await self.repo.get(user_id)
        if user:
            user.mfa_enabled = True
        await self.repo.commit()
        await self.audit.record("auth.mfa.enrolled", actor_id=user_id)

    async def upsert_oidc_connection(self, tenant_id: UUID, body: UpsertOidcConnectionRequest) -> None:
        row = await self.repo.session.scalar(
            select(AuthConnection).where(AuthConnection.tenant_id == tenant_id, AuthConnection.type == "oidc")
        )
        meta = body.model_dump()
        enabled = meta.pop("enabled", True)
        if row is None:
            self.repo.session.add(AuthConnection(tenant_id=tenant_id, type="oidc", metadata_json=meta, enabled=enabled))
        else:
            row.metadata_json = meta
            row.enabled = enabled
        await self.repo.commit()

    async def sso_start(self, tenant_slug: str, return_to: str) -> SsoStartResponse:
        tenant = await self.repo.get_tenant_by_slug(tenant_slug)
        if tenant is None:
            raise MembershipNotFoundError(detail="tenant not found")
        conn = await self.repo.session.scalar(
            select(AuthConnection).where(
                AuthConnection.tenant_id == tenant.id,
                AuthConnection.type == "oidc",
                AuthConnection.enabled.is_(True),
            )
        )
        if conn is None:
            raise InvalidCredentialsError(detail="OIDC not configured for tenant")
        redirect = self.settings.oidc_redirect_uri or "http://localhost:8001/api/v1/auth/sso/callback"
        fed = OidcAuthFederator(self.redis)
        url = await fed.start_login(tenant.id, return_to, connection=conn.metadata_json, redirect_uri=redirect)
        return SsoStartResponse(authorize_url=url)

    async def sso_callback(self, code: str, state: str, *, ip: str | None = None) -> SsoLoginResult:
        # Resolve tenant from state first (stored as tenant|return_to)
        raw = await self.redis.get(f"oidc_state:{state}")
        if not raw:
            raise InvalidCredentialsError(detail="sso state expired")
        tenant_part, _, return_to = raw.partition("|")
        tenant_id = UUID(tenant_part)
        conn = await self.repo.session.scalar(
            select(AuthConnection).where(AuthConnection.tenant_id == tenant_id, AuthConnection.type == "oidc")
        )
        if conn is None:
            raise InvalidCredentialsError(detail="OIDC connection missing")
        redirect = self.settings.oidc_redirect_uri or "http://localhost:8001/api/v1/auth/sso/callback"
        fed = OidcAuthFederator(self.redis)
        info = await fed.handle_callback(code=code, state=state, connection=conn.metadata_json, redirect_uri=redirect)
        email = info["email"]
        user = await self.repo.get_user_by_email(email)
        if user is None:
            user = User(email=email, password_hash=None, status="active", external_sub=info["external_sub"])
            self.repo.session.add(user)
            await self.repo.session.flush()
        elif user.status == "disabled":
            raise UserDisabledError()
        else:
            user.external_sub = info["external_sub"]
        membership = await self.repo.get_membership(user.id, tenant_id)
        if membership is None:
            role = expect(await self.repo.get_system_role("member"), "role")
            self.repo.session.add(Membership(user_id=user.id, tenant_id=tenant_id, role_id=role.id, status="active"))
            await self.repo.session.flush()
            membership = await self.repo.get_membership(user.id, tenant_id)
        membership = expect(membership, "membership")
        role = expect(await self.repo.session.get(Role, membership.role_id), "role")
        await self.repo.commit()
        await self.audit.record("auth.sso.success", actor_id=user.id, tenant_id=tenant_id, ip=ip)
        tokens = await self._issue_for_membership(user, tenant_id, role)
        return SsoLoginResult(tokens=tokens, return_to=_safe_return_to(return_to))

    async def create_api_key(self, tenant_id: UUID, name: str, role_name: str) -> CreateApiKeyResponse:
        role = expect(await self.repo.get_system_role(role_name) or await self.repo.get_system_role("member"), "role")
        issued = issue_api_key()
        row = ApiKey(
            tenant_id=tenant_id,
            name=name,
            prefix=issued.prefix,
            key_hash=issued.hash,
            role_id=role.id,
        )
        self.repo.session.add(row)
        await self.repo.commit()
        await self.audit.record("identity.api_key.create", tenant_id=tenant_id, target=name)
        return CreateApiKeyResponse(id=row.id, name=name, prefix=issued.prefix, raw_key=issued.raw)

    async def revoke_api_key(self, tenant_id: UUID, key_id: UUID) -> None:
        row = await self.repo.session.get(ApiKey, key_id)
        if row is None or row.tenant_id != tenant_id:
            raise MembershipNotFoundError(detail="api key not found")
        row.revoked_at = datetime.now(UTC)
        await self.repo.commit()

    async def lookup_api_key(self, raw: str) -> Principal:
        digest = hash_api_key(raw)
        row = await self.repo.session.scalar(select(ApiKey).where(ApiKey.key_hash == digest))
        if row is None or row.revoked_at is not None:
            raise InvalidCredentialsError(detail="invalid api key")
        # constant-time compare already via hash lookup uniqueness
        role = expect(await self.repo.session.get(Role, row.role_id), "role")
        perms = await self._perms(role)
        return Principal(
            sub=f"key:{row.id}",
            tid=str(row.tenant_id),
            roles=[role.name],
            permissions=frozenset(perms),
            kind="api_key",
        )

    async def issue_scim_token(self, tenant_id: UUID) -> ScimTokenResponse:
        issued = issue_api_key(prefix="scim")
        existing = await self.repo.session.scalar(select(ScimToken).where(ScimToken.tenant_id == tenant_id))
        if existing:
            existing.token_hash = issued.hash
            existing.prefix = issued.prefix
        else:
            self.repo.session.add(ScimToken(tenant_id=tenant_id, token_hash=issued.hash, prefix=issued.prefix))
        await self.repo.commit()
        return ScimTokenResponse(prefix=issued.prefix, raw_token=issued.raw)

    async def resolve_scim_tenant(self, bearer: str) -> UUID:
        digest = hash_api_key(bearer)
        row = await self.repo.session.scalar(select(ScimToken).where(ScimToken.token_hash == digest))
        if row is None:
            raise InvalidCredentialsError(detail="invalid scim token")
        return row.tenant_id

    async def scim_upsert_user(self, tenant_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        emails = payload.get("emails") or []
        email = None
        for e in emails:
            if e.get("primary") or not email:
                email = (e.get("value") or "").lower()
        if not email:
            email = (payload.get("userName") or "").lower()
        if not email:
            raise InvalidCredentialsError(detail="SCIM user missing email")
        external_id = str(payload.get("id") or payload.get("externalId") or email)
        active = payload.get("active", True)
        user = await self.repo.get_user_by_email(email)
        if user is None:
            user = User(
                email=email,
                password_hash=None,
                status="active" if active else "disabled",
                external_sub=external_id,
            )
            self.repo.session.add(user)
            await self.repo.session.flush()
        else:
            user.external_sub = external_id
            user.status = "active" if active else "disabled"
        membership = await self.repo.get_membership(user.id, tenant_id)
        if membership is None and active:
            role = expect(await self.repo.get_system_role("member"), "role")
            self.repo.session.add(Membership(user_id=user.id, tenant_id=tenant_id, role_id=role.id, status="active"))
        elif membership is not None and not active:
            membership.status = "revoked"
            user.token_version += 1
        await self.repo.commit()
        await self.audit.record("identity.scim.upsert", tenant_id=tenant_id, target=email)
        return {
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
            "id": str(user.id),
            "userName": email,
            "active": active,
            "emails": [{"value": email, "primary": True}],
        }

    async def scim_deactivate(self, tenant_id: UUID, user_id: str) -> None:
        user = await self.repo.get(UUID(user_id))
        if user is None:
            raise MembershipNotFoundError()
        user.status = "disabled"
        user.token_version += 1
        membership = await self.repo.get_membership(user.id, tenant_id)
        if membership:
            membership.status = "revoked"
        await self.repo.commit()
        await self.audit.record("identity.scim.deactivate", tenant_id=tenant_id, target=user_id)


def _sha256(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _safe_return_to(value: str) -> str:
    """Only same-app relative paths; never an open redirect."""
    return value if value.startswith("/") and not value.startswith("//") else "/"
