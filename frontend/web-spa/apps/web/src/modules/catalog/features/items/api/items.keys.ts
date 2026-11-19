import type { ItemsSearch } from "../model/item.schema";

/** Tenant-scoped query keys; every key starts with `all(tenantId)`. */
export const itemsKeys = {
  all: (tenantId: string | null) => ["catalog", "items", tenantId] as const,
  lists: (tenantId: string | null) => [...itemsKeys.all(tenantId), "list"] as const,
  list: (tenantId: string | null, search: ItemsSearch) =>
    [...itemsKeys.lists(tenantId), search] as const,
  options: (tenantId: string | null) => [...itemsKeys.all(tenantId), "options"] as const,
  details: (tenantId: string | null) => [...itemsKeys.all(tenantId), "detail"] as const,
  detail: (tenantId: string | null, id: string) => [...itemsKeys.details(tenantId), id] as const,
};
