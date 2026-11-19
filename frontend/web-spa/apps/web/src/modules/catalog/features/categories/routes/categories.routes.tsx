import { lazy } from "react";
import type { FeatureRoute } from "@aham/ui-kit";
import { categoriesSearchSchema } from "../model/category.schema";

const CategoriesListPage = lazy(() =>
  import("../views/pages/CategoriesListPage").then((m) => ({ default: m.CategoriesListPage })),
);
const CategoryDetailPage = lazy(() =>
  import("../views/pages/CategoryDetailPage").then((m) => ({ default: m.CategoryDetailPage })),
);

export const categoriesRoutes: FeatureRoute[] = [
  {
    path: "/catalog/categories",
    permission: "categories:list",
    component: CategoriesListPage,
    validateSearch: categoriesSearchSchema,
  },
  {
    path: "/catalog/categories/$categoryId",
    permission: "categories:read",
    component: CategoryDetailPage,
  },
];
