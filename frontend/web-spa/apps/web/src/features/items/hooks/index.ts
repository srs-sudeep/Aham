import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { createItemsApi } from "../api";

const api = createItemsApi(apiClient);

export function useItemsQuery() {
  return useQuery({
    queryKey: ["items", "list"],
    queryFn: () => api.list(),
  });
}

export function useItemQuery(id: string) {
  return useQuery({
    queryKey: ["items", id],
    queryFn: () => api.get(id),
    enabled: Boolean(id),
  });
}
