import type { FeatureRoute } from "@aham/ui-kit";
import { BillingListPage } from "../views/pages/BillingListPage";

export const billingRoutes: FeatureRoute[] = [
  {
    path: "/admin/billing",
    permission: "billing.plan:list",
    component: BillingListPage,
  },
];
