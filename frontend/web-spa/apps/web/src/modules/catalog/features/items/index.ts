import { Package, defineFeature } from "@aham/ui-kit";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import { itemsRoutes } from "./routes/items.routes";

export default defineFeature({
  id: "items",
  routes: itemsRoutes,
  nav: {
    labelKey: "items.title",
    to: "/catalog/items",
    permission: "items:list",
    icon: Package,
  },
  locales: { en, ja },
});
