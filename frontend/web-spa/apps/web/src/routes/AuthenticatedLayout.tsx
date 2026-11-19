import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { AppShell, Home as HomeIcon, Settings } from "@aham/ui-kit";
import type { NavItem } from "@aham/ui-kit";
import { itemsNav } from "@/features/items";

const coreNav: NavItem[] = [
  { labelKey: "shell.home", to: "/", permission: "public", icon: HomeIcon },
  itemsNav,
  { labelKey: "shell.settings", to: "/settings", permission: "public", icon: Settings },
];

export function AuthenticatedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <AppShell
      brand="Web SPA"
      nav={coreNav}
      currentPath={pathname}
      onNavigate={(to) => {
        void navigate({ to });
      }}
    >
      <Outlet />
    </AppShell>
  );
}
