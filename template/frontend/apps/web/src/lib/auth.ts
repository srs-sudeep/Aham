import { principalFromAccessToken, sessionStore, type Tenant } from "@aham/ui-kit";
import { apiClient, AUTH_MODE } from "./api";

/** Calls into the platform-kit identity module (`/auth/*`). */

type TokenResponse = { access_token: string; tenant_id?: string | null };
type TenantChoice = { tenant_id: string; slug: string; name: string; role: string };
type TenantSelection = {
  requires_tenant_selection: true;
  session_token: string;
  tenants: TenantChoice[];
};
type MfaChallenge = { requires_mfa: true; mfa_token: string };

export type LoginStep =
  | { kind: "done" }
  | { kind: "select-tenant"; sessionToken: string; tenants: TenantChoice[] }
  | { kind: "mfa"; mfaToken: string };

function startSession(tokens: TokenResponse, email?: string): void {
  const principal = principalFromAccessToken(tokens.access_token, {
    email,
    name: email?.split("@")[0],
  });
  if (!principal) throw new Error("The server returned an unreadable access token.");
  sessionStore.set({ token: tokens.access_token, principal });
}

export async function login(email: string, password: string): Promise<LoginStep> {
  const res = await apiClient.post<TokenResponse | TenantSelection | MfaChallenge>("/auth/login", {
    email,
    password,
  });
  if ("requires_mfa" in res) return { kind: "mfa", mfaToken: res.mfa_token };
  if ("requires_tenant_selection" in res) {
    return { kind: "select-tenant", sessionToken: res.session_token, tenants: res.tenants };
  }
  startSession(res, email);
  return { kind: "done" };
}

export async function selectTenant(sessionToken: string, tenantId: string, email?: string) {
  startSession(
    await apiClient.post<TokenResponse>("/auth/select-tenant", {
      session_token: sessionToken,
      tenant_id: tenantId,
    }),
    email,
  );
}

export async function completeMfa(mfaToken: string, code: string, email?: string) {
  startSession(
    await apiClient.post<TokenResponse>("/auth/mfa/complete", { mfa_token: mfaToken, code }),
    email,
  );
}

/** Start per-tenant OIDC. The API redirects back to `/login?sso=1` with the refresh cookie set. */
export async function startSso(tenantSlug: string): Promise<void> {
  const res = await apiClient.post<{ authorize_url: string }>("/auth/sso/start", {
    tenant_slug: tenantSlug,
    return_to: "/login?sso=1",
  });
  window.location.assign(res.authorize_url);
}

export async function listTenants(): Promise<Tenant[]> {
  const rows = await apiClient.get<TenantChoice[]>("/auth/tenants");
  return rows.map((row) => ({ id: row.tenant_id, name: row.name }));
}

/** Re-issue the access token for another tenant; the caller clears tenant-scoped caches. */
export async function switchTenant(tenantId: string): Promise<void> {
  const previous = sessionStore.get()?.principal;
  startSession(
    await apiClient.post<TokenResponse>("/auth/switch-tenant", { tenant_id: tenantId }),
    previous?.email,
  );
}

export async function logoutRemote(): Promise<void> {
  if (AUTH_MODE !== "saas") return;
  await apiClient.post("/auth/logout");
}
