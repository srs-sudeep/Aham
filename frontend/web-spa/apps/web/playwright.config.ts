import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke e2e for generated projects. Run from apps/web:
 *
 *   pnpm exec playwright install chromium   # once
 *   pnpm e2e                                # = playwright test
 *
 * Starts Vite with MSW mocks enabled (or reuses a running dev server locally).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm vite --port 5173 --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    env: { VITE_USE_MOCKS: "1", VITE_AUTH_MODE: "dev" },
  },
});
