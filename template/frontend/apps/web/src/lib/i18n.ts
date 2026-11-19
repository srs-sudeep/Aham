import { createI18n } from "@aham/ui-kit";
import en from "../locales/en.json";
import ja from "../locales/ja.json";
import itemsEn from "../features/items/locales/en.json";
import itemsJa from "../features/items/locales/ja.json";

const defaultLocale = (import.meta.env.VITE_DEFAULT_LOCALE || "en") as "en" | "ja";

export const i18n = createI18n({
  defaultLocale,
  resources: {
    en: { ...en, ...itemsEn },
    ja: { ...ja, ...itemsJa },
  },
});
