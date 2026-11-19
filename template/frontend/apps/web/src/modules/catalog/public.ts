/**
 * Public surface of the catalog module. Other modules must import from here
 * (never from `features/*` internals).
 */
export { ItemPicker } from "./features/items/views/components/ItemPicker";
export { useItemOptions } from "./features/items/hooks/use-items";
export type { ItemOption } from "./features/items/hooks/use-items";
export type { Item, ItemStatus } from "./features/items/model/item.schema";
export { CategoryPicker } from "./shared/components/CategoryPicker";
export { useCategoryOptions } from "./shared/hooks/use-category-options";
export type { Category, CategoryOption } from "./shared/model/category.types";
