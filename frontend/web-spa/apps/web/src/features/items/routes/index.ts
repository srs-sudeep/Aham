import type { Permission } from "@aham/ui-kit";

export const itemsRouteMeta = {
  path: "/items",
  permission: "items:list" as Permission,
};

export const itemDetailRouteMeta = {
  path: "/items/$itemId",
  permission: "items:read" as Permission,
};
