"""The ONLY way services call each other over HTTP.

* base URLs come from settings.service_urls  (SERVICE_URLS='{"orders": "http://orders:8000"}')
* forwards X-Request-ID and the caller's bearer token (on-behalf-of) automatically
* timeouts always on; retries only for idempotent methods; failures -> ExternalServiceError
Importing httpx/requests directly in service code is flagged by `dx check` (HTTP001).
"""

from typing import Annotated, Any

import httpx
from fastapi import Depends, Request
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from platform_kit.config import ServiceSettings
from platform_kit.context import auth_token_var, get_request_id
from platform_kit.errors import ExternalServiceError
from platform_kit.logging import get_logger

log = get_logger("platform_kit.http")
_IDEMPOTENT = {"GET", "HEAD", "PUT", "DELETE", "OPTIONS"}


class _RetryableError(Exception):
    pass


class ServiceClient:
    def __init__(self, service: str, settings: ServiceSettings, client: httpx.AsyncClient) -> None:
        if service not in settings.service_urls:
            raise RuntimeError(f"No URL configured for service '{service}'. Add it to SERVICE_URLS.")
        self.service = service
        self.base_url = settings.service_urls[service].rstrip("/")
        self.retries = settings.http_retries
        self.client = client

    def _headers(self, extra: dict[str, str] | None) -> dict[str, str]:
        headers: dict[str, str] = {}
        if rid := get_request_id():
            headers["X-Request-ID"] = rid
        if token := auth_token_var.get():
            headers["Authorization"] = f"Bearer {token}"
        return headers | (extra or {})

    async def request(self, method: str, path: str, **kw: Any) -> httpx.Response:
        method = method.upper()
        url = f"{self.base_url}/{path.lstrip('/')}"
        kw["headers"] = self._headers(kw.get("headers"))
        attempts = self.retries + 1 if method in _IDEMPOTENT else 1
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(attempts),
                wait=wait_exponential(multiplier=0.2, max=2),
                retry=retry_if_exception_type((httpx.TransportError, _RetryableError)),
                reraise=True,
            ):
                with attempt:
                    response = await self.client.request(method, url, **kw)
                    if response.status_code >= 500:
                        raise _RetryableError(f"{response.status_code} from {self.service}")
                    return response
        except (httpx.TransportError, _RetryableError) as exc:
            log.error("upstream_failed", service=self.service, method=method, url=url, error=str(exc))
            raise ExternalServiceError(detail=f"{self.service}: {exc}", service=self.service) from exc
        raise AssertionError("unreachable")

    async def get_json(self, path: str, **kw: Any) -> Any:
        response = await self.request("GET", path, **kw)
        if response.is_error:
            raise ExternalServiceError(detail=f"{self.service} returned {response.status_code}", service=self.service)
        return response.json()

    async def post_json(self, path: str, body: Any, **kw: Any) -> Any:
        response = await self.request("POST", path, json=body, **kw)
        if response.is_error:
            raise ExternalServiceError(detail=f"{self.service} returned {response.status_code}", service=self.service)
        return response.json()


def service_client(service: str) -> Any:
    """FastAPI dependency factory: ``OrdersClient = Annotated[ServiceClient, Depends(service_client("orders"))]``."""

    def _dep(request: Request) -> ServiceClient:
        return ServiceClient(service, request.app.state.settings, request.app.state.http)

    return _dep


def ServiceClientDep(service: str) -> Any:  # noqa: N802 - reads like a type
    return Annotated[ServiceClient, Depends(service_client(service))]
