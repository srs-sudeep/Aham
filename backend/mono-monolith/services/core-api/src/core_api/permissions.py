"""Every resource this service protects + which roles get which permissions.

Permission strings look like "<resource>:<action>", e.g. "core-api.item:create".
`dx new-module` adds a Resource entry automatically. `dx permissions core-api` prints the matrix.

ROLE_PERMISSIONS is the bootstrap seed + code fallback. When platform_profile=saas, live
grants come from the identity Role/Permission tables (see PermissionResolver).
"""

from enum import StrEnum


class Resource(StrEnum):
    ITEM = "core-api.item"
    CATEGORY = "core-api.category"
    IDENTITY_TENANT = "identity.tenant"
    IDENTITY_USER = "identity.user"
    IDENTITY_ROLE = "identity.role"
    IDENTITY_PERMISSION = "identity.permission"
    IDENTITY_AUDIT = "identity.audit"
    BILLING_PLAN = "billing.plan"
    BILLING_SUBSCRIPTION = "billing.subscription"
    # dx:resources (new entries are inserted above this line)
    pass


ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": ["*"],
    "member": [
        "identity.tenant:list",
        "identity.tenant:update",
        "identity.user:create",
        "identity.user:list",
        "identity.user:read",
        "identity.user:update",
        "identity.role:list",
        "identity.role:read",
        "identity.permission:list",
        "billing.plan:list",
        "billing.subscription:read",
        "core-api.item:create",
        "core-api.item:read",
        "core-api.item:list",
        "core-api.item:update",
        "core-api.item:delete",
        "core-api.category:create",
        "core-api.category:read",
        "core-api.category:list",
        "core-api.category:update",
        "core-api.category:delete",
    ],
    "viewer": [
        "identity.tenant:list",
        "identity.user:list",
        "identity.user:read",
        "identity.role:list",
        "identity.role:read",
        "identity.permission:list",
        "identity.audit:list",
        "billing.plan:list",
        "billing.subscription:read",
        "core-api.item:read",
        "core-api.item:list",
        "core-api.category:read",
        "core-api.category:list",
    ],
}
