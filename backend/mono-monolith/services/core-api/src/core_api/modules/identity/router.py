"""Identity HTTP endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import Depends, Request

from core_api.modules.identity.dependencies import IdentityServiceDep
from core_api.modules.identity.schemas import (
    AcceptInviteRequest,
    AuditEventOut,
    CreateApiKeyRequest,
    CreateApiKeyResponse,
    DisableUserRequest,
    InviteRequest,
    LoginRequest,
    MfaConfirmRequest,
    MfaEnrollResponse,
    MfaRequiredResponse,
    RegisterRequest,
    ScimTokenResponse,
    SelectTenantRequest,
    SsoStartRequest,
    SsoStartResponse,
    SwitchTenantRequest,
    TenantMembership,
    TenantSelectionResponse,
    TokenResponse,
    UpsertOidcConnectionRequest,
)
from core_api.permissions import Resource
from platform_kit import PUBLIC, Action, Permission, SecureRouter
from platform_kit.rate_limit import client_ip, rate_limit
from platform_kit.security import CurrentPrincipal

# Ensure Phase 2 methods are attached to IdentityService
import core_api.modules.identity.phase2 as _phase2  # noqa: F401
from core_api.modules.identity.scim_router import router as scim_router

router = SecureRouter(prefix="/auth", tags=["auth"])
extra_routers = [scim_router]


def _login_key(request: Request) -> str:
    return f"login:{client_ip(request)}"


@router.post(
    "/register",
    permission=PUBLIC,
    summary="Register a user and create a tenant",
    status_code=201,
    dependencies=[Depends(rate_limit(limit=5, window_seconds=60, key_fn=_login_key))],
)
async def register(body: RegisterRequest, svc: IdentityServiceDep, request: Request) -> TokenResponse:
    return await svc.register(body, ip=client_ip(request))


@router.post(
    "/login",
    permission=PUBLIC,
    summary="Login with email and password",
    dependencies=[Depends(rate_limit(limit=10, window_seconds=60, key_fn=_login_key))],
)
async def login(
    body: LoginRequest, svc: IdentityServiceDep, request: Request
) -> TokenResponse | TenantSelectionResponse | MfaRequiredResponse:
    return await svc.login(body, ip=client_ip(request))


@router.post("/select-tenant", permission=PUBLIC, summary="Select tenant after multi-org login")
async def select_tenant(body: SelectTenantRequest, svc: IdentityServiceDep, request: Request) -> TokenResponse:
    return await svc.select_tenant(body.session_token, body.tenant_id, ip=client_ip(request))


@router.post("/refresh", permission=PUBLIC, summary="Rotate refresh token")
async def refresh(body: dict, svc: IdentityServiceDep, request: Request) -> TokenResponse:
    token = body.get("refresh_token") or request.cookies.get("refresh_token")
    return await svc.refresh(str(token))


@router.post("/logout", permission=PUBLIC, summary="Revoke refresh token")
async def logout(body: dict, svc: IdentityServiceDep, request: Request) -> dict[str, bool]:
    token = body.get("refresh_token") or request.cookies.get("refresh_token")
    await svc.logout(token, None)
    return {"ok": True}


@router.get("/tenants", permission=Permission(Resource.IDENTITY_TENANT, Action.LIST), summary="List my tenants")
async def list_tenants(svc: IdentityServiceDep, principal: CurrentPrincipal) -> list[TenantMembership]:
    return await svc.list_tenants(UUID(principal.sub))


@router.post(
    "/switch-tenant",
    permission=Permission(Resource.IDENTITY_TENANT, Action.UPDATE),
    summary="Switch active tenant",
)
async def switch_tenant(
    body: SwitchTenantRequest, svc: IdentityServiceDep, principal: CurrentPrincipal, request: Request
) -> TokenResponse:
    return await svc.switch_tenant(UUID(principal.sub), body.tenant_id, ip=client_ip(request))


@router.post(
    "/invitations",
    permission=Permission(Resource.IDENTITY_USER, Action.CREATE),
    summary="Invite a user to the current tenant",
    status_code=201,
)
async def invite(body: InviteRequest, svc: IdentityServiceDep, principal: CurrentPrincipal, request: Request) -> dict:
    raw = await svc.invite(UUID(principal.tid), UUID(principal.sub), body, ip=client_ip(request))
    return {"token": raw}  # returned for dev; EmailSender delivers in real envs


@router.post("/invitations/accept", permission=PUBLIC, summary="Accept an invitation")
async def accept_invite(body: AcceptInviteRequest, svc: IdentityServiceDep, request: Request) -> TokenResponse:
    return await svc.accept_invite(body, ip=client_ip(request))


@router.post(
    "/users/disable",
    permission=Permission(Resource.IDENTITY_USER, Action.DELETE),
    summary="Disable a user in the current tenant",
)
async def disable_user(body: DisableUserRequest, svc: IdentityServiceDep, principal: CurrentPrincipal) -> dict:
    await svc.disable_user(UUID(principal.tid), UUID(principal.sub), body.user_id)
    return {"ok": True}


@router.get(
    "/audit",
    permission=Permission(Resource.IDENTITY_AUDIT, Action.LIST),
    summary="Export audit events for the current tenant",
)
async def export_audit(
    svc: IdentityServiceDep,
    principal: CurrentPrincipal,
    since: datetime | None = None,
    until: datetime | None = None,
    action: str | None = None,
    limit: int = 100,
) -> list[AuditEventOut]:
    return await svc.export_audit(UUID(principal.tid), since=since, until=until, action=action, limit=min(limit, 1000))


@router.post("/mfa/enroll", permission=Permission(Resource.IDENTITY_USER, Action.UPDATE), summary="Enroll TOTP MFA")
async def mfa_enroll(svc: IdentityServiceDep, principal: CurrentPrincipal) -> MfaEnrollResponse:
    return await svc.enroll_mfa(UUID(principal.sub))


@router.post("/mfa/confirm", permission=Permission(Resource.IDENTITY_USER, Action.UPDATE), summary="Confirm TOTP MFA")
async def mfa_confirm(body: MfaConfirmRequest, svc: IdentityServiceDep, principal: CurrentPrincipal) -> dict[str, bool]:
    await svc.confirm_mfa(UUID(principal.sub), body.code)
    return {"ok": True}


@router.post("/mfa/complete", permission=PUBLIC, summary="Complete login after MFA challenge")
async def mfa_complete(body: dict, svc: IdentityServiceDep, request: Request) -> TokenResponse:
    return await svc.complete_mfa(str(body["mfa_token"]), str(body["code"]), ip=client_ip(request))


@router.post("/sso/start", permission=PUBLIC, summary="Start per-tenant OIDC login")
async def sso_start(body: SsoStartRequest, svc: IdentityServiceDep) -> SsoStartResponse:
    return await svc.sso_start(body.tenant_slug, body.return_to)


@router.get("/sso/callback", permission=PUBLIC, summary="OIDC callback")
async def sso_callback(code: str, state: str, svc: IdentityServiceDep, request: Request) -> TokenResponse:
    return await svc.sso_callback(code, state, ip=client_ip(request))


@router.put(
    "/sso/oidc",
    permission=Permission(Resource.IDENTITY_TENANT, Action.UPDATE),
    summary="Configure tenant OIDC connection",
)
async def upsert_oidc(
    body: UpsertOidcConnectionRequest, svc: IdentityServiceDep, principal: CurrentPrincipal
) -> dict[str, bool]:
    await svc.upsert_oidc_connection(UUID(principal.tid), body)
    return {"ok": True}


@router.post(
    "/api-keys",
    permission=Permission(Resource.IDENTITY_USER, Action.CREATE),
    summary="Create API key",
    status_code=201,
)
async def create_api_key(
    body: CreateApiKeyRequest, svc: IdentityServiceDep, principal: CurrentPrincipal
) -> CreateApiKeyResponse:
    return await svc.create_api_key(UUID(principal.tid), body.name, body.role)


@router.delete(
    "/api-keys/{key_id}",
    permission=Permission(Resource.IDENTITY_USER, Action.DELETE),
    summary="Revoke API key",
)
async def revoke_api_key(key_id: UUID, svc: IdentityServiceDep, principal: CurrentPrincipal) -> dict[str, bool]:
    await svc.revoke_api_key(UUID(principal.tid), key_id)
    return {"ok": True}


@router.post(
    "/scim-token",
    permission=Permission(Resource.IDENTITY_USER, Action.CREATE),
    summary="Issue per-tenant SCIM bearer token",
    status_code=201,
)
async def issue_scim_token(svc: IdentityServiceDep, principal: CurrentPrincipal) -> ScimTokenResponse:
    return await svc.issue_scim_token(UUID(principal.tid))
