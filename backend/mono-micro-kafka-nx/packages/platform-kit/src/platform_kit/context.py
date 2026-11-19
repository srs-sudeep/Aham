"""Request-scoped context shared by logging, errors and the HTTP client."""

from contextvars import ContextVar

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)
tenant_id_var: ContextVar[str | None] = ContextVar("tenant_id", default=None)
auth_token_var: ContextVar[str | None] = ContextVar("auth_token", default=None)


def get_request_id() -> str | None:
    return request_id_var.get()


def get_tenant_id() -> str | None:
    return tenant_id_var.get()
