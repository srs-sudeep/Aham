import { useQuery } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { usersApi } from "../api/users.api";
import { usersKeys } from "../api/users.keys";

export function useUsers() {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: usersKeys.list(tenantId),
    queryFn: () => usersApi.list(client),
  });
}
