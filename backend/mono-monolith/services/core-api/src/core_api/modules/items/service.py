"""Business rules for items: the only layer that decides what is allowed.

No FastAPI here. Signal problems by raising the errors in `errors.py`; platform_kit
turns them into the standard error envelope with the right status code.

Each write use-case ends in exactly one `commit()`, so a half-applied change is
never persisted.
"""

import uuid

from .errors import ItemNameTakenError, ItemNotFoundError
from .models import Item
from .repository import ItemRepository
from .schemas import ItemCreate, ItemPage, ItemRead, ItemUpdate


class ItemService:
    def __init__(self, repo: ItemRepository) -> None:
        self.repo = repo

    async def create(self, data: ItemCreate) -> ItemRead:
        if await self.repo.get_by_name(data.name) is not None:
            raise ItemNameTakenError(detail=f"name={data.name!r} is already taken")
        created = await self.repo.add(Item(**data.model_dump()))
        await self.repo.commit()
        return ItemRead.model_validate(created)

    async def get(self, item_id: uuid.UUID) -> ItemRead:
        return ItemRead.model_validate(await self._require(item_id))

    async def list(self, *, offset: int = 0, limit: int = 50) -> ItemPage:
        rows = await self.repo.list(offset=offset, limit=limit)
        return ItemPage(
            items=[ItemRead.model_validate(row) for row in rows],
            offset=offset,
            limit=limit,
        )

    async def update(self, item_id: uuid.UUID, data: ItemUpdate) -> ItemRead:
        item = await self._require(item_id)
        changes = data.model_dump(exclude_unset=True)
        new_name = changes.get("name")
        if new_name is not None and new_name != item.name and await self.repo.get_by_name(new_name) is not None:
            raise ItemNameTakenError(detail=f"name={new_name!r} is already taken")
        for field, value in changes.items():
            setattr(item, field, value)
        await self.repo.commit()
        return ItemRead.model_validate(item)

    async def delete(self, item_id: uuid.UUID) -> None:
        await self.repo.delete(await self._require(item_id))
        await self.repo.commit()

    async def _require(self, item_id: uuid.UUID) -> Item:
        found = await self.repo.get(item_id)
        if found is None:
            raise ItemNotFoundError(detail=f"item_id={item_id}")
        return found
