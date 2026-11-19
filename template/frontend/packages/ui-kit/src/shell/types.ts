import type { Permission } from "../auth/types";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  labelKey: string;
  to: string;
  permission: Permission;
  icon?: LucideIcon;
};
