export { cn } from "./lib/utils";
export * from "./tokens/presets";
export {
  PreferencesProvider,
  usePreferences,
  defaultPreferences,
} from "./preferences/PreferencesProvider";
export type { StoredPreferences } from "./preferences/storage";
export { createI18n, useTranslation } from "./i18n/createI18n";
export type { ResourceMap } from "./i18n/createI18n";
export { AuthProvider, useAuth, Can } from "./auth/AuthProvider";
export { hasPermission } from "./auth/types";
export type { Action, Permission, Principal } from "./auth/types";

export { createApiClient, ApiError } from "./api/client";
export type { ApiClient, ApiClientOptions, ApiErrorFields } from "./api/client";
export { createQueryClient, AppQueryProvider, ApiProvider, useApi } from "./api/query";
export type { ApiContextValue } from "./api/query";

export { AppShell } from "./shell/AppShell";

export * from "./modules";
export * from "./tenancy";
export * from "./format";
export * from "./layout";
export * from "./feedback";
export * from "./form";
export * from "./data";
export * from "./patterns";
export * from "./testing";

export * from "./components";
export {
  Home,
  Settings,
  Package,
  Menu,
  LogOut,
  Sun,
  Moon,
  Languages,
  LayoutDashboard,
} from "./components/icons";
