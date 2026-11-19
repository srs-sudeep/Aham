import type { ComponentType, LazyExoticComponent } from "react";
import type { LucideIcon } from "lucide-react";
import type { Permission } from "../auth/types";

export type NavItem = {
  labelKey: string;
  to: string;
  permission: Permission;
  icon?: LucideIcon;
};

export type NavGroup = {
  id: string;
  labelKey: string;
  icon?: LucideIcon;
  order: number;
  items: NavItem[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteComponent = ComponentType<any> | LazyExoticComponent<ComponentType<any>>;

export type FeatureRoute = {
  path: string;
  permission: Permission;
  component: RouteComponent;
  /** Router-specific search param validator (e.g. a zod schema or function). */
  validateSearch?: unknown;
};

export type FeatureManifest = {
  id: string;
  routes: FeatureRoute[];
  nav?: NavItem;
  locales?: Record<string, Record<string, unknown>>;
};

export type ModuleManifest = {
  id: string;
  labelKey: string;
  icon?: LucideIcon;
  order?: number;
  permission?: Permission;
  features: FeatureManifest[];
};
