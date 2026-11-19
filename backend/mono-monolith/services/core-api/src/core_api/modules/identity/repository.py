"""Identity DB queries."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core_api.modules.identity.models import (
    AuditEventRow,
    Invitation,
    Membership,
    Permission,
    Role,
    RolePermission,
    Tenant,
    User,
)
from platform_kit.db import BaseRepository


class IdentityRepository(BaseRepository[User]):
    model = User

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def get_user_by_email(self, email: str) -> User | None:
        return await self.session.scalar(select(User).where(User.email == email.lower()))

    async def get_tenant_by_slug(self, slug: str) -> Tenant | None:
        return await self.session.scalar(select(Tenant).where(Tenant.slug == slug))

    async def get_system_role(self, name: str) -> Role | None:
        return await self.session.scalar(select(Role).where(Role.name == name, Role.tenant_id.is_(None)))

    async def list_memberships(self, user_id: uuid.UUID) -> list[tuple[Membership, Tenant, Role]]:
        rows = await self.session.execute(
            select(Membership, Tenant, Role)
            .join(Tenant, Tenant.id == Membership.tenant_id)
            .join(Role, Role.id == Membership.role_id)
            .where(Membership.user_id == user_id, Membership.status == "active")
        )
        return list(rows.all())

    async def get_membership(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> Membership | None:
        return await self.session.scalar(
            select(Membership).where(
                Membership.user_id == user_id,
                Membership.tenant_id == tenant_id,
                Membership.status == "active",
            )
        )

    async def permissions_for_role(self, role_id: uuid.UUID) -> list[str]:
        rows = await self.session.scalars(
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(RolePermission.role_id == role_id)
        )
        return list(rows)

    async def permissions_for_role_name(self, role_name: str, *, tenant_id: uuid.UUID | None = None) -> list[str]:
        """Resolve grants for a role name: tenant-specific first, then system role."""
        role = None
        if tenant_id is not None:
            role = await self.session.scalar(select(Role).where(Role.name == role_name, Role.tenant_id == tenant_id))
        if role is None:
            role = await self.get_system_role(role_name)
        if role is None:
            return []
        return await self.permissions_for_role(role.id)

    async def list_permissions(self) -> list[Permission]:
        return list(await self.session.scalars(select(Permission).order_by(Permission.code)))

    async def get_permission_by_code(self, code: str) -> Permission | None:
        return await self.session.scalar(select(Permission).where(Permission.code == code))

    async def list_tenant_users(self, tenant_id: uuid.UUID) -> list[tuple[Membership, User, Role]]:
        rows = await self.session.execute(
            select(Membership, User, Role)
            .join(User, User.id == Membership.user_id)
            .join(Role, Role.id == Membership.role_id)
            .where(Membership.tenant_id == tenant_id)
            .order_by(User.email)
        )
        return list(rows.all())

    async def get_tenant_membership(
        self, tenant_id: uuid.UUID, user_id: uuid.UUID
    ) -> tuple[Membership, User, Role] | None:
        return (
            await self.session.execute(
                select(Membership, User, Role)
                .join(User, User.id == Membership.user_id)
                .join(Role, Role.id == Membership.role_id)
                .where(Membership.tenant_id == tenant_id, Membership.user_id == user_id)
            )
        ).one_or_none()

    async def list_roles_for_tenant(self, tenant_id: uuid.UUID) -> list[Role]:
        rows = await self.session.scalars(
            select(Role)
            .where((Role.tenant_id == tenant_id) | (Role.tenant_id.is_(None)))
            .order_by(Role.is_system.desc(), Role.name)
        )
        return list(rows)

    async def get_role(self, role_id: uuid.UUID) -> Role | None:
        return await self.session.get(Role, role_id)

    async def get_role_by_name(self, tenant_id: uuid.UUID, name: str) -> Role | None:
        return await self.session.scalar(select(Role).where(Role.tenant_id == tenant_id, Role.name == name))

    async def count_admin_memberships(self, tenant_id: uuid.UUID) -> int:
        from sqlalchemy import func

        admin = await self.get_system_role("admin")
        if admin is None:
            return 0
        return int(
            await self.session.scalar(
                select(func.count())
                .select_from(Membership)
                .where(
                    Membership.tenant_id == tenant_id,
                    Membership.role_id == admin.id,
                    Membership.status == "active",
                )
            )
            or 0
        )

    async def replace_role_permissions(self, role_id: uuid.UUID, permission_ids: list[uuid.UUID]) -> None:
        from sqlalchemy import delete

        await self.session.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
        await self.session.flush()
        seen: set[uuid.UUID] = set()
        for pid in permission_ids:
            if pid in seen:
                continue
            seen.add(pid)
            self.session.add(RolePermission(role_id=role_id, permission_id=pid))
        await self.session.flush()

    async def count_role_memberships(self, role_id: uuid.UUID) -> int:
        from sqlalchemy import func

        return int(
            await self.session.scalar(select(func.count()).select_from(Membership).where(Membership.role_id == role_id))
            or 0
        )

    async def get_invitation_by_hash(self, token_hash: str) -> Invitation | None:
        return await self.session.scalar(select(Invitation).where(Invitation.token_hash == token_hash))

    async def list_audit(
        self,
        *,
        tenant_id: uuid.UUID,
        since: datetime | None,
        until: datetime | None,
        action: str | None,
        limit: int,
    ) -> list[AuditEventRow]:
        q = select(AuditEventRow).where(AuditEventRow.tenant_id == tenant_id)
        if since:
            q = q.where(AuditEventRow.created_at >= since)
        if until:
            q = q.where(AuditEventRow.created_at <= until)
        if action:
            q = q.where(AuditEventRow.action == action)
        q = q.order_by(AuditEventRow.created_at.desc()).limit(limit)
        return list(await self.session.scalars(q))

    async def add_audit(self, row: AuditEventRow) -> AuditEventRow:
        self.session.add(row)
        await self.session.flush()
        return row
