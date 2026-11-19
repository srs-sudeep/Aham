import { lazy } from "react";
import type { FeatureRoute } from "@aham/ui-kit";
import { itemsSearchSchema } from "../model/item.schema";

const ItemsListPage = lazy(() =>
  import("../views/pages/ItemsListPage").then((m) => ({ default: m.ItemsListPage })),
);
const ItemDetailPage = lazy(() =>
  import("../views/pages/ItemDetailPage").then((m) => ({ default: m.ItemDetailPage })),
);
const ItemFormPage = lazy(() =>
  import("../views/pages/ItemFormPage").then((m) => ({ default: m.ItemFormPage })),
);

export const itemsRoutes: FeatureRoute[] = [
  {
    path: "/catalog/items",
    permission: "items:list",
    component: ItemsListPage,
    validateSearch: itemsSearchSchema,
  },
  { path: "/catalog/items/new", permission: "items:create", component: ItemFormPage },
  { path: "/catalog/items/$itemId", permission: "items:read", component: ItemDetailPage },
  { path: "/catalog/items/$itemId/edit", permission: "items:update", component: ItemFormPage },
];
