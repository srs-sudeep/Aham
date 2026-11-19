import {
  createApiClient,
  getStoredTenantId,
  principalFromAccessToken,
  sessionStore,
} from "@aham/ui-kit";

const DEFAULT_API_BASE_URL = "http://localhost:8001/api/v1";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/$/,
  "",
);

/**
 * `saas`: platform-kit identity (password / SSO login, httpOnly refresh cookie, tenant switch).
 * `dev`: local mock principal, no auth calls (MSW demos, e2e smoke).
 */
export const AUTH_MODE: "saas" | "dev" =
  (import.meta.env.VITE_AUTH_MODE ?? "saas") === "dev" ? "dev" : "saas";

/** Endpoints that must never trigger a token refresh (they establish or end the session). */
const SESSION_ENDPOINTS =
  /^\/auth\/(login|register|refresh|logout|select-tenant|mfa\/complete|sso\/|invitations\/accept)/;

type TokenResponse = { access_token: string; tenant_id?: string | null };

/** Rotate the refresh cookie and store the new access token. Returns null when signed out. */
export async function refreshSession(): Promise<string | null> {
  if (AUTH_MODE !== "saas") return null;
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as TokenResponse;
  const previous = sessionStore.get()?.principal;
  const principal = principalFromAccessToken(body.access_token, {
    email: previous?.email,
    name: previous?.name,
  });
  if (!principal) return null;
  sessionStore.set({ token: body.access_token, principal });
  return body.access_token;
}

export const apiClient = createApiClient({
  baseUrl: API_BASE_URL,
  credentials: AUTH_MODE === "saas" ? "include" : "same-origin",
  getToken: () => sessionStore.getToken(),
  // The API reads the tenant from the token (`tid`); the header only scopes MSW mock data.
  getTenantId: () => getStoredTenantId(),
  refresh: refreshSession,
  skipRefresh: (path) => SESSION_ENDPOINTS.test(path),
  onUnauthorized: () => {
    sessionStore.set(null);
    if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
  },
});
