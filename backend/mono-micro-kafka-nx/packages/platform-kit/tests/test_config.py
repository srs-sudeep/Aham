import pytest
from pydantic import SecretStr, ValidationError

from platform_kit.config import DEFAULT_JWT_SECRET, Environment, ServiceSettings

_SAFE_SECRET = SecretStr("a-real-secret-at-least-32-bytes-long!!")


def test_dev_defaults_are_allowed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENV", raising=False)
    s = ServiceSettings(_env_file=None)  # pyright: ignore[reportCallIssue]
    assert s.env == Environment.DEV
    assert s.jwt_secret.get_secret_value() == DEFAULT_JWT_SECRET


def test_prod_rejects_default_secret_and_missing_jwks() -> None:
    with pytest.raises(ValidationError, match="JWKS_URL"):
        ServiceSettings(env=Environment.PROD)


def test_prod_accepts_jwks_with_audience_and_issuer() -> None:
    s = ServiceSettings(
        env=Environment.PROD,
        jwt_secret=_SAFE_SECRET,
        jwks_url="https://login.example.com/.well-known/jwks.json",
        jwt_audience="my-api",
        jwt_issuer="https://login.example.com/",
    )
    assert s.jwks_url is not None


def test_staging_rejects_http_jwks() -> None:
    with pytest.raises(ValidationError, match="https"):
        ServiceSettings(
            env=Environment.STAGING,
            jwt_secret=_SAFE_SECRET,
            jwks_url="http://login.example.com/jwks",
            jwt_audience="my-api",
            jwt_issuer="https://login.example.com/",
        )


def test_dev_with_jwks_still_requires_audience_and_issuer() -> None:
    with pytest.raises(ValidationError, match="JWT_AUDIENCE"):
        ServiceSettings(jwks_url="https://login.example.com/jwks")
