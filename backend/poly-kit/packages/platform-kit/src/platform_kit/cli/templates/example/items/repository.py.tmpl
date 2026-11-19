"""Data access for items."""

import uuid

from sqlalchemy import func, or_, select

from platform_kit.db import BaseRepository

from .models import Item


class ItemRepository(BaseRepository[Item]):
    model = Item

    async def get_in_tenant(self, tenant_id: uuid.UUID, item_id: uuid.UUID) -> Item | None:
        return await self.session.scalar(select(Item).where(Item.id == item_id, Item.tenant_id == tenant_id))

    async def get_by_name(self, tenant_id: uuid.UUID, name: str) -> Item | None:
        return await self.session.scalar(select(Item).where(Item.tenant_id == tenant_id, Item.name == name))

    async def get_by_sku(self, tenant_id: uuid.UUID, sku: str) -> Item | None:
        return await self.session.scalar(select(Item).where(Item.tenant_id == tenant_id, Item.sku == sku))

    async def search(
        self,
        tenant_id: uuid.UUID,
        *,
        q: str | None = None,
        status: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Item], int]:
        filters = [Item.tenant_id == tenant_id]
        if status:
            filters.append(Item.status == status)
        if q:
            like = f"%{q}%"
            filters.append(or_(Item.name.ilike(like), Item.sku.ilike(like), Item.description.ilike(like)))
        total = int(await self.session.scalar(select(func.count()).select_from(Item).where(*filters)) or 0)
        offset = max(page - 1, 0) * page_size
        rows = await self.session.scalars(
            select(Item).where(*filters).order_by(Item.name).offset(offset).limit(page_size)
        )
        return list(rows), total
