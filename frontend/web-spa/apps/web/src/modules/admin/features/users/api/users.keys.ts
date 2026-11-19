export const usersKeys = {
  all: (tenantId: string | null) => ["admin", "users", tenantId] as const,
  lists: (tenantId: string | null) => [...usersKeys.all(tenantId), "list"] as const,
  list: (tenantId: string | null) => [...usersKeys.lists(tenantId)] as const,
};
