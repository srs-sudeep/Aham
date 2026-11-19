import type { ResourceMap } from "../i18n/createI18n";
import type { FeatureManifest, ModuleManifest, NavGroup } from "./types";

export const DEFAULT_MODULE_ORDER = 100;

export function defineFeature(manifest: FeatureManifest): FeatureManifest {
  return manifest;
}

export function defineModule(manifest: ModuleManifest): ModuleManifest {
  return manifest;
}

/**
 * Build sidebar navigation groups from module manifests. Modules without any
 * feature nav items are omitted. Groups are sorted by `order` then `id`.
 */
export function buildNavGroups(modules: ModuleManifest[]): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const mod of modules) {
    const items = mod.features.flatMap((feature) => (feature.nav ? [feature.nav] : []));
    if (items.length === 0) continue;
    groups.push({
      id: mod.id,
      labelKey: mod.labelKey,
      icon: mod.icon,
      order: mod.order ?? DEFAULT_MODULE_ORDER,
      items,
    });
  }
  return groups.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (isPlainObject(value) && isPlainObject(existing)) {
      target[key] = deepMerge({ ...existing }, value);
    } else if (isPlainObject(value)) {
      target[key] = deepMerge({}, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/**
 * Merge feature locale bundles from all modules into a single ResourceMap
 * (`{ [locale]: { ...messages } }`). Later modules override earlier keys.
 * Optionally seed with base resources (e.g. app-level shell strings).
 */
export function collectLocales(modules: ModuleManifest[], base: ResourceMap = {}): ResourceMap {
  const result: ResourceMap = {};
  for (const [locale, bundle] of Object.entries(base)) {
    result[locale] = deepMerge({}, bundle);
  }
  for (const mod of modules) {
    for (const feature of mod.features) {
      if (!feature.locales) continue;
      for (const [locale, bundle] of Object.entries(feature.locales)) {
        result[locale] = deepMerge(result[locale] ?? {}, bundle);
      }
    }
  }
  return result;
}
