export const ITEM_STATUSES = ["active", "inactive", "draft"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_CURRENCIES = ["USD", "JPY", "EUR", "GBP"] as const;
export const DEFAULT_CURRENCY = "USD";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const ITEM_STATUS_BADGE_VARIANT: Record<ItemStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  inactive: "secondary",
  draft: "outline",
};
