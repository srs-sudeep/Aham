import { useQuery } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { rolesApi } from "../api/roles.api";
import { rolesKeys } from "../api/roles.keys";

export function useRoles() {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: rolesKeys.list(tenantId),
    queryFn: () => rolesApi.list(client),
  });
}

export function useRole(roleId: string) {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: rolesKeys.detail(tenantId, roleId),
    queryFn: () => rolesApi.get(client, roleId),
    enabled: Boolean(roleId),
  });
}

export function usePermissionCatalog() {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: rolesKeys.permissions(tenantId),
    queryFn: () => rolesApi.listPermissions(client),
  });
}
