import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runChecks } from "../src/cli/checks";

let tmp: string;

afterEach(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

function makeRepo() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui-kit-"));
  const feat = path.join(tmp, "apps/web/src/features/demo");
  for (const d of ["api", "hooks", "views", "routes", "locales"]) {
    fs.mkdirSync(path.join(feat, d), { recursive: true });
  }
  fs.writeFileSync(path.join(feat, "index.ts"), "export {};\n");
  fs.writeFileSync(path.join(feat, "api/index.ts"), "export const list = () => [];\n");
  fs.writeFileSync(path.join(feat, "hooks/index.ts"), "export {};\n");
  fs.writeFileSync(
    path.join(feat, "views/Page.tsx"),
    `import { Text } from "@aham/ui-kit/components";\nimport { useTranslation } from "@aham/ui-kit";\nexport function Page(){ const {t}=useTranslation(); return <Text>{t('demo.title')}</Text>; }\n`,
  );
  fs.writeFileSync(
    path.join(feat, "routes/index.ts"),
    `export const meta = { path: "/demo", permission: "demo:list" };\n`,
  );
  return tmp;
}

describe("runChecks", () => {
  it("passes a well-formed feature", () => {
    const root = makeRepo();
    expect(runChecks(root)).toEqual([]);
  });

  it("flags missing permission on routes", () => {
    const root = makeRepo();
    fs.writeFileSync(path.join(root, "apps/web/src/features/demo/routes/index.ts"), "export const meta = { path: '/demo' };\n");
    const codes = runChecks(root).map((f) => f.code);
    expect(codes).toContain("FE-RBAC001");
  });

  it("flags fetch in views", () => {
    const root = makeRepo();
    fs.writeFileSync(
      path.join(root, "apps/web/src/features/demo/views/Page.tsx"),
      `export function Page(){ fetch('/x'); return null; }\n`,
    );
    const codes = runChecks(root).map((f) => f.code);
    expect(codes).toContain("FE-LAY001");
  });
});
