import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("styles.css tokens wiring", () => {
  it("maps design tokens into Tailwind with @theme inline", () => {
    expect(css).toContain("@theme inline");
  });

  it("scans ui-kit sources so its utility classes are generated", () => {
    expect(css).toContain("@source");
  });

  it("exposes color and typography tokens as Tailwind theme variables", () => {
    expect(css).toContain("--color-primary");
    expect(css).toContain("--text-h1");
  });

  it("does not define a self-referential font variable", () => {
    expect(css).not.toContain("--font-sans: var(--font-sans)");
  });
});
