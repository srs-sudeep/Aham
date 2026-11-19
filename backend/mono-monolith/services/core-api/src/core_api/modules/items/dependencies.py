"""How this module's service is built for one request.

The router depends only on `ItemServiceDep`, so it never sees the session or the
repository; swapping the data source means changing this file alone.
"""

from typing import Annotated

from fastapi import Depends

from platform_kit.db import SessionDep

from .repository import ItemRepository
from .service import ItemService


def get_item_service(session: SessionDep) -> ItemService:
    return ItemService(ItemRepository(session))


ItemServiceDep = Annotated[ItemService, Depends(get_item_service)]
