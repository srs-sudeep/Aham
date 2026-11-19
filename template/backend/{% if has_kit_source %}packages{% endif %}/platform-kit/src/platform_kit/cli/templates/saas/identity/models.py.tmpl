"""Identity schema: users, tenants, memberships, roles, invites, audit, SSO stubs."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from platform_kit.db import Base, Timestamps, UUIDPrimaryKey

JsonType = JSON().with_variant(JSONB(), "postgresql")


class Tenant(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "tenants"

    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(32), default="active")  # active | suspended
    region: Mapped[str | None] = mapped_column(String(32), nullable=True)


class User(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")  # active | disabled | invited
    token_version: Mapped[int] = mapped_column(Integer, default=0)


class Role(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_roles_tenant_name"),)

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(80))
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)


class Permission(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(120), unique=True)  # resource:action
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class RolePermission(UUIDPrimaryKey, Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"), index=True)
    permission_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("permissions.id"), index=True)


class Membership(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "tenant_id", name="uq_membership_user_tenant"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"))
    status: Mapped[str] = mapped_column(String(32), default="active")  # active | invited | revoked


class Invitation(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "invitations"

    email: Mapped[str] = mapped_column(String(320), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuthConnection(UUIDPrimaryKey, Timestamps, Base):
    """Phase-2 SSO: per-tenant SAML/OIDC connection metadata (unused in v1)."""

    __tablename__ = "auth_connections"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    type: Mapped[str] = mapped_column(String(16))  # saml | oidc
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)


class AuditEventRow(UUIDPrimaryKey, Base):
    __tablename__ = "audit_events"

    actor_type: Mapped[str] = mapped_column(String(32))
    actor_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    target: Mapped[str | None] = mapped_column(String(255), nullable=True)
    result: Mapped[str] = mapped_column(String(32), default="success")
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
