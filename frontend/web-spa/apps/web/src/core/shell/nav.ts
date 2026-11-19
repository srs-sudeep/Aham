import { Home, Settings, buildNavGroups } from "@aham/ui-kit";
import type { ModuleManifest, NavGroup } from "@aham/ui-kit";

/**
 * Core navigation: Home pinned first, Settings pinned last. Module groups
 * (default order 100, catalog 20) sort in between. Empty `labelKey` renders the
 * group without a heading.
 */
export const coreNavGroups: NavGroup[] = [
  {
    id: "core-home",
    labelKey: "",
    order: 0,
    items: [{ labelKey: "shell.home", to: "/", permission: "public", icon: Home }],
  },
  {
    id: "core-settings",
    labelKey: "",
    order: 10_000,
    items: [{ labelKey: "shell.settings", to: "/settings", permission: "public", icon: Settings }],
  },
];

export function buildAppNavGroups(modules: ModuleManifest[]): NavGroup[] {
  return [...coreNavGroups, ...buildNavGroups(modules)].sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
}
