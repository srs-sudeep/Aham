"""Service entrypoint. Keep this file tiny: everything is wired by platform_kit.create_app."""

from core_api.permissions import ROLE_PERMISSIONS
from core_api.settings import settings
from platform_kit import create_app

app = create_app(settings=settings, package="core_api", role_permissions=ROLE_PERMISSIONS)
