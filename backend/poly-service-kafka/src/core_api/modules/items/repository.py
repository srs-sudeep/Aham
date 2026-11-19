"""Data access for this module: queries only, no business rules.

Inherited CRUD (`get`, `list`, `add`, `delete`, `commit`) comes from BaseRepository.
Add query methods here; `add` and `delete` flush, and the service decides when to
commit, so one use-case stays one transaction.
"""

from sqlalchemy import select

from platform_kit.db import BaseRepository

from .models import Item


class ItemRepository(BaseRepository[Item]):
    model = Item

    async def get_by_name(self, name: str) -> Item | None:
        return await self.session.scalar(select(Item).where(Item.name == name))
