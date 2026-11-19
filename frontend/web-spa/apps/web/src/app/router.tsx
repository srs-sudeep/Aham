import React, { Suspense } from "react";
import {
  Outlet,
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type AnyRoute,
} from "@tanstack/react-router";
import { Skeleton, useAuth } from "@aham/ui-kit";
import type { FeatureRoute, Permission, Principal } from "@aham/ui-kit";
import { AuthenticatedLayout } from "../core/shell/AuthenticatedLayout";
import { authRoutes } from "../core/auth/routes";
import { homeRoutes } from "../core/home/routes";
import { settingsRoutes } from "../core/settings/routes";
import { ForbiddenPage } from "../core/errors/pages/ForbiddenPage";
import { NotFoundPage } from "../core/errors/pages/NotFoundPage";
import { RouteErrorBoundary } from "../core/errors/pages/RouteErrorBoundary";
import { registeredModules } from "./registry";

export type RouterContext = {
  auth: {
    token: string | null;
    principal: Principal | null;
    can: (p: Permission | Permission[]) => boolean;
    logout: () => void;
  };
};

/** Lazy feature pages need a Suspense boundary; wrap once per route. */
function withSuspense(Component: FeatureRoute["component"]) {
  function SuspendedRoute() {
    const Wrapped = Component as React.ComponentType;
    return (
      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <Wrapped />
      </Suspense>
    );
  }
  return SuspendedRoute;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorBoundary,
});

// ── public routes ────────────────────────────────────────────────────────────

const publicAuthRoutes: AnyRoute[] = authRoutes.map((def) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: def.path,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack RouteComponent vs lazy wrappers
    component: withSuspense(def.component) as any,
    validateSearch: (search: Record<string, unknown>): { redirect?: string; sso?: string } => ({
      redirect:
        typeof search.redirect === "string" &&
        search.redirect.startsWith("/") &&
        !search.redirect.startsWith("//")
          ? search.redirect
          : undefined,
      sso: search.sso === "1" || search.sso === 1 ? "1" : undefined,
    }),
    beforeLoad: ({ context }: { context: RouterContext }) => {
      if (context.auth.token) throw redirect({ to: "/" });
    },
  }),
);

const forbiddenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forbidden",
  component: ForbiddenPage,
});

// ── authenticated layout ─────────────────────────────────────────────────────

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  component: AuthenticatedLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorBoundary,
  beforeLoad: ({ context, location }: { context: RouterContext; location: { href: string } }) => {
    // Read auth from router context (React state), never straight from localStorage.
    if (!context.auth.token || !context.auth.principal) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
});

function attachRoutes(parent: AnyRoute, defs: FeatureRoute[]): AnyRoute[] {
  return defs.map((def) =>
    createRoute({
      getParentRoute: () => parent,
      path: def.path,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack RouteComponent vs lazy wrappers
      component: withSuspense(def.component) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateSearch: def.validateSearch as any,
      beforeLoad: ({ context }: { context: RouterContext }) => {
        if (!context.auth.can(def.permission)) throw redirect({ to: "/forbidden" });
      },
    }),
  );
}

/** Core pages plus every feature route declared by registered modules. */
function featureRoutes(parent: AnyRoute): AnyRoute[] {
  const moduleRoutes = registeredModules.flatMap((mod) =>
    mod.features.flatMap((feature) => feature.routes),
  );
  return attachRoutes(parent, [...homeRoutes, ...settingsRoutes, ...moduleRoutes]);
}

const routeTree = rootRoute.addChildren([
  ...publicAuthRoutes,
  forbiddenRoute,
  authenticatedRoute.addChildren(featureRoutes(authenticatedRoute)),
]);

export const router = createRouter({
  routeTree,
  // Real value is supplied by <AppRouter /> through RouterProvider's `context`.
  context: { auth: undefined! },
  defaultNotFoundComponent: NotFoundPage,
  defaultErrorComponent: RouteErrorBoundary,
});

/**
 * Bridges React auth state into the router context so `beforeLoad` guards see
 * the live token / principal.
 *
 * The router tree is built programmatically from the module registry, so the
 * `Register` interface is intentionally not augmented: links and params are
 * loosely typed (`to: string`).
 */
export function AppRouter() {
  const { token, principal, can, logout } = useAuth();
  return <RouterProvider router={router} context={{ auth: { token, principal, can, logout } }} />;
}
