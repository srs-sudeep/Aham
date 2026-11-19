"""API contract for items (matches the SPA catalog feature)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ItemStatus = Literal["draft", "active", "inactive"]


class ItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    sku: str = Field(min_length=1, max_length=64)
    status: ItemStatus = "draft"
    category_id: uuid.UUID | None = None
    price: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    description: str | None = Field(default=None, max_length=10_000)


class ItemCreate(ItemBase):
    """Body of POST /items."""


class ItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    sku: str | None = Field(default=None, min_length=1, max_length=64)
    status: ItemStatus | None = None
    category_id: uuid.UUID | None = None
    price: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    description: str | None = Field(default=None, max_length=10_000)


class ItemRead(ItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ItemPage(BaseModel):
    items: list[ItemRead]
    total: int
