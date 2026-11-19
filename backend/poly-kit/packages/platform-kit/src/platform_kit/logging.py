"""Structured logging.

Every log line has the same fixed fields so they can be searched the same way in
every service:

    timestamp, level, event, service, env, request_id, user_id, trace_id, logger
    + any key/values passed to the call

Dev: coloured console output. Everything else: one JSON object per line.
Use `get_logger(__name__)`; `print` and `logging.getLogger` are flagged by `dx check`.
"""

import logging
import sys
from typing import Any

import structlog

from platform_kit.config import ServiceSettings
from platform_kit.context import request_id_var, user_id_var

# This module IS the sanctioned wrapper around stdlib logging, so it is the one place
# allowed to reach for the logger factory directly. Everywhere else `logging.getLogger`
# is banned by ruff (TID251) and `dx check` (LOG002) in favour of `get_logger`.
_stdlib_logger = logging.getLogger  # noqa: TID251


def _add_context(_: Any, __: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    event_dict.setdefault("request_id", request_id_var.get())
    event_dict.setdefault("user_id", user_id_var.get())
    try:  # trace id only when OpenTelemetry is installed and active
        from opentelemetry import trace

        ctx = trace.get_current_span().get_span_context()
        if ctx.is_valid:
            event_dict.setdefault("trace_id", format(ctx.trace_id, "032x"))
    except ImportError:
        pass
    return event_dict


def configure_logging(settings: ServiceSettings) -> None:
    static = {"service": settings.service_name, "env": settings.env.value}

    def _add_static(_: Any, __: str, event_dict: dict[str, Any]) -> dict[str, Any]:
        for key, value in static.items():
            event_dict.setdefault(key, value)
        return event_dict

    shared: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True, key="timestamp"),
        _add_static,
        _add_context,
    ]
    renderer: Any = (
        structlog.processors.JSONRenderer()
        if settings.use_json_logs
        else structlog.dev.ConsoleRenderer(colors=sys.stderr.isatty())
    )
    if settings.use_json_logs:
        shared.append(structlog.processors.dict_tracebacks)

    structlog.configure(
        processors=[*shared, structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Route stdlib logs (uvicorn, sqlalchemy, libraries) through the same pipeline.
    handler = logging.StreamHandler()
    handler.setFormatter(
        structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=shared,
            processors=[structlog.stdlib.ProcessorFormatter.remove_processors_meta, renderer],
        )
    )
    root = _stdlib_logger()
    root.handlers[:] = [handler]
    root.setLevel(settings.log_level.upper())
    # our access-log middleware replaces uvicorn's
    _stdlib_logger("uvicorn.access").handlers.clear()
    _stdlib_logger("uvicorn.access").propagate = False
    for name in ("uvicorn", "uvicorn.error"):
        _stdlib_logger(name).handlers.clear()
        _stdlib_logger(name).propagate = True


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
