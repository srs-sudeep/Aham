// Flat ESLint config covering apps/web and packages/ui-kit.
// Layer/module boundaries are enforced with no-restricted-imports; the full
// architecture rule set lives in `pnpm dx check`.
import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const WEB = "apps/web/src/**/*.{ts,tsx}";
const MODULES = "apps/web/src/modules/**/*.{ts,tsx}";
const feature = (section) => `apps/web/src/modules/*/features/*/${section}/**/*.{ts,tsx}`;
const shared = (section) => `apps/web/src/modules/*/shared/${section}/**/*.{ts,tsx}`;

/** Imports banned everywhere in apps/web (FE-IMPORT002 / FE-IMPORT003). */
const APP_PATHS = [
  { name: "lucide-react", message: "Use icons re-exported by @aham/ui-kit." },
  { name: "axios", message: "Use the ui-kit api client (useApi) from a feature api/ module." },
];
const APP_PATTERNS = [
  { group: ["@radix-ui/*"], message: "Use @aham/ui-kit components instead of raw Radix." },
  {
    group: ["@aham/ui-kit/primitives", "@aham/ui-kit/primitives/*"],
    message: "Import from @aham/ui-kit or @aham/ui-kit/components.",
  },
];
/** Cross-module imports must go through the other module's public.ts (FE-STR012). */
const MODULE_PATTERNS = [
  {
    group: ["@/modules/*/features/**", "@/modules/*/shared/**", "**/modules/*/features/**"],
    message: "Import from the other module's public.ts.",
  },
];

const noRestricted = ({ paths = [], patterns = [] } = {}) => ({
  "no-restricted-imports": [
    "error",
    { paths: [...APP_PATHS, ...paths], patterns: [...APP_PATTERNS, ...patterns] },
  ],
});

const layer = (section, group, message, paths = []) => ({
  files: [feature(section), ...(section === "views" ? [shared("components")] : [])],
  rules: noRestricted({
    paths,
    patterns: [...MODULE_PATTERNS, { group, message }],
  }),
});

const API = ["**/api", "**/api/**"];
const HOOKS = ["**/hooks", "**/hooks/**"];
const VIEWS = ["**/views", "**/views/**"];
const REACT = [
  { name: "react", message: "This layer must stay framework-free." },
  { name: "react-dom", message: "This layer must stay framework-free." },
  { name: "@tanstack/react-query", message: "This layer must stay framework-free." },
];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.d.ts",
      "**/public/mockServiceWorker.js",
      "apps/web/src/lib/api-types.ts",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },

  // Accessibility for JSX.
  { ...jsxA11y.flatConfigs.recommended, files: ["**/*.tsx"] },

  // Row-action cells stop click propagation so they don't trigger the row's onRowClick.
  {
    files: ["apps/web/src/modules/**/views/components/*Table.tsx"],
    rules: {
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-static-element-interactions": "off",
    },
  },

  // shadcn primitives forward children via props, so static heading checks are noise.
  {
    files: [
      "packages/ui-kit/src/primitives/**/*.tsx",
      "packages/ui-kit/src/components/ui/**/*.tsx",
    ],
    rules: { "jsx-a11y/heading-has-content": "off", "jsx-a11y/anchor-has-content": "off" },
  },

  // Fast-refresh friendliness for feature code (the router/app shell exports helpers by design).
  {
    files: ["apps/web/src/modules/**/*.tsx", "apps/web/src/core/**/*.tsx"],
    plugins: { "react-refresh": reactRefresh },
    rules: { "react-refresh/only-export-components": ["warn", { allowConstantExport: true }] },
  },

  // Node-side code: CLI, tests, configs.
  {
    files: [
      "eslint.config.js",
      "**/*.config.{js,ts}",
      "packages/ui-kit/src/cli/**",
      "packages/ui-kit/tests/**",
      "**/*.test.{ts,tsx}",
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // apps/web: banned imports (FE-IMPORT002/003).
  { files: [WEB], rules: noRestricted() },

  // modules: cross-module imports go through public.ts.
  { files: [MODULES], rules: noRestricted({ patterns: MODULE_PATTERNS }) },

  // Layer boundaries inside a feature (FE-LAY001..005).
  layer("views", API, "views/components must go through hooks/, never api/ (FE-LAY001/005)."),
  layer("hooks", VIEWS, "hooks must not import views (FE-LAY002)."),
  layer("api", [...HOOKS, ...VIEWS], "api must not import hooks/views (FE-LAY003).", REACT),
  layer(
    "model",
    [...API, ...HOOKS, ...VIEWS],
    "model must not import api/hooks/views (FE-LAY004).",
    REACT,
  ),
  {
    // Shared building blocks follow the same layering as features.
    files: [shared("api")],
    rules: noRestricted({
      paths: REACT,
      patterns: [
        ...MODULE_PATTERNS,
        { group: [...HOOKS, ...VIEWS], message: "api must not import hooks/views (FE-LAY003)." },
      ],
    }),
  },

  // Tests and MSW handlers may reach across layers.
  {
    files: ["**/*.test.{ts,tsx}", "**/*.handlers.ts"],
    rules: { "no-restricted-imports": "off" },
  },

  // ui-kit is the baseline library: it owns lucide-react / radix.
  { files: ["packages/ui-kit/**/*.{ts,tsx}"], rules: { "no-restricted-imports": "off" } },
);
