"""Service settings. Add service-specific config here; values come from env vars / .env."""

from typing import Literal

from platform_kit.config import ServiceSettings


class Settings(ServiceSettings):
    service_name: str = "core-api"
    database_url: str = "postgresql+asyncpg://app:app@localhost:5432/core_api"
    kafka_enabled: bool = False
    platform_profile: Literal["api", "saas"] = "saas"
    redis_url: str | None = "redis://localhost:6379/0"
    jwt_issuer: str | None = "https://auth.local"
    jwt_audience: str | None = "api://local"


settings = Settings()
