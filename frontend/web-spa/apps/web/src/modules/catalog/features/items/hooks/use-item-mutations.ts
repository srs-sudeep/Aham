import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { itemsApi } from "../api/items.api";
import { itemsKeys } from "../api/items.keys";
import type { ItemInput } from "../model/item.schema";

function useInvalidateItems() {
  const queryClient = useQueryClient();
  const { tenantId } = useApi();
  return () => queryClient.invalidateQueries({ queryKey: itemsKeys.all(tenantId) });
}

export function useCreateItem() {
  const { client } = useApi();
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationFn: (input: ItemInput) => itemsApi.create(client, input),
    onSuccess: invalidate,
  });
}

export function useUpdateItem(id: string) {
  const { client } = useApi();
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationFn: (input: ItemInput) => itemsApi.update(client, id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteItem() {
  const { client } = useApi();
  const invalidate = useInvalidateItems();
  return useMutation({
    mutationFn: (id: string) => itemsApi.delete(client, id),
    onSuccess: invalidate,
  });
}
