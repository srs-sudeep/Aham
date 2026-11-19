"""Pure-ASGI middlewares (faster than BaseHTTPMiddleware and safe with streaming).

Order (outermost first), wired by create_app():
    RequestContextMiddleware  -> request id, access log, timing, last-resort 500 envelope
    SecurityHeadersMiddleware -> standard security headers
    CORSMiddleware            -> only when settings.cors_origins is set
    GZipMiddleware
"""

import re
import time
import uuid
from typing import Any

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from platform_kit.config import ServiceSettings
from platform_kit.context import request_id_var, user_id_var
from platform_kit.errors import unhandled_error_response
from platform_kit.logging import get_logger

log = get_logger("platform_kit.access")
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,128}$")
_QUIET_PATHS = ("/health/live", "/health/ready")


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp, settings: ServiceSettings) -> None:
        self.app = app
        self.settings = settings

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        incoming = headers.get("x-request-id", "")
        request_id = incoming if _VALID_REQUEST_ID.match(incoming) else uuid.uuid4().hex
        rid_token = request_id_var.set(request_id)
        uid_token = user_id_var.set(None)
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        status = 500
        started = False
        start = time.perf_counter()

        async def send_wrapper(message: Message) -> None:
            nonlocal status, started
            if message["type"] == "http.response.start":
                started = True
                status = message["status"]
                message.setdefault("headers", [])
                message["headers"].append((b"x-request-id", request_id.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:  # last resort: anything not turned into an envelope upstream
            if started:
                raise
            response = unhandled_error_response(self.settings, exc)
            await response(scope, receive, send_wrapper)
        finally:
            path = scope.get("path", "")
            if path not in _QUIET_PATHS:
                fields: dict[str, Any] = {
                    "method": scope.get("method"),
                    "path": path,
                    "status": status,
                    "duration_ms": round((time.perf_counter() - start) * 1000, 2),
                    "client_ip": (scope.get("client") or ("-",))[0],
                    "user_id": user_id_var.get(),
                }
                if status >= 500:
                    log.error("http_request", **fields)
                elif status >= 400:
                    log.warning("http_request", **fields)
                else:
                    log.info("http_request", **fields)
            request_id_var.reset(rid_token)
            user_id_var.reset(uid_token)
            structlog.contextvars.clear_contextvars()


class SecurityHeadersMiddleware:
    HEADERS = [
        (b"x-content-type-options", b"nosniff"),
        (b"x-frame-options", b"DENY"),
        (b"referrer-policy", b"no-referrer"),
        (b"strict-transport-security", b"max-age=31536000; includeSubDomains"),
    ]

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", [])
                message["headers"].extend(self.HEADERS)
            await send(message)

        await self.app(scope, receive, send_wrapper)
