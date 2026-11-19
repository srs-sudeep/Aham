import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { usersApi } from "../api/users.api";
import { usersKeys } from "../api/users.keys";
import type { InviteFormValues, UpdateTenantUserInput } from "../model/users.schema";

export function useInviteUser() {
  const { client, tenantId } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteFormValues) => usersApi.invite(client, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.all(tenantId) }),
  });
}

export function useUpdateUser() {
  const { client, tenantId } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: UpdateTenantUserInput }) =>
      usersApi.update(client, userId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.all(tenantId) }),
  });
}
