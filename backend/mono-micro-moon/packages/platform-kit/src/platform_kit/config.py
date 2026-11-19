"""Base settings. Each service subclasses ServiceSettings in its own settings.py.

All configuration comes from environment variables (or .env in development).
Reading os.environ anywhere else is flagged by `dx check` (CFG001).
"""

from enum import StrEnum
from typing import Literal, Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Public default — refused outside dev/test so a misconfigured staging/prod cannot mint tokens.
DEFAULT_JWT_SECRET = "dev-only-change-me-32-bytes-minimum!!"  # noqa: S105


class Environment(StrEnum):
    DEV = "dev"
    TEST = "test"
    STAGING = "staging"
    PROD = "prod"


class ServiceSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # identity
    service_name: str = "service"
    version: str = "0.1.0"
    env: Environment = Environment.DEV

    # http
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(default_factory=list)
    docs_enabled: bool = True

    # logging / errors
    log_level: str = "INFO"
    log_json: bool | None = None  # None -> JSON everywhere except dev
    expose_error_details: bool | None = None  # None -> only in dev/test

    # database
    database_url: str = "postgresql+asyncpg://app:app@localhost:5432/app"
    db_echo: bool = False
    db_pool_size: int = 5
    db_auto_create: bool = False  # create tables on startup (dev/test only, never prod)

    # auth (JWT). Use jwks_url in real environments; jwt_secret only for local dev/tests.
    # When platform_profile=saas, this service may also *issue* tokens (identity).
    jwt_secret: SecretStr = SecretStr(DEFAULT_JWT_SECRET)
    jwt_algorithm: str = "HS256"
    jwks_url: str | None = None
    jwt_audience: str | None = None
    jwt_issuer: str | None = None
    access_token_ttl_seconds: int = 900  # 15m
    refresh_token_ttl_seconds: int = 60 * 60 * 24 * 30  # 30d
    refresh_cookie_name: str = "refresh_token"
    refresh_cookie_secure: bool = True
    refresh_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    token_delivery: Literal["body", "cookie", "both"] = "both"

    # redis / saas
    redis_url: str | None = None
    platform_profile: Literal["api", "saas"] = "api"
    rate_limit_login: int = 10
    rate_limit_window_seconds: int = 60

    # MFA / SSO / Stripe (Phase 2)
    mfa_issuer: str = "Aham"
    oidc_redirect_uri: str | None = None  # e.g. http://localhost:8001/api/v1/auth/sso/callback
    stripe_api_key: SecretStr | None = None
    stripe_webhook_secret: SecretStr | None = None
    stripe_success_url: str = "http://localhost:3000/billing/success"
    stripe_cancel_url: str = "http://localhost:3000/billing/cancel"
    stripe_price_by_plan: dict[str, str] = Field(default_factory=dict)  # plan_code -> price_id

    # inter-service http
    service_urls: dict[str, str] = Field(default_factory=dict)
    http_timeout_seconds: float = 5.0
    http_retries: int = 2

    # telemetry
    otel_enabled: bool = False
    otel_endpoint: str = "http://localhost:4317"

    # messaging
    kafka_enabled: bool = False
    kafka_bootstrap_servers: str = "localhost:9092"
    outbox_poll_seconds: float = 1.0
    outbox_max_attempts: int = 10

    @model_validator(mode="after")
    def _require_safe_auth_outside_dev(self) -> Self:
        """Refuse to start staging/prod with the public HS256 default or incomplete JWKS config."""
        if self.platform_profile == "saas" and not self.redis_url and self.env not in (Environment.DEV, Environment.TEST):
            raise ValueError("REDIS_URL is required for platform_profile=saas outside dev/test")

        if self.env in (Environment.DEV, Environment.TEST):
            if self.jwks_url and (not self.jwt_audience or not self.jwt_issuer):
                raise ValueError(
                    "JWT_AUDIENCE and JWT_ISSUER are required whenever JWKS_URL is set "
                    "(even in dev/test), so tokens for other apps are rejected"
                )
            return self

        errors: list[str] = []
        secret = self.jwt_secret.get_secret_value()
        if secret == DEFAULT_JWT_SECRET:
            errors.append("JWT_SECRET must not use the built-in default outside dev/test")
        if len(secret) < 32:
            errors.append("JWT_SECRET must be at least 32 characters")
        # SaaS identity can issue HS256/RS256 locally; other services still prefer JWKS.
        if not self.jwks_url and self.platform_profile != "saas":
            errors.append("JWKS_URL is required outside dev/test (HS256 is for local use only)")
        elif self.jwks_url and not self.jwks_url.startswith("https://"):
            errors.append("JWKS_URL must use https outside dev/test")
        if not self.jwt_audience:
            errors.append("JWT_AUDIENCE is required outside dev/test")
        if not self.jwt_issuer:
            errors.append("JWT_ISSUER is required outside dev/test")
        if errors:
            raise ValueError("; ".join(errors))
        return self

    @property
    def is_dev(self) -> bool:
        return self.env in (Environment.DEV, Environment.TEST)

    @property
    def use_json_logs(self) -> bool:
        return (not self.is_dev) if self.log_json is None else self.log_json

    @property
    def show_error_details(self) -> bool:
        if self.env == Environment.PROD:
            return False  # never leak internals in prod, whatever the flag says
        return self.is_dev if self.expose_error_details is None else self.expose_error_details

    @property
    def is_saas(self) -> bool:
        return self.platform_profile == "saas"
