import { useQuery } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { categoriesApi } from "../api/categories.api";
import { categoriesKeys } from "../api/categories.keys";
import type { CategoriesSearch } from "../model/category.schema";

export function useCategories(search: CategoriesSearch) {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: categoriesKeys.list(tenantId, search),
    queryFn: () => categoriesApi.list(client, search),
  });
}

export function useCategory(id: string | undefined) {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: categoriesKeys.detail(tenantId, id ?? ""),
    queryFn: () => categoriesApi.get(client, id as string),
    enabled: Boolean(id),
  });
}
