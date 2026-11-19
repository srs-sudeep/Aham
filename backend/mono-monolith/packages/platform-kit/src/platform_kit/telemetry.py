"""OpenTelemetry tracing (install `platform-kit[otel]`, set OTEL_ENABLED=true).

One trace follows a request across every service, httpx call and SQL query.
trace_id is added to every log line by platform_kit.logging.
"""

from typing import Any

from fastapi import FastAPI

from platform_kit.config import ServiceSettings
from platform_kit.logging import get_logger

log = get_logger("platform_kit.telemetry")


def setup_telemetry(app: FastAPI, settings: ServiceSettings, engine: Any) -> None:
    if not settings.otel_enabled:
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:
        log.warning("otel_not_installed", hint="add platform-kit[otel] to the service dependencies")
        return

    provider = TracerProvider(
        resource=Resource.create(
            {
                "service.name": settings.service_name,
                "service.version": settings.version,
                "deployment.environment": settings.env.value,
            }
        )
    )
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_endpoint)))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app, excluded_urls="health/.*")
    HTTPXClientInstrumentor().instrument()
    SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)
    log.info("otel_enabled", endpoint=settings.otel_endpoint)
