import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Tenant = {
  id: string;
  name: string;
};

export const TENANT_STORAGE_KEY = "aham.tenant.id";

type TenantContextValue = {
  tenants: Tenant[];
  tenant: Tenant | null;
  tenantId: string | null;
  setTenantId: (id: string) => void;
};

const TenantContext = createContext<TenantContextValue | null>(null);

/** Read the persisted tenant id outside React (e.g. for `createApiClient`). */
export function getStoredTenantId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TENANT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Persist the active tenant outside React (e.g. align it with the token's `tid` before mount). */
export function setStoredTenantId(id: string | null): void {
  persist(id);
}

function persist(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(TENANT_STORAGE_KEY, id);
    else window.localStorage.removeItem(TENANT_STORAGE_KEY);
  } catch {
    // storage unavailable; ignore
  }
}

function resolveInitial(tenants: Tenant[], preferred?: string | null): string | null {
  const stored = getStoredTenantId();
  for (const candidate of [stored, preferred]) {
    if (candidate && tenants.some((t) => t.id === candidate)) return candidate;
  }
  return tenants[0]?.id ?? null;
}

export function TenantProvider({
  tenants,
  defaultTenantId,
  onTenantChange,
  children,
}: {
  tenants: Tenant[];
  defaultTenantId?: string | null;
  /** Called after the active tenant changes (use to clear the query cache). */
  onTenantChange?: (nextTenantId: string, previousTenantId: string | null) => void;
  children: ReactNode;
}) {
  const [tenantId, setTenantIdState] = useState<string | null>(() => {
    const initial = resolveInitial(tenants, defaultTenantId);
    persist(initial);
    return initial;
  });

  const currentRef = useRef(tenantId);
  currentRef.current = tenantId;
  const callbackRef = useRef(onTenantChange);
  callbackRef.current = onTenantChange;
  const tenantsRef = useRef(tenants);
  tenantsRef.current = tenants;

  const setTenantId = useCallback((id: string) => {
    const previous = currentRef.current;
    if (id === previous) return;
    if (!tenantsRef.current.some((t) => t.id === id)) return;
    currentRef.current = id;
    persist(id);
    setTenantIdState(id);
    callbackRef.current?.(id, previous);
  }, []);

  // If the tenant list changes and the active tenant is no longer valid, fall back.
  useEffect(() => {
    if (tenants.length === 0) return;
    if (tenantId && tenants.some((t) => t.id === tenantId)) return;
    const fallback = tenants[0]?.id;
    if (fallback) setTenantId(fallback);
  }, [tenants, tenantId, setTenantId]);

  const value = useMemo<TenantContextValue>(
    () => ({
      tenants,
      tenantId,
      tenant: tenants.find((t) => t.id === tenantId) ?? null,
      setTenantId,
    }),
    [tenants, tenantId, setTenantId],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
