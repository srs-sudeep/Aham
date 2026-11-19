import { Package, defineFeature } from "@aham/ui-kit";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import { usersRoutes } from "./routes/users.routes";

export default defineFeature({
  id: "users",
  routes: usersRoutes,
  nav: {
    labelKey: "users.title",
    to: "/admin/users",
    permission: "identity.user:list",
    icon: Package,
  },
  locales: { en, ja },
});
