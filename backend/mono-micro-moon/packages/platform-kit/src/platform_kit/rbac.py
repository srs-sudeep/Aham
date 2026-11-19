"""RBAC that cannot be forgotten.

Every endpoint is declared through ``SecureRouter``, whose verb methods REQUIRE
``permission=`` and ``summary=`` keyword arguments. Leaving one out is a type
error in the editor (Pyright), a ``dx check`` violation (RBAC00x), and the app
refuses to start if any route is unprotected.

    from platform_kit import SecureRouter, Permission, Action, PUBLIC
    from core_api.permissions import Resource

    router = SecureRouter(prefix="/items", tags=["items"])

    @router.post("", permission=Permission(Resource.ITEM, Action.CREATE), summary="Create an item",
                 status_code=201)
    async def create_item(body: ItemCreate, svc: ItemServiceDep) -> ItemRead:
        return await svc.create(body)

Use ``permission=PUBLIC`` for intentionally open endpoints (easy to grep in review).
"""

from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import Annotated, Any, Final, TypeVar

from fastapi import APIRouter, Depends
from fastapi.routing import APIRoute

from platform_kit.errors import ERROR_RESPONSE_SCHEMA, ForbiddenError
from platform_kit.security import Principal, get_current_principal

F = TypeVar("F", bound=Callable[..., Any])


class Action(StrEnum):
    READ = "read"
    LIST = "list"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    APPROVE = "approve"
    EXPORT = "export"


@dataclass(frozen=True, slots=True)
class Permission:
    resource: StrEnum  # each service defines its own Resource enum in permissions.py
    action: Action

    def __str__(self) -> str:
        return f"{self.resource.value}:{self.action.value}"


class _Public:
    def __repr__(self) -> str:
        return "PUBLIC"


PUBLIC: Final = _Public()
PERMISSION_KEY: Final = "x-permission"


def require(permission: Permission) -> Callable[..., Any]:
    required = str(permission)

    async def _check(principal: Annotated[Principal, Depends(get_current_principal)]) -> Principal:
        if not principal.has(required):
            raise ForbiddenError(detail=f"missing permission {required}", required=required)
        return principal

    return _check


_DEFAULT_ERRORS: dict[int | str, dict[str, Any]] = dict.fromkeys(
    (400, 401, 403, 404, 409, 422, 500), ERROR_RESPONSE_SCHEMA
)


class SecureRouter:
    """Composition over inheritance: the raw APIRouter is not exposed for adding routes."""

    def __init__(self, *, prefix: str, tags: list[str], dependencies: list[Any] | None = None) -> None:
        if not prefix.startswith("/"):
            raise ValueError("SecureRouter prefix must start with '/'")
        if not tags:
            raise ValueError("SecureRouter needs at least one tag")
        self._router = APIRouter(
            prefix=prefix, tags=list(tags), dependencies=dependencies or [], responses=_DEFAULT_ERRORS
        )

    @property
    def api_router(self) -> APIRouter:  # used by create_app only
        return self._router

    def _route(
        self, method: str, path: str, permission: Permission | _Public, summary: str, kw: dict[str, Any]
    ) -> Callable[[F], F]:
        if not isinstance(permission, (Permission, _Public)):
            raise TypeError(f"permission must be Permission(...) or PUBLIC, got {permission!r}")
        deps = list(kw.pop("dependencies", None) or [])
        if isinstance(permission, Permission):
            deps.append(Depends(require(permission)))
        extra = dict(kw.pop("openapi_extra", None) or {})
        extra[PERMISSION_KEY] = "public" if isinstance(permission, _Public) else str(permission)

        def decorator(func: F) -> F:
            self._router.add_api_route(
                path, func, methods=[method], summary=summary, dependencies=deps, openapi_extra=extra, **kw
            )
            return func

        return decorator

    def get(self, path: str, *, permission: Permission | _Public, summary: str, **kw: Any) -> Callable[[F], F]:
        return self._route("GET", path, permission, summary, kw)

    def post(self, path: str, *, permission: Permission | _Public, summary: str, **kw: Any) -> Callable[[F], F]:
        return self._route("POST", path, permission, summary, kw)

    def put(self, path: str, *, permission: Permission | _Public, summary: str, **kw: Any) -> Callable[[F], F]:
        return self._route("PUT", path, permission, summary, kw)

    def patch(self, path: str, *, permission: Permission | _Public, summary: str, **kw: Any) -> Callable[[F], F]:
        return self._route("PATCH", path, permission, summary, kw)

    def delete(self, path: str, *, permission: Permission | _Public, summary: str, **kw: Any) -> Callable[[F], F]:
        return self._route("DELETE", path, permission, summary, kw)


EXEMPT_PATH_PREFIXES: Final = ("/health", "/docs", "/redoc", "/openapi.json")


def find_unprotected_routes(routes: list[Any]) -> list[str]:
    missing = []
    for route in routes:
        if not isinstance(route, APIRoute) or route.path.startswith(EXEMPT_PATH_PREFIXES):
            continue
        if PERMISSION_KEY not in (route.openapi_extra or {}):
            # APIRoute.methods is typed as optional; `or ()` keeps the sort total.
            missing.append(f"{','.join(sorted(route.methods or ()))} {route.path}")
    return missing


def permission_matrix(routes: list[Any]) -> list[tuple[str, str, str]]:
    """(method, path, permission) for every route; used by `dx permissions`."""
    rows: list[tuple[str, str, str]] = []
    for route in routes:
        if not isinstance(route, APIRoute):
            continue
        perm = (route.openapi_extra or {}).get(PERMISSION_KEY, "-")
        rows.extend((m, route.path, perm) for m in sorted(route.methods or ()))
    return rows
