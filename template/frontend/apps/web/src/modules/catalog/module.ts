import { Package, defineModule } from "@aham/ui-kit";
import items from "./features/items";
import categories from "./features/categories";

export default defineModule({
  id: "catalog",
  labelKey: "catalog.title",
  icon: Package,
  order: 20,
  features: [items, categories],
});
