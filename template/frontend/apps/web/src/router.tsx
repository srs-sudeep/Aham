import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { hasPermission, type Permission } from "@aham/ui-kit";
import { LoginPage } from "./routes/LoginPage";
import { AuthenticatedLayout } from "./routes/AuthenticatedLayout";
import { HomePage } from "./routes/HomePage";
import { ForbiddenPage } from "./routes/ForbiddenPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { SettingsPage } from "./routes/settings/SettingsPage";
import { ItemsListPage, ItemDetailPage, itemsRouteMeta, itemDetailRouteMeta } from "./features/items";

function requireAuth(permission: Permission = "public") {
  return () => {
    const raw = localStorage.getItem("aham.auth.principal");
    const token = localStorage.getItem("aham.auth.token");
    if (!token || !raw) {
      throw redirect({ to: "/login" });
    }
    const principal = JSON.parse(raw);
    if (!hasPermission(principal, permission)) {
      throw redirect({ to: "/forbidden" });
    }
  };
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const forbiddenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forbidden",
  component: ForbiddenPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AuthenticatedLayout,
  beforeLoad: requireAuth("public"),
});

const homeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: HomePage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsPage,
});

const itemsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/items",
  component: ItemsListPage,
  beforeLoad: requireAuth(itemsRouteMeta.permission),
});

const itemDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/items/$itemId",
  component: function ItemDetailRouteComp() {
    // params via router hook inside child
    return <ItemDetailRouteInner />;
  },
  beforeLoad: requireAuth(itemDetailRouteMeta.permission),
});

function ItemDetailRouteInner() {
  const params = itemDetailRoute.useParams();
  return <ItemDetailPage itemId={params.itemId} />;
}

const routeTree = rootRoute.addChildren([
  loginRoute,
  forbiddenRoute,
  appRoute.addChildren([homeRoute, settingsRoute, itemsRoute, itemDetailRoute]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
