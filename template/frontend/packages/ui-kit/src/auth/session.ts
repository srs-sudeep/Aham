import type { Principal } from "./types";

export type Session = { token: string; principal: Principal };

const TOKEN_KEY = "aham.auth.token";
const PRINCIPAL_KEY = "aham.auth.principal";

function load(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    const raw = window.localStorage.getItem(PRINCIPAL_KEY);
    if (!token || !raw) return null;
    return { token, principal: JSON.parse(raw) as Principal };
  } catch {
    return null;
  }
}

function persist(session: Session | null) {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(PRINCIPAL_KEY);
      return;
    }
    window.localStorage.setItem(TOKEN_KEY, session.token);
    window.localStorage.setItem(PRINCIPAL_KEY, JSON.stringify(session.principal));
  } catch {
    // storage unavailable; the in-memory session still works for this tab
  }
}

let current: Session | null = load();
const listeners = new Set<() => void>();

/**
 * The one source of truth for the signed-in session, readable outside React
 * (API client, token refresh) and subscribed to by `AuthProvider`.
 */
export const sessionStore = {
  get: (): Session | null => current,
  getToken: (): string | null => current?.token ?? null,
  set(next: Session | null) {
    current = next;
    persist(next);
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
