import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { categoriesApi } from "../api/categories.api";
import { categoriesKeys } from "../api/categories.keys";
import type { CategoryInput } from "../model/category.schema";

function useInvalidateCategories() {
  const queryClient = useQueryClient();
  const { tenantId } = useApi();
  return () => queryClient.invalidateQueries({ queryKey: categoriesKeys.all(tenantId) });
}

export function useCreateCategory() {
  const { client } = useApi();
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (input: CategoryInput) => categoriesApi.create(client, input),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory(id: string) {
  const { client } = useApi();
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (input: CategoryInput) => categoriesApi.update(client, id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const { client } = useApi();
  const invalidate = useInvalidateCategories();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.delete(client, id),
    onSuccess: invalidate,
  });
}
