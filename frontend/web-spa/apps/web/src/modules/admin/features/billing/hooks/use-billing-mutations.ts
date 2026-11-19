import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { billingApi } from "../api/billing.api";
import { billingKeys } from "../api/billing.keys";

export function useCheckout() {
  const { client, tenantId } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planCode: string) => billingApi.checkout(client, planCode),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: billingKeys.subscription(tenantId) }),
  });
}

export function useCancelSubscription() {
  const { client, tenantId } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => billingApi.cancel(client),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: billingKeys.all(tenantId) }),
  });
}
