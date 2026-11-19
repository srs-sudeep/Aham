"""SQLAlchemy tables for this module. Only imports platform_kit.db + sqlalchemy."""

import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from platform_kit.db import Base, TenantScopedMixin, Timestamps, UUIDPrimaryKey


class Item(UUIDPrimaryKey, TenantScopedMixin, Timestamps, Base):
    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_items_tenant_name"),
        UniqueConstraint("tenant_id", "sku", name="uq_items_tenant_sku"),
    )

    name: Mapped[str] = mapped_column(String(200))
    sku: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="draft")  # draft | active | inactive
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    description: Mapped[str | None] = mapped_column(Text)
