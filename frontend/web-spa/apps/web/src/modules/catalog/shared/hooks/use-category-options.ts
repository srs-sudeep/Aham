import { useQuery } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { categoriesLookupApi } from "../api/categories-lookup.api";

/**
 * Shares the `["catalog", "categories", tenantId]` prefix with the categories
 * feature keys, so any categories mutation invalidates the options as well.
 */
export const categoryOptionsKey = (tenantId: string | null) =>
  ["catalog", "categories", tenantId, "options"] as const;

export function useCategoryOptions() {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: categoryOptionsKey(tenantId),
    queryFn: () => categoriesLookupApi.options(client),
    staleTime: 60_000,
  });
}
