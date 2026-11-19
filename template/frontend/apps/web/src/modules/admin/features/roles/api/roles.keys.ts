export const rolesKeys = {
  all: (tenantId: string | null) => ["admin", "roles", tenantId] as const,
  lists: (tenantId: string | null) => [...rolesKeys.all(tenantId), "list"] as const,
  list: (tenantId: string | null) => [...rolesKeys.lists(tenantId)] as const,
  details: (tenantId: string | null) => [...rolesKeys.all(tenantId), "detail"] as const,
  detail: (tenantId: string | null, roleId: string) =>
    [...rolesKeys.details(tenantId), roleId] as const,
  permissions: (tenantId: string | null) => [...rolesKeys.all(tenantId), "permissions"] as const,
};
