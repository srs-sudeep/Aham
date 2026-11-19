import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // "@" always points at src, e.g. import { x } from "@/lib/api"
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    // Node by default (fast, e.g. file-based assertions). Component tests opt in with
    // `// @vitest-environment jsdom` at the top of the file.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // jest-dom matchers + RTL cleanup.
    setupFiles: ["./src/test/setup.ts"],
  },
});
