const KEY = "aham.preferences.v1";

export type StoredPreferences = {
  themeMode: "light" | "dark" | "system";
  colorPreset: "default" | "ocean" | "forest" | "contrast";
  locale: "en" | "ja";
  density: "comfortable" | "compact";
  sidebarCollapsed: boolean;
};

export const defaultPreferences: StoredPreferences = {
  themeMode: "system",
  colorPreset: "default",
  locale: "en",
  density: "comfortable",
  sidebarCollapsed: false,
};

export function loadPreferences(): StoredPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultPreferences;
    return { ...defaultPreferences, ...JSON.parse(raw) };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(prefs: StoredPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(prefs));
}
