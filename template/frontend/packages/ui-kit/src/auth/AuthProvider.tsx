import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { sessionStore } from "./session";
import { hasPermission, type Permission, type Principal } from "./types";

type AuthContextValue = {
  principal: Principal | null;
  token: string | null;
  setSession: (token: string | null, principal: Principal | null) => void;
  logout: () => void;
  can: (permission: Permission | Permission[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  onLogout,
}: {
  children: ReactNode;
  /** Server-side sign-out (e.g. revoke the refresh cookie). Runs before local state is cleared. */
  onLogout?: () => void | Promise<void>;
}) {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  const setSession = useCallback((nextToken: string | null, nextPrincipal: Principal | null) => {
    sessionStore.set(
      nextToken && nextPrincipal ? { token: nextToken, principal: nextPrincipal } : null,
    );
  }, []);

  const logout = useCallback(() => {
    const remote = onLogoutRef.current?.();
    const clear = () => sessionStore.set(null);
    if (remote instanceof Promise) void remote.catch(() => undefined).finally(clear);
    else clear();
  }, []);

  const principal = session?.principal ?? null;
  const token = session?.token ?? null;
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
