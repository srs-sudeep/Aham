"""One error model for every service.

Each error carries TWO messages:

* ``message``  -> safe, user-facing text. Always returned to the client.
* ``detail``   -> developer-facing text. Always logged; returned to the client
                  only when ``settings.show_error_details`` is true (dev/test, never prod).

Response envelope (same shape in every service and for every status code)::

    {
      "error": {
        "code": "order_not_found",          # stable, machine-readable
        "message": "Order not found.",      # for end users / UI
        "request_id": "4f1c...",            # for support tickets & log search
        "fields": [ {"field": "body.qty", "message": "..."} ],   # validation only
        "debug": { "detail": "...", "exception": "...", "context": {...} }  # dev only
      }
    }

Define domain errors in ``modules/<name>/errors.py`` by subclassing these classes.
Raising ``HTTPException`` is flagged by ``dx check`` (ERR001).
"""

import traceback
from typing import Any, ClassVar

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
# This module is what turns HTTPException into the standard envelope, so it has to
# import the class that services are banned from raising (ruff TID251 / dx check ERR001).
from starlette.exceptions import HTTPException as StarletteHTTPException  # noqa: TID251

from platform_kit.config import ServiceSettings
from platform_kit.context import get_request_id
from platform_kit.logging import get_logger

log = get_logger("platform_kit.errors")


class AppError(Exception):
    status_code: ClassVar[int] = 500
    code: ClassVar[str] = "internal_error"
    message: ClassVar[str] = "Something went wrong. Please try again later."

    def __init__(
        self,
        message: str | None = None,
        *,
        detail: str | None = None,
        fields: list[dict[str, str]] | None = None,
        **context: Any,
    ) -> None:
        self.user_message = message or type(self).message
        self.detail = detail
        self.fields = fields
        self.context = context
        super().__init__(detail or self.user_message)


class BadRequestError(AppError):
    status_code = 400
    code = "bad_request"
    message = "The request is invalid."


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"
    message = "Authentication is required."


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"
    message = "You do not have permission to perform this action."


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    message = "The requested resource was not found."


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    message = "The request conflicts with the current state of the resource."


class UnprocessableError(AppError):
    status_code = 422
    code = "validation_error"
    message = "Some fields are invalid."


class ExternalServiceError(AppError):
    status_code = 502
    code = "upstream_error"
    message = "A dependent service failed. Please try again later."


class ServiceUnavailableError(AppError):
    status_code = 503
    code = "service_unavailable"
    message = "The service is temporarily unavailable."


class RateLimitError(AppError):
    status_code = 429
    code = "rate_limited"
    message = "Too many requests. Please try again later."


class PaymentRequiredError(AppError):
    status_code = 402
    code = "payment_required"
    message = "This action requires an active subscription."


# ── envelope ────────────────────────────────────────────────────────────────
def error_body(
    *,
    code: str,
    message: str,
    fields: list[dict[str, str]] | None = None,
    debug: dict[str, Any] | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message, "request_id": get_request_id()}
    if fields:
        error["fields"] = fields
    if debug:
        error["debug"] = debug
    return {"error": error}


def _debug_info(
    settings: ServiceSettings,
    exc: BaseException,
    detail: str | None,
    context: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not settings.show_error_details:
        return None
    info: dict[str, Any] = {"exception": type(exc).__name__}
    if detail:
        info["detail"] = detail
    if context:
        info["context"] = {k: str(v) for k, v in context.items()}
    if not isinstance(exc, AppError) or exc.status_code >= 500:
        info["traceback"] = traceback.format_exception(exc)[-6:]
    return info


def unhandled_error_response(settings: ServiceSettings, exc: BaseException) -> JSONResponse:
    # Called from an exception *handler*, not an `except` block, so the exception is
    # passed explicitly rather than picked up from sys.exc_info().
    log.error("unhandled_error", exc_type=type(exc).__name__, exc_info=exc)
    body = error_body(
        code=AppError.code,
        message=AppError.message,
        debug=_debug_info(settings, exc, str(exc) or None, None),
    )
    return JSONResponse(body, status_code=500)


def register_error_handlers(app: FastAPI, settings: ServiceSettings) -> None:
    async def handle_app_error(_: Request, exc: Exception) -> JSONResponse:
        if not isinstance(exc, AppError):  # pragma: no cover - registered for AppError only
            raise exc
        log_kw: dict[str, Any] = {"code": exc.code, "status": exc.status_code, "detail": exc.detail, **exc.context}
        if exc.status_code >= 500:
            log.error("app_error", exc_info=exc, **log_kw)
        else:
            log.warning("app_error", **log_kw)
        body = error_body(
            code=exc.code,
            message=exc.user_message,
            fields=exc.fields,
            debug=_debug_info(settings, exc, exc.detail, exc.context),
        )
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(body, status_code=exc.status_code, headers=headers)

    async def handle_validation(_: Request, exc: Exception) -> JSONResponse:
        if not isinstance(exc, RequestValidationError):  # pragma: no cover
            raise exc
        fields = [
            {"field": ".".join(str(p) for p in err.get("loc", ())), "message": str(err.get("msg", ""))}
            for err in exc.errors()
        ]
        log.info("request_validation_failed", fields=fields)
        body = error_body(code=UnprocessableError.code, message=UnprocessableError.message, fields=fields)
        return JSONResponse(body, status_code=422)

    async def handle_http(_: Request, exc: Exception) -> JSONResponse:
        # Raised by the framework itself (unknown route, wrong method). Our code raises AppError.
        if not isinstance(exc, StarletteHTTPException):  # pragma: no cover
            raise exc
        code = {404: "route_not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        message = {404: "The requested URL was not found.", 405: "Method not allowed."}.get(
            exc.status_code, str(exc.detail)
        )
        return JSONResponse(error_body(code=code, message=message), status_code=exc.status_code, headers=exc.headers)

    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(RequestValidationError, handle_validation)
    app.add_exception_handler(StarletteHTTPException, handle_http)


# OpenAPI schema for the envelope, so every endpoint documents its errors the same way.
ERROR_RESPONSE_SCHEMA: dict[str, Any] = {
    "description": "Error",
    "content": {
        "application/json": {
            "schema": {
                "type": "object",
                "properties": {
                    "error": {
                        "type": "object",
                        "required": ["code", "message"],
                        "properties": {
                            "code": {"type": "string"},
                            "message": {"type": "string"},
                            "request_id": {"type": ["string", "null"]},
                            "fields": {"type": "array", "items": {"type": "object"}},
                        },
                    }
                },
            }
        }
    },
}
