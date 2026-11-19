"""Domain errors. `message` is shown to users; pass `detail=` for developers (logged, dev-only in responses)."""

from platform_kit import ConflictError, NotFoundError


class ItemNotFoundError(NotFoundError):
    code = "item_not_found"
    message = "Item not found."


class ItemNameTakenError(ConflictError):
    code = "item_name_taken"
    message = "An item with this name already exists."
