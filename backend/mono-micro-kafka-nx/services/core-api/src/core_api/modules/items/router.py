"""HTTP layer only: parse input, check permission, call the service, return a schema."""

import uuid
from typing import Annotated

from fastapi import Query

from core_api.permissions import Resource
from platform_kit import Action, Permission, SecureRouter

from .dependencies import ItemServiceDep
from .schemas import ItemCreate, ItemPage, ItemRead, ItemUpdate

router = SecureRouter(prefix="/items", tags=["items"])


@router.post(
    "",
    permission=Permission(Resource.ITEM, Action.CREATE),
    summary="Create item",
    status_code=201,
)
async def create_item(body: ItemCreate, svc: ItemServiceDep) -> ItemRead:
    return await svc.create(body)


@router.get(
    "",
    permission=Permission(Resource.ITEM, Action.LIST),
    summary="List items",
)
async def list_items(
    svc: ItemServiceDep,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> ItemPage:
    return await svc.list(offset=offset, limit=limit)


@router.get(
    "/{item_id}",
    permission=Permission(Resource.ITEM, Action.READ),
    summary="Get item",
)
async def get_item(item_id: uuid.UUID, svc: ItemServiceDep) -> ItemRead:
    return await svc.get(item_id)


@router.patch(
    "/{item_id}",
    permission=Permission(Resource.ITEM, Action.UPDATE),
    summary="Update item",
)
async def update_item(item_id: uuid.UUID, body: ItemUpdate, svc: ItemServiceDep) -> ItemRead:
    return await svc.update(item_id, body)


@router.delete(
    "/{item_id}",
    permission=Permission(Resource.ITEM, Action.DELETE),
    summary="Delete item",
    status_code=204,
)
async def delete_item(item_id: uuid.UUID, svc: ItemServiceDep) -> None:
    await svc.delete(item_id)
