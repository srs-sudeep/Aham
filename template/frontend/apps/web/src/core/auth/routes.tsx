import type { FeatureRoute } from "@aham/ui-kit";
import { LoginPage } from "./pages/LoginPage";

/** Public (unauthenticated) routes, mounted directly under the root route. */
export const authRoutes: FeatureRoute[] = [
  { path: "/login", permission: "public", component: LoginPage },
];
