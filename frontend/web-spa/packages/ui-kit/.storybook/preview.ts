import type { Decorator, Preview } from "@storybook/react";
import { COLOR_PRESETS, DENSITIES, THEME_MODES } from "../src/tokens/presets";
import "./preview.css";

type Mode = "light" | "dark";

/** Applies the toolbar globals the same way PreferencesProvider does at runtime. */
const withTokens: Decorator = (Story, context) => {
  const { theme, density, preset } = context.globals as {
    theme: Mode;
    density: (typeof DENSITIES)[number];
    preset: (typeof COLOR_PRESETS)[number];
  };
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.density = density;
  root.dataset.colorPreset = preset;
  return Story();
};

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  globalTypes: {
    theme: {
      description: "Theme mode",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        dynamicTitle: true,
        items: THEME_MODES.filter((m) => m !== "system").map((value) => ({ value, title: value })),
      },
    },
    density: {
      description: "Density",
      toolbar: {
        title: "Density",
        icon: "component",
        dynamicTitle: true,
        items: DENSITIES.map((value) => ({ value, title: value })),
      },
    },
    preset: {
      description: "Color preset",
      toolbar: {
        title: "Preset",
        icon: "paintbrush",
        dynamicTitle: true,
        items: COLOR_PRESETS.map((value) => ({ value, title: value })),
      },
    },
  },
  initialGlobals: { theme: "light", density: "comfortable", preset: "default" },
  decorators: [withTokens],
};

export default preview;
