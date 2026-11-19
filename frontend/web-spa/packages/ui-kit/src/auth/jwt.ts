import type { Permission, Principal } from "./types";

/** Decode a JWT payload without verifying it. The API verifies; the UI only reads claims. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
    const payload: unknown = JSON.parse(json);
    return typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Build a UI principal from a platform-kit access token (`sub`, `tid`, `roles`, `permissions`). */
export function principalFromAccessToken(
  token: string,
  extra: Partial<Pick<Principal, "email" | "name">> = {},
): Principal | null {
  const claims = decodeJwtPayload(token);
  if (!claims || typeof claims.sub !== "string") return null;
  return {
    id: claims.sub,
    email: extra.email ?? (typeof claims.email === "string" ? claims.email : undefined),
    name: extra.name ?? (typeof claims.name === "string" ? claims.name : undefined),
    tenantId: typeof claims.tid === "string" ? claims.tid : null,
    roles: stringList(claims.roles),
    permissions: stringList(claims.permissions) as Permission[],
  };
}
