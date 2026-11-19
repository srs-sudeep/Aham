import type { FeatureRoute } from "@aham/ui-kit";
import { UsersListPage } from "../views/pages/UsersListPage";

export const usersRoutes: FeatureRoute[] = [
  { path: "/admin/users", permission: "identity.user:list", component: UsersListPage },
];
