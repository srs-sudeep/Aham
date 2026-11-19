"""Identity business logic: register, login, select/switch tenant, invites, audit."""

from __future__ import annotations

import hashlib
import json
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from core_api.modules.identity.errors import (
    EmailTakenError,
    InvalidCredentialsError,
    InvitationInvalidError,
    LastAdminError,
    MembershipNotFoundError,
    RoleInUseError,
    RoleNameTakenError,
    RoleNotFoundError,
    SlugTakenError,
    SystemRoleImmutableError,
    TenantRequiredError,
    UnknownPermissionError,
    UserDisabledError,
)
from core_api.modules.identity.models import (
    AuditEventRow,
    Invitation,
    Membership,
    Role,
    Tenant,
    User,
)
from core_api.modules.identity.phase2 import Phase2Mixin
from core_api.modules.identity.repository import IdentityRepository
from core_api.modules.identity.schemas import (
    AcceptInviteRequest,
    AuditEventOut,
    CreateRoleRequest,
    InviteRequest,
    LoginRequest,
    PermissionOut,
    RegisterRequest,
    RoleOut,
    SetRolePermissionsRequest,
    TenantMembership,
    TenantSelectionResponse,
    TenantUserOut,
    TokenResponse,
    UpdateRoleRequest,
    UpdateTenantUserRequest,
)
from platform_kit.audit import Audit, AuditEvent
from platform_kit.config import ServiceSettings
from platform_kit.errors import expect
from platform_kit.providers import EmailSender, LoggingEmailSender
from platform_kit.redis import RedisClient
from platform_kit.security import TokenIssuer, TokenPair

_ph = PasswordHasher()


class IdentityService(Phase2Mixin):
    def __init__(
        self,
        repo: IdentityRepository,
        *,
        settings: ServiceSettings,
        issuer: TokenIssuer,
        redis: RedisClient,
        audit: Audit | None = None,
        email: EmailSender | None = None,
        permission_resolver: object | None = None,
    ) -> None:
        self.repo = repo
        self.settings = settings
        self.issuer = issuer
        self.redis = redis
        self.audit = audit or Audit()
        self.email = email or LoggingEmailSender()
        self.permission_resolver = permission_resolver

    async def seed_system(self) -> None:
        """Idempotent seed of system roles/permissions from ROLE_PERMISSIONS."""
        from core_api.modules.identity.models import RolePermission
        from core_api.permissions import ROLE_PERMISSIONS

        await self._ensure_permission_catalog(ROLE_PERMISSIONS)
        existing = await self.repo.get_system_role("admin")
        if existing:
            return
        perm_ids = {p.code: p.id for p in await self.repo.list_permissions()}
        for name, codes in ROLE_PERMISSIONS.items():
            role = Role(name=name, tenant_id=None, is_system=True)
            self.repo.session.add(role)
            await self.repo.session.flush()
            for code in codes:
                self.repo.session.add(RolePermission(role_id=role.id, permission_id=perm_ids[code]))
        await self.repo.commit()

    async def _ensure_permission_catalog(self, role_permissions: dict[str, list[str]]) -> None:
        """Upsert ROLE_PERMISSIONS codes plus every Resource x Action into the permissions table."""
        from core_api.modules.identity.models import Permission
        from core_api.permissions import Resource
        from platform_kit import Action

        existing = {p.code: p for p in await self.repo.list_permissions()}
        codes = {"*"}
        for grants in role_permissions.values():
            codes.update(grants)
        for resource in Resource:
            if resource.name.startswith("_"):
                continue
            for action in Action:
                codes.add(f"{resource.value}:{action.value}")
        added = False
        for code in sorted(codes):
            if code in existing:
                continue
            self.repo.session.add(Permission(code=code, description=code if code != "*" else "Superuser"))
            added = True
        if added:
            await self.repo.session.flush()
            await self.repo.commit()

    async def register(self, body: RegisterRequest, *, ip: str | None = None) -> TokenResponse:
        if await self.repo.get_user_by_email(body.email):
            raise EmailTakenError()
        if await self.repo.get_tenant_by_slug(body.tenant_slug):
            raise SlugTakenError()
        await self.seed_system()
        admin_role = expect(await self.repo.get_system_role("admin"), "admin_role")
        user = User(email=body.email.lower(), password_hash=_ph.hash(body.password), status="active")
        tenant = Tenant(slug=body.tenant_slug, name=body.tenant_name, status="active", region="us")
        self.repo.session.add_all([user, tenant])
        await self.repo.session.flush()
        self.repo.session.add(Membership(user_id=user.id, tenant_id=tenant.id, role_id=admin_role.id, status="active"))
        await self.repo.commit()
        await self.audit.record("auth.register", actor_id=user.id, tenant_id=tenant.id, ip=ip)
        return await self._issue_for_membership(user, tenant.id, admin_role)

    async def login(self, body: LoginRequest, *, ip: str | None = None) -> TokenResponse | TenantSelectionResponse:
        user = await self.repo.get_user_by_email(body.email)
        if user is None or not user.password_hash:
            await self.audit.record("auth.login.failure", actor_id=body.email, result="failure", ip=ip)
            raise InvalidCredentialsError()
        try:
            _ph.verify(user.password_hash, body.password)
        except VerifyMismatchError as exc:
            await self.audit.record("auth.login.failure", actor_id=user.id, result="failure", ip=ip)
            raise InvalidCredentialsError() from exc
        if user.status == "disabled":
            raise UserDisabledError()
        if user.mfa_enabled:
            from sqlalchemy import select

            from core_api.modules.identity.models import UserMfa
            from core_api.modules.identity.schemas import MfaRequiredResponse
            from platform_kit.mfa import require_totp

            if not body.mfa_code:
                token = secrets.token_urlsafe(24)
                await self.redis.set(f"mfa_pending:{token}", str(user.id), ex=300)
                return MfaRequiredResponse(mfa_token=token)  # type: ignore[return-value]
            mfa = await self.repo.session.scalar(select(UserMfa).where(UserMfa.user_id == user.id))
            if mfa is None or not mfa.confirmed:
                raise InvalidCredentialsError(detail="mfa not configured")
            require_totp(mfa.totp_secret, body.mfa_code)
        memberships = await self.repo.list_memberships(user.id)
        if not memberships:
            raise TenantRequiredError(detail="user has no tenant memberships")
        if len(memberships) == 1:
            _, tenant, role = memberships[0]
            await self.audit.record("auth.login.success", actor_id=user.id, tenant_id=tenant.id, ip=ip)
            return await self._issue_for_membership(user, tenant.id, role)
        session = secrets.token_urlsafe(32)
        await self.redis.set(
            f"login_session:{session}",
            json.dumps({"sub": str(user.id), "ver": user.token_version}),
            ex=300,
        )
        return TenantSelectionResponse(
            session_token=session,
            tenants=[
                TenantMembership(tenant_id=t.id, slug=t.slug, name=t.name, role=r.name) for _, t, r in memberships
            ],
        )

    async def select_tenant(self, session_token: str, tenant_id: UUID, *, ip: str | None = None) -> TokenResponse:
        raw = await self.redis.get(f"login_session:{session_token}")
        if not raw:
            raise InvalidCredentialsError(detail="login session expired")
        data = json.loads(raw)
        await self.redis.delete(f"login_session:{session_token}")
        user = await self.repo.get(UUID(data["sub"]))
        if user is None:
            raise InvalidCredentialsError()
        return await self._switch(user, tenant_id, ip=ip, action="auth.select_tenant")

    async def switch_tenant(self, user_id: UUID, tenant_id: UUID, *, ip: str | None = None) -> TokenResponse:
        user = await self.repo.get(user_id)
        if user is None:
            raise InvalidCredentialsError()
        return await self._switch(user, tenant_id, ip=ip, action="auth.switch_tenant")

    async def refresh(self, refresh_token: str) -> TokenResponse:
        sub, tid, ver, family = await self.issuer.rotate_refresh(refresh_token)
        user = await self.repo.get(UUID(sub))
        if user is None or user.status == "disabled" or user.token_version != ver:
            await self.issuer.revoke_family(family)
            raise InvalidCredentialsError(detail="refresh rejected")
        role_row = await self.repo.get_membership(user.id, UUID(tid))
        if role_row is None:
            raise MembershipNotFoundError()
        role = expect(await self.repo.session.get(Role, role_row.role_id), "role")
        pair = await self.issuer.issue_pair(
            sub=str(user.id),
            tid=tid,
            roles=[role.name],
            permissions=await self._perms(role),
            ver=user.token_version,
            family=family,
        )
        return _pair_to_response(pair)

    async def logout(self, refresh_token: str | None, user_id: UUID | None) -> None:
        if refresh_token:
            await self.issuer.revoke_refresh(refresh_token)
        if user_id:
            await self.audit.record("auth.logout", actor_id=user_id)

    async def invite(self, tenant_id: UUID, actor_id: UUID, body: InviteRequest, *, ip: str | None = None) -> str:
        role = (
            await self.repo.get_role_by_name(tenant_id, body.role)
            or await self.repo.get_system_role(body.role)
            or await self.repo.get_system_role("member")
        )
        if role is None:
            await self.seed_system()
            role = (
                await self.repo.get_role_by_name(tenant_id, body.role)
                or await self.repo.get_system_role(body.role)
                or await self.repo.get_system_role("member")
            )
        role = expect(role, "role")
        raw = secrets.token_urlsafe(32)
        inv = Invitation(
            email=body.email.lower(),
            tenant_id=tenant_id,
            role_id=role.id,
            token_hash=_hash(raw),
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
        self.repo.session.add(inv)
        await self.repo.commit()
        await self.email.send(
            to=body.email,
            subject="You are invited",
            body=f"Accept invite with token: {raw}",
        )
        await self.audit.record(
            "identity.invite.create",
            actor_id=actor_id,
            tenant_id=tenant_id,
            target=body.email,
            ip=ip,
        )
        return raw

    async def accept_invite(self, body: AcceptInviteRequest, *, ip: str | None = None) -> TokenResponse:
        inv = await self.repo.get_invitation_by_hash(_hash(body.token))
        if inv is None or inv.accepted_at or inv.expires_at < datetime.now(UTC):
            raise InvitationInvalidError()
        user = await self.repo.get_user_by_email(inv.email)
        if user is None:
            user = User(email=inv.email, password_hash=_ph.hash(body.password), status="active")
            self.repo.session.add(user)
            await self.repo.session.flush()
        elif not user.password_hash:
            user.password_hash = _ph.hash(body.password)
            user.status = "active"
        existing = await self.repo.get_membership(user.id, inv.tenant_id)
        if existing is None:
            self.repo.session.add(
                Membership(user_id=user.id, tenant_id=inv.tenant_id, role_id=inv.role_id, status="active")
            )
        inv.accepted_at = datetime.now(UTC)
        await self.repo.commit()
        role = expect(await self.repo.session.get(Role, inv.role_id), "role")
        await self.audit.record("identity.invite.accept", actor_id=user.id, tenant_id=inv.tenant_id, ip=ip)
        return await self._issue_for_membership(user, inv.tenant_id, role)

    async def disable_user(self, tenant_id: UUID, actor_id: UUID, user_id: UUID) -> None:
        membership = await self.repo.get_membership(user_id, tenant_id)
        if membership is None:
            raise MembershipNotFoundError()
        user = await self.repo.get(user_id)
        if user is None:
            raise MembershipNotFoundError()
        user.status = "disabled"
        user.token_version += 1
        await self.redis.set(f"token_ver:{user.id}", str(user.token_version), ex=60 * 60 * 24 * 365)
        await self.repo.commit()
        await self.audit.record(
            "identity.user.disable",
            actor_id=actor_id,
            tenant_id=tenant_id,
            target=str(user_id),
        )

    async def list_tenants(self, user_id: UUID) -> list[TenantMembership]:
        rows = await self.repo.list_memberships(user_id)
        return [TenantMembership(tenant_id=t.id, slug=t.slug, name=t.name, role=r.name) for _, t, r in rows]

    async def export_audit(
        self,
        tenant_id: UUID,
        *,
        since: datetime | None,
        until: datetime | None,
        action: str | None,
        limit: int,
    ) -> list[AuditEventOut]:
        rows = await self.repo.list_audit(tenant_id=tenant_id, since=since, until=until, action=action, limit=limit)
        return [
            AuditEventOut(
                id=r.id,
                actor_type=r.actor_type,
                actor_id=r.actor_id,
                tenant_id=r.tenant_id,
                action=r.action,
                target=r.target,
                result=r.result,
                created_at=r.created_at,
                request_id=r.request_id,
            )
            for r in rows
        ]

    async def write_audit_row(self, event: AuditEvent) -> None:
        row = AuditEventRow(
            actor_type=event.actor_type,
            actor_id=event.actor_id,
            tenant_id=UUID(event.tenant_id) if event.tenant_id else None,
            action=event.action,
            target=event.target,
            result=event.result,
            ip=event.ip,
            user_agent=event.user_agent,
            payload=event.payload,
            request_id=event.request_id,
            created_at=event.created_at,
        )
        await self.repo.add_audit(row)
        await self.repo.commit()

    async def _switch(self, user: User, tenant_id: UUID, *, ip: str | None, action: str) -> TokenResponse:
        membership = await self.repo.get_membership(user.id, tenant_id)
        if membership is None:
            raise MembershipNotFoundError()
        role = expect(await self.repo.session.get(Role, membership.role_id), "role")
        await self.audit.record(action, actor_id=user.id, tenant_id=tenant_id, ip=ip)
        return await self._issue_for_membership(user, tenant_id, role)

    async def _issue_for_membership(self, user: User, tenant_id: UUID, role: Role) -> TokenResponse:
        perms = await self._perms(role)
        pair = await self.issuer.issue_pair(
            sub=str(user.id),
            tid=tenant_id,
            roles=[role.name],
            permissions=perms,
            ver=user.token_version,
        )
        return _pair_to_response(pair)

    async def _perms(self, role: Role) -> list[str]:
        codes = await self.repo.permissions_for_role(role.id)
        if "*" in codes:
            return ["*"]
        return codes

    async def _invalidate_role_cache(self, role_name: str) -> None:
        resolver = self.permission_resolver
        if resolver is not None and hasattr(resolver, "invalidate"):
            await resolver.invalidate(role_name)  # type: ignore[misc]

    async def list_tenant_users(self, tenant_id: UUID) -> list[TenantUserOut]:
        rows = await self.repo.list_tenant_users(tenant_id)
        return [
            TenantUserOut(
                user_id=user.id,
                email=user.email,
                status=user.status,
                membership_status=membership.status,
                role_id=role.id,
                role=role.name,
            )
            for membership, user, role in rows
        ]

    async def get_tenant_user(self, tenant_id: UUID, user_id: UUID) -> TenantUserOut:
        row = await self.repo.get_tenant_membership(tenant_id, user_id)
        if row is None:
            raise MembershipNotFoundError(detail=f"user_id={user_id}")
        membership, user, role = row
        return TenantUserOut(
            user_id=user.id,
            email=user.email,
            status=user.status,
            membership_status=membership.status,
            role_id=role.id,
            role=role.name,
        )

    async def update_tenant_user(self, tenant_id: UUID, user_id: UUID, body: UpdateTenantUserRequest) -> TenantUserOut:
        row = await self.repo.get_tenant_membership(tenant_id, user_id)
        if row is None:
            raise MembershipNotFoundError(detail=f"user_id={user_id}")
        membership, _user, role = row
        if body.role is not None and body.role != role.name:
            new_role = await self.repo.get_system_role(body.role) or await self.repo.get_role_by_name(
                tenant_id, body.role
            )
            if new_role is None:
                raise RoleNotFoundError(detail=f"role={body.role}")
            if (
                role.name == "admin"
                and new_role.name != "admin"
                and await self.repo.count_admin_memberships(tenant_id) <= 1
            ):
                raise LastAdminError()
            membership.role_id = new_role.id
            role = new_role
        if body.membership_status is not None:
            if (
                membership.status == "active"
                and body.membership_status != "active"
                and role.name == "admin"
                and await self.repo.count_admin_memberships(tenant_id) <= 1
            ):
                raise LastAdminError()
            membership.status = body.membership_status
        await self.repo.commit()
        return await self.get_tenant_user(tenant_id, user_id)

    async def list_roles(self, tenant_id: UUID) -> list[RoleOut]:
        roles = await self.repo.list_roles_for_tenant(tenant_id)
        out: list[RoleOut] = []
        for role in roles:
            out.append(  # noqa: PERF401 — await inside loop
                RoleOut(
                    id=role.id,
                    name=role.name,
                    is_system=role.is_system,
                    tenant_id=role.tenant_id,
                    permissions=await self.repo.permissions_for_role(role.id),
                )
            )
        return out

    async def get_role(self, tenant_id: UUID, role_id: UUID) -> RoleOut:
        role = await self._require_visible_role(tenant_id, role_id)
        return RoleOut(
            id=role.id,
            name=role.name,
            is_system=role.is_system,
            tenant_id=role.tenant_id,
            permissions=await self.repo.permissions_for_role(role.id),
        )

    async def create_role(self, tenant_id: UUID, body: CreateRoleRequest) -> RoleOut:
        if await self.repo.get_system_role(body.name) or await self.repo.get_role_by_name(tenant_id, body.name):
            raise RoleNameTakenError(detail=f"name={body.name}")
        role = Role(name=body.name, tenant_id=tenant_id, is_system=False)
        self.repo.session.add(role)
        await self.repo.session.flush()
        await self._set_role_permission_codes(role, body.permissions)
        await self.repo.commit()
        await self._invalidate_role_cache(role.name)
        return await self.get_role(tenant_id, role.id)

    async def update_role(self, tenant_id: UUID, role_id: UUID, body: UpdateRoleRequest) -> RoleOut:
        role = await self._require_tenant_role(tenant_id, role_id)
        if role.is_system:
            raise SystemRoleImmutableError()
        if body.name is not None and body.name != role.name:
            if await self.repo.get_system_role(body.name) or await self.repo.get_role_by_name(tenant_id, body.name):
                raise RoleNameTakenError(detail=f"name={body.name}")
            old = role.name
            role.name = body.name
            await self.repo.commit()
            await self._invalidate_role_cache(old)
            await self._invalidate_role_cache(role.name)
        return await self.get_role(tenant_id, role.id)

    async def delete_role(self, tenant_id: UUID, role_id: UUID) -> None:
        role = await self._require_tenant_role(tenant_id, role_id)
        if role.is_system:
            raise SystemRoleImmutableError()
        if await self.repo.count_role_memberships(role.id):
            raise RoleInUseError(detail=f"role_id={role_id}")
        name = role.name
        await self.repo.session.delete(role)
        await self.repo.commit()
        await self._invalidate_role_cache(name)

    async def set_role_permissions(self, tenant_id: UUID, role_id: UUID, body: SetRolePermissionsRequest) -> RoleOut:
        # System roles are shared across tenants — customize by creating a tenant role.
        role = await self._require_tenant_role(tenant_id, role_id)
        await self._set_role_permission_codes(role, body.permissions)
        await self.repo.commit()
        await self._invalidate_role_cache(role.name)
        return await self.get_role(tenant_id, role.id)

    async def list_permission_catalog(self) -> list[PermissionOut]:
        from core_api.permissions import ROLE_PERMISSIONS

        await self._ensure_permission_catalog(ROLE_PERMISSIONS)
        return [PermissionOut(code=p.code, description=p.description) for p in await self.repo.list_permissions()]

    async def _set_role_permission_codes(self, role: Role, codes: list[str]) -> None:
        permission_ids: list[UUID] = []
        for code in codes:
            perm = await self.repo.get_permission_by_code(code)
            if perm is None:
                raise UnknownPermissionError(detail=f"unknown permission {code}")
            permission_ids.append(perm.id)
        await self.repo.replace_role_permissions(role.id, permission_ids)

    async def _require_visible_role(self, tenant_id: UUID, role_id: UUID) -> Role:
        role = await self.repo.get_role(role_id)
        if role is None or (role.tenant_id is not None and role.tenant_id != tenant_id):
            raise RoleNotFoundError(detail=f"role_id={role_id}")
        return role

    async def _require_tenant_role(self, tenant_id: UUID, role_id: UUID) -> Role:
        role = await self._require_visible_role(tenant_id, role_id)
        if role.tenant_id != tenant_id:
            raise SystemRoleImmutableError()
        return role


def _pair_to_response(pair: TokenPair) -> TokenResponse:
    return TokenResponse(
        access_token=pair.access_token,
        refresh_token=pair.refresh_token,
        expires_in=pair.expires_in,
        tenant_id=UUID(pair.tenant_id) if pair.tenant_id else None,
    )


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
