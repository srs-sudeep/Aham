import type { FeatureRoute } from "@aham/ui-kit";
import { RoleDetailPage } from "../views/pages/RoleDetailPage";
import { RolesListPage } from "../views/pages/RolesListPage";

export const rolesRoutes: FeatureRoute[] = [
  { path: "/admin/roles", permission: "identity.role:list", component: RolesListPage },
  {
    path: "/admin/roles/$roleId",
    permission: "identity.role:read",
    component: RoleDetailPage,
  },
];
