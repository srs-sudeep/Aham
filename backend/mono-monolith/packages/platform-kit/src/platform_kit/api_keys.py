"""API key issuance and verification (machine principals)."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass


@dataclass(frozen=True)
class IssuedApiKey:
    raw: str  # shown once to the caller
    prefix: str
    hash: str


def issue_api_key(*, prefix: str = "aham") -> IssuedApiKey:
    secret = secrets.token_urlsafe(32)
    raw = f"{prefix}_{secret}"
    return IssuedApiKey(raw=raw, prefix=raw[:12], hash=hash_api_key(raw))


def hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)
