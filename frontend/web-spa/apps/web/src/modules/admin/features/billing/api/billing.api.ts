import type { ApiClient } from "@aham/ui-kit";
import {
  toPlan,
  toSubscription,
  type CheckoutResponse,
  type CheckoutResponseDto,
  type Plan,
  type PlanDto,
  type Subscription,
  type SubscriptionDto,
} from "../model/billing.schema";

/** Thin HTTP layer for self-service billing. */
export const billingApi = {
  async listPlans(client: ApiClient): Promise<Plan[]> {
    const rows = await client.get<PlanDto[]>("/billing/plans");
    return rows.map(toPlan);
  },

  async getSubscription(client: ApiClient): Promise<Subscription> {
    const dto = await client.get<SubscriptionDto>("/billing/subscription");
    return toSubscription(dto);
  },

  async checkout(client: ApiClient, planCode: string): Promise<CheckoutResponse> {
    const dto = await client.post<CheckoutResponseDto>("/billing/checkout", {
      plan_code: planCode,
    });
    return { checkoutUrl: dto.checkout_url };
  },

  async cancel(client: ApiClient): Promise<Subscription> {
    const dto = await client.post<SubscriptionDto>("/billing/subscription/cancel");
    return toSubscription(dto);
  },
};
