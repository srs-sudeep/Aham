"""TOTP MFA helpers (pyotp)."""

from __future__ import annotations

import secrets

from platform_kit.errors import UnauthorizedError


def generate_totp_secret() -> str:
    import pyotp

    return pyotp.random_base32()


def provisioning_uri(*, secret: str, email: str, issuer: str = "Aham") -> str:
    from pyotp.totp import TOTP

    return TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    from pyotp.totp import TOTP

    return bool(TOTP(secret).verify(code, valid_window=1))


def require_totp(secret: str, code: str | None) -> None:
    if not code or not verify_totp(secret, code):
        raise UnauthorizedError("Invalid MFA code.", detail="totp mismatch")


def generate_recovery_codes(n: int = 8) -> list[str]:
    return [secrets.token_hex(4) for _ in range(n)]
