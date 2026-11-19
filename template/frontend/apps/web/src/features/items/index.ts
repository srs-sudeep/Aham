import { Package } from "@aham/ui-kit/components";
import type { NavItem } from "@aham/ui-kit";

export { itemsRouteMeta, itemDetailRouteMeta } from "./routes";
export { ItemsListPage } from "./views/ItemsListPage";
export { ItemDetailPage } from "./views/ItemDetailPage";

export const itemsNav: NavItem = {
  labelKey: "items.title",
  to: "/items",
  permission: "items:list",
  icon: Package,
};
