import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { itemsApi } from "../api/items.api";
import { itemsKeys } from "../api/items.keys";
import { MAX_PAGE_SIZE } from "../model/item.constants";
import type { ItemsSearch } from "../model/item.schema";

export function useItems(search: ItemsSearch) {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: itemsKeys.list(tenantId, search),
    queryFn: () => itemsApi.list(client, search),
    placeholderData: keepPreviousData,
  });
}

export function useItem(id: string | undefined) {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: itemsKeys.detail(tenantId, id ?? ""),
    queryFn: () => itemsApi.get(client, id as string),
    enabled: Boolean(id),
  });
}

export type ItemOption = { value: string; label: string };

/** Select-friendly list of items; used by pickers in other modules. */
export function useItemOptions(params: { q?: string } = {}) {
  const { client, tenantId } = useApi();
  const search: ItemsSearch = {
    page: 1,
    pageSize: MAX_PAGE_SIZE,
    q: params.q,
    status: undefined,
  };
  return useQuery({
    queryKey: [...itemsKeys.options(tenantId), params.q ?? ""] as const,
    queryFn: () => itemsApi.list(client, search),
    select: (page): ItemOption[] =>
      page.items.map((item) => ({ value: item.id, label: `${item.name} (${item.sku})` })),
    staleTime: 60_000,
  });
}
