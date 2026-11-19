import type { FeatureRoute } from "@aham/ui-kit";
import { SettingsPage } from "./pages/SettingsPage";

export const settingsRoutes: FeatureRoute[] = [
  { path: "/settings", permission: "public", component: SettingsPage },
];
