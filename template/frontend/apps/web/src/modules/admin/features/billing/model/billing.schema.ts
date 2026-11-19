/** Wire + domain shapes for billing plans / subscription. */

export type Plan = {
  code: string;
  name: string;
  interval: string;
  features: Record<string, boolean | number>;
};

export type PlanDto = {
  code: string;
  name: string;
  interval: string;
  features: Record<string, boolean | number>;
};

export function toPlan(dto: PlanDto): Plan {
  return {
    code: dto.code,
    name: dto.name,
    interval: dto.interval,
    features: dto.features ?? {},
  };
}

export type Subscription = {
  tenantId: string;
  planCode: string;
  status: string;
  periodEnd: string;
  graceUntil: string | null;
  features: Record<string, boolean>;
  quotas: Record<string, number>;
};

export type SubscriptionDto = {
  tenant_id: string;
  plan_code: string;
  status: string;
  period_end: string;
  grace_until: string | null;
  features: Record<string, boolean>;
  quotas: Record<string, number>;
};

export function toSubscription(dto: SubscriptionDto): Subscription {
  return {
    tenantId: dto.tenant_id,
    planCode: dto.plan_code,
    status: dto.status,
    periodEnd: dto.period_end,
    graceUntil: dto.grace_until,
    features: dto.features ?? {},
    quotas: dto.quotas ?? {},
  };
}

export type CheckoutResponse = {
  checkoutUrl: string;
};

export type CheckoutResponseDto = {
  checkout_url: string;
};
