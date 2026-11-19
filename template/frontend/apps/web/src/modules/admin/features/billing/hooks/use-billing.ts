import { useQuery } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { billingApi } from "../api/billing.api";
import { billingKeys } from "../api/billing.keys";

export function usePlans() {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: billingKeys.plans(tenantId),
    queryFn: () => billingApi.listPlans(client),
  });
}

export function useSubscription() {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: billingKeys.subscription(tenantId),
    queryFn: () => billingApi.getSubscription(client),
  });
}
