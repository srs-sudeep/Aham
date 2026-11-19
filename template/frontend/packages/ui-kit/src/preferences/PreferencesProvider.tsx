import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ColorPreset, Density, Locale, ThemeMode } from "../tokens/presets";
import {
  defaultPreferences,
  loadPreferences,
  savePreferences,
  type StoredPreferences,
} from "./storage";

type PreferencesContextValue = StoredPreferences & {
  setThemeMode: (mode: ThemeMode) => void;
  setColorPreset: (preset: ColorPreset) => void;
  setLocale: (locale: Locale) => void;
  setDensity: (density: Density) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTimezone: (timezone: string) => void;
  setCurrency: (currency: string) => void;
  setDateFormat: (dateFormat: string) => void;
  resolvedTheme: "light" | "dark";
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyDom(prefs: StoredPreferences, resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.colorPreset = prefs.colorPreset;
  root.dataset.density = prefs.density;
  root.lang = prefs.locale;
}

export function PreferencesProvider({
  children,
  defaultLocale = "en",
}: {
  children: ReactNode;
  defaultLocale?: Locale;
}) {
  const [prefs, setPrefs] = useState<StoredPreferences>(() => {
    const loaded = loadPreferences();
    return { ...loaded, locale: loaded.locale || defaultLocale };
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolveTheme(prefs.themeMode),
  );

  useEffect(() => {
    const resolved = resolveTheme(prefs.themeMode);
    setResolvedTheme(resolved);
    applyDom(prefs, resolved);
    savePreferences(prefs);
  }, [prefs]);

  useEffect(() => {
    if (prefs.themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = resolveTheme("system");
      setResolvedTheme(resolved);
      applyDom(prefs, resolved);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs]);

  const update = useCallback((patch: Partial<StoredPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...prefs,
      resolvedTheme,
      setThemeMode: (themeMode) => update({ themeMode }),
      setColorPreset: (colorPreset) => update({ colorPreset }),
      setLocale: (locale) => update({ locale }),
      setDensity: (density) => update({ density }),
      setSidebarCollapsed: (sidebarCollapsed) => update({ sidebarCollapsed }),
      setTimezone: (timezone) => update({ timezone }),
      setCurrency: (currency) => update({ currency }),
      setDateFormat: (dateFormat) => update({ dateFormat }),
    }),
    [prefs, resolvedTheme, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}

export { defaultPreferences };
