import type { FeatureRoute } from "@aham/ui-kit";
import { DashboardPage } from "./pages/DashboardPage";

export const homeRoutes: FeatureRoute[] = [
  { path: "/", permission: "public", component: DashboardPage },
];
