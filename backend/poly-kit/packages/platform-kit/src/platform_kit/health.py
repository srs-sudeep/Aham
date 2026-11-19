"""/health/live  -> process is up (container restart probe)
/health/ready -> dependencies reachable (load balancer / compose healthcheck)."""

from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

HealthCheck = Callable[[], Awaitable[None]]

health_router = APIRouter(prefix="/health", tags=["health"], include_in_schema=False)


@health_router.get("/live")
async def live() -> dict[str, str]:
    return {"status": "ok"}


@health_router.get("/ready")
async def ready(request: Request) -> JSONResponse:
    checks: dict[str, HealthCheck] = request.app.state.health_checks
    results: dict[str, str] = {}
    for name, check in checks.items():
        try:
            await check()
            results[name] = "ok"
        except Exception as exc:
            results[name] = f"fail: {type(exc).__name__}"
    healthy = all(v == "ok" for v in results.values())
    return JSONResponse({"status": "ok" if healthy else "degraded", "checks": results}, status_code=200 if healthy else 503)
