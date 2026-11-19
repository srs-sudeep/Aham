"""Phase 2 unit tests: API keys, MFA, OIDC meta validation."""

from __future__ import annotations

import pytest

from platform_kit.api_keys import hash_api_key, issue_api_key
from platform_kit.errors import BadRequestError
from platform_kit.mfa import generate_totp_secret, provisioning_uri, verify_totp
from platform_kit.oidc import _meta


def test_api_key_roundtrip_hash() -> None:
    issued = issue_api_key()
    assert issued.raw.startswith("aham_")
    assert hash_api_key(issued.raw) == issued.hash
    assert hash_api_key("wrong") != issued.hash


def test_totp_verify() -> None:
    import pyotp

    secret = generate_totp_secret()
    uri = provisioning_uri(secret=secret, email="a@b.com")
    assert "otpauth://" in uri
    code = pyotp.TOTP(secret).now()
    assert verify_totp(secret, code)


def test_oidc_meta_requires_fields() -> None:
    with pytest.raises(BadRequestError):
        _meta({"client_id": "x"})
    meta = _meta(
        {
            "client_id": "id",
            "client_secret": "sec",
            "authorize_url": "https://a/auth",
            "token_url": "https://a/token",
        }
    )
    assert meta["scopes"] == "openid email profile"
