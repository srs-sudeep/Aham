import type { ModuleManifest } from "@aham/ui-kit";

/**
 * Every `modules/<name>/module.ts` default-exports a `ModuleManifest`.
 * Adding a module folder is all that is needed to register it.
 */
const modules = import.meta.glob<{ default: ModuleManifest }>("../modules/*/module.ts", {
  eager: true,
});

export const registeredModules: ModuleManifest[] = Object.values(modules)
  .map((m) => m.default)
  .filter(Boolean);
