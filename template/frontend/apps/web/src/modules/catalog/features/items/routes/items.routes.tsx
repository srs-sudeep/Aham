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
    permission: "core-api.item:list",
    component: ItemsListPage,
    validateSearch: itemsSearchSchema,
  },
  { path: "/catalog/items/new", permission: "core-api.item:create", component: ItemFormPage },
  { path: "/catalog/items/$itemId", permission: "core-api.item:read", component: ItemDetailPage },
  {
    path: "/catalog/items/$itemId/edit",
    permission: "core-api.item:update",
    component: ItemFormPage,
  },
];
