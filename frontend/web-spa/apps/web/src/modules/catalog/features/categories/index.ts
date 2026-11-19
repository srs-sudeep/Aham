import { defineFeature } from "@aham/ui-kit";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import { categoriesRoutes } from "./routes/categories.routes";

export default defineFeature({
  id: "categories",
  routes: categoriesRoutes,
  nav: {
    labelKey: "categories.title",
    to: "/catalog/categories",
    permission: "core-api.category:list",
  },
  locales: { en, ja },
});
