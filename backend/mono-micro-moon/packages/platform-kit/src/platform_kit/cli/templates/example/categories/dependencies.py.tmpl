"""How this module's service is built for one request."""

from typing import Annotated

from fastapi import Depends

from platform_kit.db import SessionDep

from .repository import CategoryRepository
from .service import CategoryService


def get_category_service(session: SessionDep) -> CategoryService:
    return CategoryService(CategoryRepository(session))


CategoryServiceDep = Annotated[CategoryService, Depends(get_category_service)]
