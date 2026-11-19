"""Every resource this service protects + which roles get which permissions.

Permission strings look like "<resource>:<action>", e.g. "core-api.item:create".
`dx new-module` adds a Resource entry automatically. `dx permissions core-api` prints the matrix.
"""

from enum import StrEnum


class Resource(StrEnum):
    ITEM = "core-api.item"
    IDENTITY_TENANT = "identity.tenant"
    IDENTITY_USER = "identity.user"
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
        "billing.plan:list",
        "billing.subscription:read",
        "core-api.item:create",
        "core-api.item:read",
        "core-api.item:list",
        "core-api.item:update",
        "core-api.item:delete",
    ],
    "viewer": [
        "identity.tenant:list",
        "identity.audit:list",
        "billing.plan:list",
        "billing.subscription:read",
        "core-api.item:read",
        "core-api.item:list",
    ],
}
