"""Service settings. Add service-specific config here; values come from env vars / .env."""

from platform_kit.config import ServiceSettings


class Settings(ServiceSettings):
    service_name: str = "core-api"
    database_url: str = "postgresql+asyncpg://app:app@localhost:5432/core_api"
    kafka_enabled: bool = False


settings = Settings()
