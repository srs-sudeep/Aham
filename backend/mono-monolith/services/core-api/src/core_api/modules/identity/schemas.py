"""Identity request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    tenant_name: str = Field(min_length=2, max_length=200)
    tenant_slug: str = Field(min_length=2, max_length=80, pattern=r"^[a-z][a-z0-9-]+$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    mfa_code: str | None = None


class MfaRequiredResponse(BaseModel):
    requires_mfa: bool = True
    mfa_token: str


class MfaEnrollResponse(BaseModel):
    secret: str
    provisioning_uri: str
    recovery_codes: list[str]


class MfaConfirmRequest(BaseModel):
    code: str


class MfaCompleteRequest(BaseModel):
    mfa_token: str
    code: str


class SsoStartRequest(BaseModel):
    tenant_slug: str
    return_to: str = "/"


class SsoStartResponse(BaseModel):
    authorize_url: str


class UpsertOidcConnectionRequest(BaseModel):
    issuer: str | None = None
    client_id: str
    client_secret: str
    authorize_url: str
    token_url: str
    userinfo_url: str | None = None
    scopes: str = "openid email profile"
    enabled: bool = True


class CreateApiKeyRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    role: str = "member"


class CreateApiKeyResponse(BaseModel):
    id: UUID
    name: str
    prefix: str
    raw_key: str  # shown once


class ScimTokenResponse(BaseModel):
    prefix: str
    raw_token: str


class SelectTenantRequest(BaseModel):
    session_token: str
    tenant_id: UUID


class SwitchTenantRequest(BaseModel):
    tenant_id: UUID


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"  # noqa: S105
    expires_in: int
    tenant_id: UUID | None = None


class SsoLoginResult(BaseModel):
    tokens: TokenResponse
    return_to: str = "/"


class TenantSelectionResponse(BaseModel):
    requires_tenant_selection: bool = True
    session_token: str
    tenants: list[TenantMembership]


class TenantMembership(BaseModel):
    tenant_id: UUID
    slug: str
    name: str
    role: str


class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "member"


class AcceptInviteRequest(BaseModel):
    token: str
    password: str = Field(min_length=10, max_length=128)


class DisableUserRequest(BaseModel):
    user_id: UUID


class AuditExportQuery(BaseModel):
    since: datetime | None = None
    until: datetime | None = None
    action: str | None = None
    limit: int = Field(default=100, ge=1, le=1000)


class AuditEventOut(BaseModel):
    id: UUID
    actor_type: str
    actor_id: str | None
    tenant_id: UUID | None
    action: str
    target: str | None
    result: str
    created_at: datetime
    request_id: str | None
