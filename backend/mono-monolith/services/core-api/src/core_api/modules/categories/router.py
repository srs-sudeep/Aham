"""HTTP layer for categories."""

import uuid
from typing import Annotated

from fastapi import Depends, Query

from core_api.permissions import Resource
from platform_kit import Action, Permission, SecureRouter
from platform_kit.entitlements import require_feature
from platform_kit.tenancy import TenantIdDep

from .dependencies import CategoryServiceDep
from .schemas import CategoryCreate, CategoryPage, CategoryRead, CategoryUpdate

router = SecureRouter(prefix="/categories", tags=["categories"])


@router.post(
    "",
    permission=Permission(Resource.CATEGORY, Action.CREATE),
    summary="Create category",
    status_code=201,
    dependencies=[Depends(require_feature("catalog"))],
)
async def create_category(body: CategoryCreate, svc: CategoryServiceDep, tenant_id: TenantIdDep) -> CategoryRead:
    return await svc.create(tenant_id, body)


@router.get(
    "",
    permission=Permission(Resource.CATEGORY, Action.LIST),
    summary="List categories",
)
async def list_categories(
    svc: CategoryServiceDep,
    tenant_id: TenantIdDep,
    q: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(alias="pageSize", ge=1, le=100)] = 50,
) -> CategoryPage:
    return await svc.list(tenant_id, q=q, page=page, page_size=page_size)


@router.get(
    "/{category_id}",
    permission=Permission(Resource.CATEGORY, Action.READ),
    summary="Get category",
)
async def get_category(category_id: uuid.UUID, svc: CategoryServiceDep, tenant_id: TenantIdDep) -> CategoryRead:
    return await svc.get(tenant_id, category_id)


@router.put(
    "/{category_id}",
    permission=Permission(Resource.CATEGORY, Action.UPDATE),
    summary="Update category",
    dependencies=[Depends(require_feature("catalog"))],
)
async def update_category(
    category_id: uuid.UUID,
    body: CategoryUpdate,
    svc: CategoryServiceDep,
    tenant_id: TenantIdDep,
) -> CategoryRead:
    return await svc.update(tenant_id, category_id, body)


@router.delete(
    "/{category_id}",
    permission=Permission(Resource.CATEGORY, Action.DELETE),
    summary="Delete category",
    status_code=204,
    dependencies=[Depends(require_feature("catalog"))],
)
async def delete_category(category_id: uuid.UUID, svc: CategoryServiceDep, tenant_id: TenantIdDep) -> None:
    await svc.delete(tenant_id, category_id)
