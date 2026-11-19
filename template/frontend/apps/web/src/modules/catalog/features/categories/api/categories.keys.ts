import type { CategoriesSearch } from "../model/category.schema";

/**
 * Tenant-scoped query keys. The `["catalog", "categories", tenantId]` prefix is
 * shared with the category-options lookup in `shared/hooks`, so invalidating
 * `all(tenantId)` refreshes pickers as well.
 */
export const categoriesKeys = {
  all: (tenantId: string | null) => ["catalog", "categories", tenantId] as const,
  lists: (tenantId: string | null) => [...categoriesKeys.all(tenantId), "list"] as const,
  list: (tenantId: string | null, search: CategoriesSearch) =>
    [...categoriesKeys.lists(tenantId), search] as const,
  details: (tenantId: string | null) => [...categoriesKeys.all(tenantId), "detail"] as const,
  detail: (tenantId: string | null, id: string) =>
    [...categoriesKeys.details(tenantId), id] as const,
};
