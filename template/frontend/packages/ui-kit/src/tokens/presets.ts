export const COLOR_PRESETS = ["default", "ocean", "forest", "contrast"] as const;
export type ColorPreset = (typeof COLOR_PRESETS)[number];

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

export const LOCALES = ["en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
