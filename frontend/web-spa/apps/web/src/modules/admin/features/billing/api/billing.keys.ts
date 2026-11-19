export const billingKeys = {
  all: (tenantId: string | null) => ["admin", "billing", tenantId] as const,
  plans: (tenantId: string | null) => [...billingKeys.all(tenantId), "plans"] as const,
  subscription: (tenantId: string | null) =>
    [...billingKeys.all(tenantId), "subscription"] as const,
};
