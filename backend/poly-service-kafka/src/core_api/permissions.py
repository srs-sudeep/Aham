"""Every resource this service protects + which roles get which permissions.

Permission strings look like "<resource>:<action>", e.g. "core-api.item:create".
`dx new-module` adds a Resource entry automatically. `dx permissions core-api` prints the matrix.
"""

from enum import StrEnum


class Resource(StrEnum):
    ITEM = "core-api.item"
    # dx:resources (new entries are inserted above this line)
    pass


ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": ["*"],
    "viewer": [],  # e.g. "core-api.item:read", "core-api.item:list"
}
