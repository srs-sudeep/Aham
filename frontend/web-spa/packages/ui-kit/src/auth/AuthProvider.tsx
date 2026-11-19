import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { hasPermission, type Permission, type Principal } from "./types";

type AuthContextValue = {
  principal: Principal | null;
  token: string | null;
  setSession: (token: string | null, principal: Principal | null) => void;
  logout: () => void;
  can: (permission: Permission | Permission[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "aham.auth.token";
const PRINCIPAL_KEY = "aham.auth.principal";

function loadSession(): { token: string | null; principal: Principal | null } {
  if (typeof window === "undefined") return { token: null, principal: null };
  const token = window.localStorage.getItem(TOKEN_KEY);
  const raw = window.localStorage.getItem(PRINCIPAL_KEY);
  if (!token || !raw) return { token: null, principal: null };
  try {
    return { token, principal: JSON.parse(raw) as Principal };
  } catch {
    return { token: null, principal: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = loadSession();
  const [token, setToken] = useState<string | null>(initial.token);
  const [principal, setPrincipal] = useState<Principal | null>(initial.principal);

  const setSession = useCallback((nextToken: string | null, nextPrincipal: Principal | null) => {
    setToken(nextToken);
    setPrincipal(nextPrincipal);
    if (!nextToken || !nextPrincipal) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(PRINCIPAL_KEY);
      return;
    }
    window.localStorage.setItem(TOKEN_KEY, nextToken);
    window.localStorage.setItem(PRINCIPAL_KEY, JSON.stringify(nextPrincipal));
  }, []);

  const logout = useCallback(() => setSession(null, null), [setSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      principal,
      token,
      setSession,
      logout,
      can: (permission) => hasPermission(principal, permission),
    }),
    [principal, token, setSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuth();
  return <>{can(permission) ? children : fallback}</>;
}
