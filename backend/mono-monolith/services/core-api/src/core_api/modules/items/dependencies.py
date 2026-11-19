"""How this module's service is built for one request."""

from typing import Annotated

from fastapi import Depends

from core_api.modules.categories.service import CategoryService
from platform_kit.db import SessionDep

from .repository import ItemRepository
from .service import ItemService


def get_item_service(session: SessionDep) -> ItemService:
    return ItemService(ItemRepository(session), CategoryService.from_session(session))


ItemServiceDep = Annotated[ItemService, Depends(get_item_service)]
