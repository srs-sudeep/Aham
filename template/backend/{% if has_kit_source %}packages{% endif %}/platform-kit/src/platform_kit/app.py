"""create_app(): the one place where a service is assembled. Services never build FastAPI() themselves."""

import importlib
import pkgutil
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from platform_kit.config import Environment, ServiceSettings
from platform_kit.db import Database
from platform_kit.errors import register_error_handlers
from platform_kit.health import HealthCheck, health_router
from platform_kit.logging import configure_logging, get_logger
from platform_kit.middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from platform_kit.rbac import SecureRouter, find_unprotected_routes
from platform_kit.security import TokenVerifier
from platform_kit.telemetry import setup_telemetry

log = get_logger("platform_kit.app")
MODULE_OPTIONAL_IMPORTS = ("models", "events")


def discover_routers(package: str) -> list[SecureRouter]:
    """Auto-include every ``<package>.modules.<name>.router:router``. No manual registration, no merge conflicts."""
    modules_pkg = importlib.import_module(f"{package}.modules")
    routers: list[SecureRouter] = []
    for info in sorted(pkgutil.iter_modules(modules_pkg.__path__), key=lambda i: i.name):
        if not info.ispkg:
            continue
        base = f"{package}.modules.{info.name}"
        for optional in MODULE_OPTIONAL_IMPORTS:  # register tables + event subscribers
            try:
                importlib.import_module(f"{base}.{optional}")
            except ModuleNotFoundError as exc:
                if exc.name != f"{base}.{optional}":
                    raise
        router = getattr(importlib.import_module(f"{base}.router"), "router", None)
        if not isinstance(router, SecureRouter):
            raise RuntimeError(f"{base}.router must define `router = SecureRouter(...)`")
        routers.append(router)
    return routers


def load_models(package: str, *, include_messaging: bool = False) -> None:
    """Import every module's models (and the outbox table) so Base.metadata is complete. Used by Alembic."""
    if include_messaging:
        importlib.import_module("platform_kit.messaging")
    modules_pkg = importlib.import_module(f"{package}.modules")
    for info in pkgutil.iter_modules(modules_pkg.__path__):
        if info.ispkg:
            try:
                importlib.import_module(f"{package}.modules.{info.name}.models")
            except ModuleNotFoundError as exc:
                if exc.name != f"{package}.modules.{info.name}.models":
                    raise


def create_app(
    *,
    settings: ServiceSettings,
    package: str,
    role_permissions: dict[str, list[str]] | None = None,
    extra_health_checks: dict[str, HealthCheck] | None = None,
) -> FastAPI:
    configure_logging(settings)
    db = Database(settings)
    messaging: Any = None
    redis: Any = None

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        nonlocal messaging, redis
        app.state.http = httpx.AsyncClient(timeout=settings.http_timeout_seconds)
        if settings.redis_url:
            from platform_kit.redis import RedisClient
            from platform_kit.security import TokenIssuer

            redis = RedisClient(settings)
            await redis.connect()
            app.state.redis = redis
            app.state.token_issuer = TokenIssuer(settings, redis)
            app.state.health_checks["redis"] = redis.ping
        else:
            app.state.redis = None
            app.state.token_issuer = None
        if settings.kafka_enabled:  # importing registers the outbox table before create_all
            from platform_kit.messaging import Messaging

            messaging = Messaging(settings, db)
        if settings.db_auto_create:
            if settings.env == Environment.PROD:
                raise RuntimeError("DB_AUTO_CREATE is not allowed in prod; use Alembic migrations")
            await db.create_all()
        if messaging is not None:
            await messaging.start()
            app.state.health_checks["messaging"] = messaging.ping
        log.info("service_started", version=settings.version, env=settings.env.value)
        try:
            yield
        finally:
            if messaging is not None:
                await messaging.stop()
            if redis is not None:
                await redis.close()
            await app.state.http.aclose()
            await db.dispose()
            log.info("service_stopped")

    docs = settings.docs_enabled and settings.env != Environment.PROD
    app = FastAPI(
        title=settings.service_name,
        version=settings.version,
        lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs or settings.is_dev else None,
    )
    app.state.settings = settings
    app.state.db = db
    app.state.token_verifier = TokenVerifier(settings, role_permissions or {})
    app.state.redis = None
    app.state.token_issuer = None
    app.state.entitlements = None
    app.state.audit = None
    app.state.health_checks = {"database": db.ping, **(extra_health_checks or {})}

    register_error_handlers(app, settings)

    # add_middleware prepends -> add innermost first, outermost last
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["X-Request-ID"],
        )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestContextMiddleware, settings=settings)

    app.include_router(health_router)
    for router in discover_routers(package):
        app.include_router(router.api_router, prefix=settings.api_prefix)

    if unprotected := find_unprotected_routes(app.routes):
        raise RuntimeError(f"Routes without RBAC permission (use SecureRouter): {unprotected}")

    setup_telemetry(app, settings, db.engine)
    return app
