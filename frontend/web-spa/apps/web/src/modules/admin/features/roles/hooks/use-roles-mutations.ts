import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { rolesApi } from "../api/roles.api";
import { rolesKeys } from "../api/roles.keys";
import type {
  CreateRoleFormValues,
  SetRolePermissionsInput,
  UpdateRoleInput,
} from "../model/roles.schema";

export function useCreateRole() {
  const { client, tenantId } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleFormValues) => rolesApi.create(client, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesKeys.all(tenantId) }),
  });
}

export function useUpdateRole() {
  const { client, tenantId } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, input }: { roleId: string; input: UpdateRoleInput }) =>
      rolesApi.update(client, roleId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesKeys.all(tenantId) }),
  });
}

export function useDeleteRole() {
  const { client, tenantId } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => rolesApi.remove(client, roleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesKeys.all(tenantId) }),
  });
}

export function useSetRolePermissions() {
  const { client, tenantId } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, input }: { roleId: string; input: SetRolePermissionsInput }) =>
      rolesApi.setPermissions(client, roleId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesKeys.all(tenantId) }),
  });
}
