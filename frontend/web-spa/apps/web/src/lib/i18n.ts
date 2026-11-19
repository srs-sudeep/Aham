import { createI18n, collectLocales } from "@aham/ui-kit";
import type { Locale } from "@aham/ui-kit";
import { registeredModules } from "../app/registry";
import coreEn from "../core/locales/en.json";
import coreJa from "../core/locales/ja.json";
import catalogEn from "../modules/catalog/locales/en.json";
import catalogJa from "../modules/catalog/locales/ja.json";

const defaultLocale = (import.meta.env.VITE_DEFAULT_LOCALE || "en") as Locale;

/**
 * Core + module-level bundles are the base; feature bundles (declared on each
 * feature manifest) are merged on top by `collectLocales`.
 */
export const i18n = createI18n({
  defaultLocale,
  resources: collectLocales(registeredModules, {
    en: { ...coreEn, ...catalogEn },
    ja: { ...coreJa, ...catalogJa },
  }),
});
