import { HttpResponse, http } from "msw";
import type { PlanDto, SubscriptionDto } from "../model/billing.schema";

const PLANS: PlanDto[] = [
  {
    code: "free",
    name: "Free",
    interval: "month",
    features: { catalog: true, seats: 3 },
  },
  {
    code: "pro",
    name: "Pro",
    interval: "month",
    features: { catalog: true, seats: 25 },
  },
];

const subscriptions = new Map<string, SubscriptionDto>();

function subscriptionFor(request: Request): SubscriptionDto {
  const tenant = request.headers.get("x-tenant-id") ?? "default";
  let row = subscriptions.get(tenant);
  if (!row) {
    row = {
      tenant_id: tenant,
      plan_code: "free",
      status: "active",
      period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      grace_until: null,
      features: { catalog: true },
      quotas: { seats: 3 },
    };
    subscriptions.set(tenant, row);
  }
  return row;
}

export const billingHandlers = [
  http.get("*/billing/plans", () => HttpResponse.json(PLANS)),
  http.get("*/billing/subscription", ({ request }) => HttpResponse.json(subscriptionFor(request))),
  http.post("*/billing/checkout", async ({ request }) => {
    const body = (await request.json()) as { plan_code: string };
    const row = subscriptionFor(request);
    row.plan_code = body.plan_code;
    row.status = "active";
    return HttpResponse.json({
      checkout_url: `https://checkout.example.test/session?plan=${encodeURIComponent(body.plan_code)}`,
    });
  }),
  http.post("*/billing/subscription/cancel", ({ request }) => {
    const row = subscriptionFor(request);
    row.status = "canceled";
    return HttpResponse.json(row);
  }),
];
