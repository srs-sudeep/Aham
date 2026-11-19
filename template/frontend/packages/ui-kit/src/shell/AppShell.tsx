import { useMemo, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import { usePreferences } from "../preferences/PreferencesProvider";
import { Button } from "../primitives/button";
import { Sheet, SheetContent, SheetTrigger } from "../primitives/sheet";
import { ScrollArea } from "../primitives/scroll-area";
import { Separator } from "../primitives/separator";
import { cn } from "../lib/utils";
import type { NavGroup, NavItem } from "./types";

const FLAT_GROUP_ID = "__flat";

function findActiveTo(groups: NavGroup[], currentPath: string): string | null {
  let best: string | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const matches = currentPath === item.to || currentPath.startsWith(`${item.to}/`);
      if (matches && (best === null || item.to.length > best.length)) best = item.to;
    }
  }
  return best;
}

type NavListProps = {
  groups: NavGroup[];
  activeTo: string | null;
  collapsed: boolean;
  onNavigate: (to: string) => void;
  onItemClick?: () => void;
};

/** Defined at module level so it keeps a stable identity across AppShell renders. */
function NavList({ groups, activeTo, collapsed, onNavigate, onItemClick }: NavListProps) {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-col gap-1 p-2">
      {groups.map((group, index) => {
        const showLabel = group.id !== FLAT_GROUP_ID && Boolean(group.labelKey);
        return (
          <div key={group.id} className="flex flex-col gap-1">
            {showLabel && !collapsed ? (
              <div className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(group.labelKey)}
              </div>
            ) : null}
            {showLabel && collapsed && index > 0 ? <Separator className="my-1" /> : null}
            {group.items.map((item: NavItem) => {
              const active = item.to === activeTo;
              const Icon = item.icon;
              return (
                <button
                  key={item.to}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? t(item.labelKey) : undefined}
                  onClick={() => {
                    onNavigate(item.to);
                    onItemClick?.();
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-left text-body transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
                    collapsed && "justify-center px-2",
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                  {!collapsed ? <span>{t(item.labelKey)}</span> : null}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  brand,
  navGroups,
  nav,
  children,
  topbarExtra,
  onNavigate,
  currentPath,
}: {
  brand: ReactNode;
  /** Preferred: grouped navigation built via `buildNavGroups`. */
  navGroups?: NavGroup[];
  /** @deprecated Flat navigation, kept for compatibility. Ignored when `navGroups` is set. */
  nav?: NavItem[];
  children: ReactNode;
  topbarExtra?: ReactNode;
  onNavigate: (to: string) => void;
  currentPath: string;
}) {
  const { t } = useTranslation();
  const { can, logout, principal } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferences();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleGroups = useMemo<NavGroup[]>(() => {
    const source: NavGroup[] =
      navGroups ??
      (nav && nav.length > 0 ? [{ id: FLAT_GROUP_ID, labelKey: "", order: 0, items: nav }] : []);
    return [...source]
      .sort((a, b) => a.order - b.order)
      .map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) }))
      .filter((group) => group.items.length > 0);
  }, [navGroups, nav, can]);

  const activeTo = useMemo(
    () => findActiveTo(visibleGroups, currentPath),
    [visibleGroups, currentPath],
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "hidden border-r border-border bg-sidebar md:flex md:flex-col",
          sidebarCollapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex h-14 items-center justify-between px-3">
          {!sidebarCollapsed ? <div className="truncate font-semibold">{brand}</div> : null}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <NavList
            groups={visibleGroups}
            activeTo={activeTo}
            collapsed={sidebarCollapsed}
            onNavigate={onNavigate}
          />
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border px-3 sm:px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <div className="mb-4 font-semibold">{brand}</div>
              <NavList
                groups={visibleGroups}
                activeTo={activeTo}
                collapsed={false}
                onNavigate={onNavigate}
                onItemClick={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
          {topbarExtra}
          <div className="text-muted text-muted-foreground">
            {principal?.name || principal?.email || t("shell.signedIn")}
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            {t("shell.logout")}
          </Button>
        </header>
        <main className="flex-1 p-[var(--space-page)]">{children}</main>
      </div>
    </div>
  );
}
