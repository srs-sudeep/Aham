"""SQLAlchemy tables for this module. Only imports platform_kit.db + sqlalchemy."""

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from platform_kit.db import Base, TenantScopedMixin, Timestamps, UUIDPrimaryKey


class Category(UUIDPrimaryKey, TenantScopedMixin, Timestamps, Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_categories_tenant_name"),)

    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
