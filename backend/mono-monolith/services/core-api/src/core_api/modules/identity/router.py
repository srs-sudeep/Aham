"""Identity HTTP endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import Depends, Request

from core_api.modules.identity.dependencies import IdentityServiceDep
from core_api.modules.identity.schemas import (
    AcceptInviteRequest,
    AuditEventOut,
    DisableUserRequest,
    InviteRequest,
    LoginRequest,
    RegisterRequest,
    SelectTenantRequest,
    SwitchTenantRequest,
    TenantMembership,
    TenantSelectionResponse,
    TokenResponse,
)
from core_api.permissions import Resource
from platform_kit import PUBLIC, Action, Permission, SecureRouter
from platform_kit.rate_limit import client_ip, rate_limit
from platform_kit.security import CurrentPrincipal

router = SecureRouter(prefix="/auth", tags=["auth"])


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
) -> TokenResponse | TenantSelectionResponse:
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
