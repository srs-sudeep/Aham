"""The API contract for this module: what callers may send and what they get back.

Pydantic only. No SQLAlchemy and no FastAPI here, so these schemas stay safe to share
(with `contracts`, with tests, with generated clients) and never leak table structure.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)


class ItemCreate(ItemBase):
    """Body of POST /items."""


class ItemUpdate(BaseModel):
    """Body of PATCH /items/{id}: every field optional, only what is sent is changed."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)


class ItemRead(ItemBase):
    """What the API returns for a single item."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ItemPage(BaseModel):
    """One page of items, plus the window it was taken from."""

    items: list[ItemRead]
    offset: int
    limit: int
