"""platform-kit: the baseline every service builds on. Teams do not edit this package.

Exports are lazy so the `dx` CLI and editor/agent hooks start instantly without importing FastAPI.

`__all__` is written out literally rather than derived from `_EXPORTS`, because static tools
(ruff, pyright) cannot evaluate a computed `__all__` and would stop seeing these as exports.
`test_exports_match_all` keeps the two in step.
"""

from importlib import import_module
from typing import TYPE_CHECKING, Any

_EXPORTS = {
    "create_app": "platform_kit.app",
    "ServiceSettings": "platform_kit.config",
    "get_logger": "platform_kit.logging",
    "PUBLIC": "platform_kit.rbac",
    "Action": "platform_kit.rbac",
    "Permission": "platform_kit.rbac",
    "SecureRouter": "platform_kit.rbac",
    "AppError": "platform_kit.errors",
    "BadRequestError": "platform_kit.errors",
    "ConflictError": "platform_kit.errors",
    "ExternalServiceError": "platform_kit.errors",
    "ForbiddenError": "platform_kit.errors",
    "NotFoundError": "platform_kit.errors",
    "UnauthorizedError": "platform_kit.errors",
    "UnprocessableError": "platform_kit.errors",
}

__all__ = [
    "PUBLIC",
    "Action",
    "AppError",
    "BadRequestError",
    "ConflictError",
    "ExternalServiceError",
    "ForbiddenError",
    "NotFoundError",
    "Permission",
    "SecureRouter",
    "ServiceSettings",
    "UnauthorizedError",
    "UnprocessableError",
    "create_app",
    "get_logger",
]


def __getattr__(name: str) -> Any:
    if name in _EXPORTS:
        return getattr(import_module(_EXPORTS[name]), name)
    raise AttributeError(f"module 'platform_kit' has no attribute {name!r}")


if TYPE_CHECKING:  # give editors / pyright the real symbols
    from platform_kit.app import create_app
    from platform_kit.config import ServiceSettings
    from platform_kit.errors import (
        AppError,
        BadRequestError,
        ConflictError,
        ExternalServiceError,
        ForbiddenError,
        NotFoundError,
        UnauthorizedError,
        UnprocessableError,
    )
    from platform_kit.logging import get_logger
    from platform_kit.rbac import PUBLIC, Action, Permission, SecureRouter
