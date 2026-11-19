"""Billing / entitlements schema."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from platform_kit.db import Base, Timestamps, UUIDPrimaryKey

JsonType = JSON().with_variant(JSONB(), "postgresql")


class Feature(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "features"

    key: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[str] = mapped_column(String(16), default="boolean")  # boolean | quota
    unit: Mapped[str | None] = mapped_column(String(32), nullable=True)


class Plan(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "plans"

    code: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    interval: Mapped[str] = mapped_column(String(16), default="month")  # month | year
    soft_limits: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)


class PlanFeature(UUIDPrimaryKey, Base):
    __tablename__ = "plan_features"
    __table_args__ = (UniqueConstraint("plan_id", "feature_id", name="uq_plan_feature"),)

    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"), index=True)
    feature_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("features.id"), index=True)
    limit_value: Mapped[int | None] = mapped_column(Integer, nullable=True)  # for quotas; null = boolean on


class Subscription(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "subscriptions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"))
    status: Mapped[str] = mapped_column(String(32), default="active")  # trialing|active|past_due|canceled
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    grace_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    external_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)


class EntitlementSnapshotRow(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "entitlement_snapshots"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_entitlement_snapshot_tenant"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    features: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    quotas: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="active")
    grace_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EntitlementOverride(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "entitlement_overrides"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    feature_key: Mapped[str] = mapped_column(String(80))
    enabled: Mapped[bool | None] = mapped_column(nullable=True)
    quota_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
