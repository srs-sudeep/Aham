"""Business rules for categories."""

from __future__ import annotations

import uuid
from typing import Self

from sqlalchemy.ext.asyncio import AsyncSession

from .errors import CategoryNameTakenError, CategoryNotFoundError
from .models import Category
from .repository import CategoryRepository
from .schemas import CategoryCreate, CategoryPage, CategoryRead, CategoryUpdate


class CategoryService:
    def __init__(self, repo: CategoryRepository) -> None:
        self.repo = repo

    @classmethod
    def from_session(cls, session: AsyncSession) -> Self:
        return cls(CategoryRepository(session))

    async def create(self, tenant_id: uuid.UUID, data: CategoryCreate) -> CategoryRead:
        if await self.repo.get_by_name(tenant_id, data.name) is not None:
            raise CategoryNameTakenError(detail=f"name={data.name!r} is already taken")
        created = await self.repo.add(Category(tenant_id=tenant_id, **data.model_dump()))
        await self.repo.commit()
        return CategoryRead.model_validate(created)

    async def get(self, tenant_id: uuid.UUID, category_id: uuid.UUID) -> CategoryRead:
        return CategoryRead.model_validate(await self._require(tenant_id, category_id))

    async def list(
        self,
        tenant_id: uuid.UUID,
        *,
        q: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> CategoryPage:
        rows, total = await self.repo.search(tenant_id, q=q, page=page, page_size=page_size)
        return CategoryPage(items=[CategoryRead.model_validate(row) for row in rows], total=total)

    async def update(self, tenant_id: uuid.UUID, category_id: uuid.UUID, data: CategoryUpdate) -> CategoryRead:
        category = await self._require(tenant_id, category_id)
        changes = data.model_dump(exclude_unset=True)
        new_name = changes.get("name")
        if (
            new_name is not None
            and new_name != category.name
            and await self.repo.get_by_name(tenant_id, new_name) is not None
        ):
            raise CategoryNameTakenError(detail=f"name={new_name!r} is already taken")
        for field, value in changes.items():
            setattr(category, field, value)
        await self.repo.commit()
        return CategoryRead.model_validate(category)

    async def delete(self, tenant_id: uuid.UUID, category_id: uuid.UUID) -> None:
        # Items.category_id is ON DELETE SET NULL, so associated items keep working.
        await self.repo.delete(await self._require(tenant_id, category_id))
        await self.repo.commit()

    async def _require(self, tenant_id: uuid.UUID, category_id: uuid.UUID) -> Category:
        found = await self.repo.get_in_tenant(tenant_id, category_id)
        if found is None:
            raise CategoryNotFoundError(detail=f"category_id={category_id}")
        return found
