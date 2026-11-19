"""Identity HTTP endpoints."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import Depends, Request, Response
from fastapi.responses import RedirectResponse

from core_api.modules.identity.dependencies import IdentityServiceDep
from core_api.modules.identity.schemas import (
    AcceptInviteRequest,
    AuditEventOut,
    CreateApiKeyRequest,
    CreateApiKeyResponse,
    CreateRoleRequest,
    DisableUserRequest,
    InviteRequest,
    LoginRequest,
    MfaCompleteRequest,
    MfaConfirmRequest,
    MfaEnrollResponse,
    MfaRequiredResponse,
    PermissionOut,
    RefreshRequest,
    RegisterRequest,
    RoleOut,
    ScimTokenResponse,
    SelectTenantRequest,
    SetRolePermissionsRequest,
    SsoLoginResult,
    SsoStartRequest,
    SsoStartResponse,
    SwitchTenantRequest,
    TenantMembership,
    TenantSelectionResponse,
    TenantUserOut,
    TokenResponse,
    UpdateRoleRequest,
    UpdateTenantUserRequest,
    UpsertOidcConnectionRequest,
)
from core_api.modules.identity.scim_router import router as scim_router
from core_api.permissions import Resource
from platform_kit import PUBLIC, Action, Permission, SecureRouter
from platform_kit.errors import UnauthorizedError
from platform_kit.rate_limit import client_ip, rate_limit
from platform_kit.security import (
    CurrentPrincipal,
    clear_refresh_cookie,
    deliver_refresh_token,
    read_refresh_token,
)
from platform_kit.tenancy import TenantIdDep

router = SecureRouter(prefix="/auth", tags=["auth"])
extra_routers = [scim_router]


def _login_key(request: Request) -> str:
    return f"login:{client_ip(request)}"


def _deliver(tokens: TokenResponse, request: Request, response: Response) -> TokenResponse:
    tokens.refresh_token = deliver_refresh_token(response, request.app.state.settings, tokens.refresh_token)
    return tokens


def _sso_response(result: SsoLoginResult, request: Request, response: Response) -> TokenResponse | RedirectResponse:
    """Browser SSO: set the refresh cookie and bounce to the SPA, which then calls /auth/refresh."""
    settings = request.app.state.settings
    if not settings.frontend_url:
        return _deliver(result.tokens, request, response)
    redirect = RedirectResponse(f"{settings.frontend_url.rstrip('/')}{result.return_to}", status_code=303)
    deliver_refresh_token(redirect, settings, result.tokens.refresh_token)
    return redirect


@router.post(
    "/register",
    permission=PUBLIC,
    summary="Register a user and create a tenant",
    status_code=201,
    dependencies=[Depends(rate_limit(limit=5, window_seconds=60, key_fn=_login_key))],
)
async def register(
    body: RegisterRequest, svc: IdentityServiceDep, request: Request, response: Response
) -> TokenResponse:
    return _deliver(await svc.register(body, ip=client_ip(request)), request, response)


@router.post(
    "/login",
    permission=PUBLIC,
    summary="Login with email and password",
    dependencies=[Depends(rate_limit(limit=10, window_seconds=60, key_fn=_login_key))],
)
async def login(
    body: LoginRequest, svc: IdentityServiceDep, request: Request, response: Response
) -> TokenResponse | TenantSelectionResponse | MfaRequiredResponse:
    result = await svc.login(body, ip=client_ip(request))
    if isinstance(result, TokenResponse):
        return _deliver(result, request, response)
    return result


@router.post("/select-tenant", permission=PUBLIC, summary="Select tenant after multi-org login")
async def select_tenant(
    body: SelectTenantRequest, svc: IdentityServiceDep, request: Request, response: Response
) -> TokenResponse:
    return _deliver(
        await svc.select_tenant(body.session_token, body.tenant_id, ip=client_ip(request)), request, response
    )


@router.post("/refresh", permission=PUBLIC, summary="Rotate refresh token")
async def refresh(
    svc: IdentityServiceDep, request: Request, response: Response, body: RefreshRequest | None = None
) -> TokenResponse:
    token = read_refresh_token(request, request.app.state.settings, body.refresh_token if body else None)
    if not token:
        raise UnauthorizedError("Please sign in again.", detail="missing refresh token")
    return _deliver(await svc.refresh(token), request, response)


@router.post("/logout", permission=PUBLIC, summary="Revoke refresh token")
async def logout(
    svc: IdentityServiceDep, request: Request, response: Response, body: RefreshRequest | None = None
) -> dict[str, bool]:
    settings = request.app.state.settings
    await svc.logout(read_refresh_token(request, settings, body.refresh_token if body else None), None)
    clear_refresh_cookie(response, settings)
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
    body: SwitchTenantRequest,
    svc: IdentityServiceDep,
    principal: CurrentPrincipal,
    request: Request,
    response: Response,
) -> TokenResponse:
    tokens = await svc.switch_tenant(UUID(principal.sub), body.tenant_id, ip=client_ip(request))
    return _deliver(tokens, request, response)


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
async def accept_invite(
    body: AcceptInviteRequest, svc: IdentityServiceDep, request: Request, response: Response
) -> TokenResponse:
    return _deliver(await svc.accept_invite(body, ip=client_ip(request)), request, response)


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
    *,
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
async def mfa_complete(
    body: MfaCompleteRequest, svc: IdentityServiceDep, request: Request, response: Response
) -> TokenResponse:
    return _deliver(await svc.complete_mfa(body.mfa_token, body.code, ip=client_ip(request)), request, response)


@router.post("/sso/start", permission=PUBLIC, summary="Start per-tenant OIDC login")
async def sso_start(body: SsoStartRequest, svc: IdentityServiceDep) -> SsoStartResponse:
    return await svc.sso_start(body.tenant_slug, body.return_to)


@router.get(
    "/sso/callback",
    permission=PUBLIC,
    summary="OIDC callback (redirects to FRONTEND_URL when set)",
    response_model=TokenResponse,
)
async def sso_callback(code: str, state: str, svc: IdentityServiceDep, request: Request, response: Response):
    result = await svc.sso_callback(code, state, ip=client_ip(request))
    return _sso_response(result, request, response)


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


@router.get(
    "/users",
    permission=Permission(Resource.IDENTITY_USER, Action.LIST),
    summary="List users in the current tenant",
)
async def list_users(svc: IdentityServiceDep, tenant_id: TenantIdDep) -> list[TenantUserOut]:
    return await svc.list_tenant_users(tenant_id)


@router.get(
    "/users/{user_id}",
    permission=Permission(Resource.IDENTITY_USER, Action.READ),
    summary="Get a tenant membership",
)
async def get_user(user_id: UUID, svc: IdentityServiceDep, tenant_id: TenantIdDep) -> TenantUserOut:
    return await svc.get_tenant_user(tenant_id, user_id)


@router.patch(
    "/users/{user_id}",
    permission=Permission(Resource.IDENTITY_USER, Action.UPDATE),
    summary="Update a member's role or membership status",
)
async def update_user(
    user_id: UUID, body: UpdateTenantUserRequest, svc: IdentityServiceDep, tenant_id: TenantIdDep
) -> TenantUserOut:
    return await svc.update_tenant_user(tenant_id, user_id, body)


@router.get(
    "/roles",
    permission=Permission(Resource.IDENTITY_ROLE, Action.LIST),
    summary="List system and tenant roles",
)
async def list_roles(svc: IdentityServiceDep, tenant_id: TenantIdDep) -> list[RoleOut]:
    return await svc.list_roles(tenant_id)


@router.post(
    "/roles",
    permission=Permission(Resource.IDENTITY_ROLE, Action.CREATE),
    summary="Create a tenant-custom role",
    status_code=201,
)
async def create_role(body: CreateRoleRequest, svc: IdentityServiceDep, tenant_id: TenantIdDep) -> RoleOut:
    return await svc.create_role(tenant_id, body)


@router.get(
    "/roles/{role_id}",
    permission=Permission(Resource.IDENTITY_ROLE, Action.READ),
    summary="Get a role and its permissions",
)
async def get_role(role_id: UUID, svc: IdentityServiceDep, tenant_id: TenantIdDep) -> RoleOut:
    return await svc.get_role(tenant_id, role_id)


@router.patch(
    "/roles/{role_id}",
    permission=Permission(Resource.IDENTITY_ROLE, Action.UPDATE),
    summary="Rename a tenant-custom role",
)
async def update_role(
    role_id: UUID, body: UpdateRoleRequest, svc: IdentityServiceDep, tenant_id: TenantIdDep
) -> RoleOut:
    return await svc.update_role(tenant_id, role_id, body)


@router.delete(
    "/roles/{role_id}",
    permission=Permission(Resource.IDENTITY_ROLE, Action.DELETE),
    summary="Delete a tenant-custom role",
    status_code=204,
)
async def delete_role(role_id: UUID, svc: IdentityServiceDep, tenant_id: TenantIdDep) -> None:
    await svc.delete_role(tenant_id, role_id)


@router.put(
    "/roles/{role_id}/permissions",
    permission=Permission(Resource.IDENTITY_ROLE, Action.UPDATE),
    summary="Replace grants on a tenant-custom role",
)
async def set_role_permissions(
    role_id: UUID, body: SetRolePermissionsRequest, svc: IdentityServiceDep, tenant_id: TenantIdDep
) -> RoleOut:
    return await svc.set_role_permissions(tenant_id, role_id, body)


@router.get(
    "/permissions",
    permission=Permission(Resource.IDENTITY_PERMISSION, Action.LIST),
    summary="List the permission catalog",
)
async def list_permissions(svc: IdentityServiceDep) -> list[PermissionOut]:
    return await svc.list_permission_catalog()
