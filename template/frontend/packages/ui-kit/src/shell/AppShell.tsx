import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import { usePreferences } from "../preferences/PreferencesProvider";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "../components/ui/sheet";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { cn } from "../lib/utils";
import type { NavItem } from "./types";

export function AppShell({
  brand,
  nav,
  children,
  topbarExtra,
  onNavigate,
  currentPath,
}: {
  brand: ReactNode;
  nav: NavItem[];
  children: ReactNode;
  topbarExtra?: ReactNode;
  onNavigate: (to: string) => void;
  currentPath: string;
}) {
  const { t } = useTranslation();
  const { can, logout, principal } = useAuth();
  const { sidebarCollapsed, setSidebarCollapsed } = usePreferences();
  const [mobileOpen, setMobileOpen] = useState(false);
  const visible = nav.filter((item) => can(item.permission));

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex flex-col gap-1 p-2">
      {visible.map((item) => {
        const active = currentPath === item.to || currentPath.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <button
            key={item.to}
            type="button"
            onClick={() => {
              onNavigate(item.to);
              onClick?.();
            }}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-left text-body transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
              sidebarCollapsed && "justify-center px-2",
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            {!sidebarCollapsed ? <span>{t(item.labelKey)}</span> : null}
          </button>
        );
      })}
    </nav>
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
          <NavList />
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
              <NavList onClick={() => setMobileOpen(false)} />
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
