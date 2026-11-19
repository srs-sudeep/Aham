"""Data access for categories."""

import uuid

from sqlalchemy import func, or_, select

from platform_kit.db import BaseRepository

from .models import Category


class CategoryRepository(BaseRepository[Category]):
    model = Category

    async def get_in_tenant(self, tenant_id: uuid.UUID, category_id: uuid.UUID) -> Category | None:
        return await self.session.scalar(
            select(Category).where(Category.id == category_id, Category.tenant_id == tenant_id)
        )

    async def get_by_name(self, tenant_id: uuid.UUID, name: str) -> Category | None:
        return await self.session.scalar(select(Category).where(Category.tenant_id == tenant_id, Category.name == name))

    async def search(
        self,
        tenant_id: uuid.UUID,
        *,
        q: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[Category], int]:
        filters = [Category.tenant_id == tenant_id]
        if q:
            like = f"%{q}%"
            filters.append(or_(Category.name.ilike(like), Category.description.ilike(like)))
        total = int(await self.session.scalar(select(func.count()).select_from(Category).where(*filters)) or 0)
        offset = max(page - 1, 0) * page_size
        rows = await self.session.scalars(
            select(Category).where(*filters).order_by(Category.name).offset(offset).limit(page_size)
        )
        return list(rows), total
