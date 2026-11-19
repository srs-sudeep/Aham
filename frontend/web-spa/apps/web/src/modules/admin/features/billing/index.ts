import { Package, defineFeature } from "@aham/ui-kit";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import { billingRoutes } from "./routes/billing.routes";

export default defineFeature({
  id: "billing",
  routes: billingRoutes,
  nav: {
    labelKey: "billing.title",
    to: "/admin/billing",
    permission: "billing.plan:list",
    icon: Package,
  },
  locales: { en, ja },
});
