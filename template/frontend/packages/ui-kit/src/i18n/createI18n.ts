import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { Locale } from "../tokens/presets";

export type ResourceMap = Record<string, Record<string, unknown>>;

export function createI18n(options: { defaultLocale: Locale; resources: ResourceMap }) {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    lng: options.defaultLocale,
    fallbackLng: "en",
    resources: Object.fromEntries(
      Object.entries(options.resources).map(([lng, bundles]) => [
        lng,
        { translation: flatten(bundles) },
      ]),
    ),
    interpolation: { escapeValue: false },
  });
  return instance;
}

function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    } else {
      out[path] = String(value);
    }
  }
  return out;
}

export { useTranslation } from "react-i18next";
