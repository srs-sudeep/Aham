import { Package, defineFeature } from "@aham/ui-kit";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import { rolesRoutes } from "./routes/roles.routes";

export { useRoles } from "./hooks/use-roles";

export default defineFeature({
  id: "roles",
  routes: rolesRoutes,
  nav: {
    labelKey: "roles.title",
    to: "/admin/roles",
    permission: "identity.role:list",
    icon: Package,
  },
  locales: { en, ja },
});
