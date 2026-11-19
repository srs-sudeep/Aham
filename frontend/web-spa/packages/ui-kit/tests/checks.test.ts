import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { runChecks } from "../src/cli/checks";

const MODULES = "apps/web/src/modules";
const FEATURE = `${MODULES}/demo/features/widgets`;

let tmp: string | undefined;

beforeAll(() => {
  // Keep the suite independent of the surrounding git state (FE-CORE001).
  process.env.DX_ALLOW_BASELINE = "1";
});

afterEach(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  tmp = undefined;
});

function put(root: string, rel: string, content: string) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function codes(root: string) {
  return runChecks(root).map((f) => f.code);
}

/** A minimal, fully valid repo: module `demo` with feature `widgets`. */
function makeRepo() {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dx-checks-"));
  put(
    tmp,
    "dx.config.json",
    JSON.stringify({
      protected_paths: ["packages/ui-kit"],
      modules_dir: MODULES,
      max_feature_depth: 2,
      max_component_group_depth: 1,
    }),
  );
  put(
    tmp,
    `${MODULES}/demo/module.ts`,
    `import widgets from "./features/widgets";\nexport default { id: "demo", features: [widgets] };\n`,
  );
  put(tmp, `${MODULES}/demo/public.ts`, "export {};\n");
  put(tmp, `${FEATURE}/index.ts`, "export default { id: 'widgets', routes: [] };\n");
  put(tmp, `${FEATURE}/api/widgets.api.ts`, "export const list = () => [];\n");
  put(
    tmp,
    `${FEATURE}/hooks/use-widgets.ts`,
    `import { useQuery } from "@tanstack/react-query";\nimport { list } from "../api/widgets.api";\nexport const useWidgets = () => useQuery({ queryKey: ["w"], queryFn: list });\n`,
  );
  put(tmp, `${FEATURE}/model/widgets.schema.ts`, "export type Widget = { id: string };\n");
  put(
    tmp,
    `${FEATURE}/views/pages/WidgetsListPage.tsx`,
    `import { useTranslation } from "@aham/ui-kit";\nexport function WidgetsListPage() { const { t } = useTranslation(); return <h1>{t("widgets.title")}</h1>; }\n`,
  );
  put(
    tmp,
    `${FEATURE}/views/components/WidgetsTable.tsx`,
    "export const WidgetsTable = () => null;\n",
  );
  put(
    tmp,
    `${FEATURE}/routes/widgets.routes.tsx`,
    `export const routes = [{ path: "/demo/widgets", permission: "widgets:list" }];\n`,
  );
  put(tmp, `${FEATURE}/locales/en.json`, JSON.stringify({ widgets: { title: "Widgets" } }));
  put(tmp, `${FEATURE}/locales/ja.json`, JSON.stringify({ widgets: { title: "ウィジェット" } }));
  return tmp;
}

describe("runChecks", () => {
  it("passes a well-formed module", () => {
    expect(runChecks(makeRepo())).toEqual([]);
  });

  it("flags a module without module.ts (FE-STR001)", () => {
    const root = makeRepo();
    fs.rmSync(path.join(root, MODULES, "demo/module.ts"));
    expect(codes(root)).toContain("FE-STR001");
  });

  it("flags a module without public.ts (FE-STR002)", () => {
    const root = makeRepo();
    fs.rmSync(path.join(root, MODULES, "demo/public.ts"));
    expect(codes(root)).toContain("FE-STR002");
  });

  it("flags missing feature folders and manifest (FE-STR003/004)", () => {
    const root = makeRepo();
    fs.rmSync(path.join(root, FEATURE, "model"), { recursive: true });
    fs.rmSync(path.join(root, FEATURE, "index.ts"));
    const found = codes(root);
    expect(found).toContain("FE-STR003");
    expect(found).toContain("FE-STR004");
  });

  it("flags views importing api (FE-LAY001)", () => {
    const root = makeRepo();
    put(
      root,
      `${FEATURE}/views/pages/WidgetsListPage.tsx`,
      `import { list } from "../../api/widgets.api";\nexport const Page = () => <h1>{String(list())}</h1>;\n`,
    );
    expect(codes(root)).toContain("FE-LAY001");
  });

  it("flags components importing api (FE-LAY005)", () => {
    const root = makeRepo();
    put(
      root,
      `${FEATURE}/views/components/WidgetsTable.tsx`,
      `import { list } from "../../api/widgets.api";\nexport const T = () => <div>{String(list())}</div>;\n`,
    );
    expect(codes(root)).toContain("FE-LAY005");
  });

  it("flags useQuery in a page (FE-DATA001)", () => {
    const root = makeRepo();
    put(
      root,
      `${FEATURE}/views/pages/WidgetsListPage.tsx`,
      `import { useQuery } from "@tanstack/react-query";\nexport function Page() { const q = useQuery({ queryKey: ["x"], queryFn: () => 1 }); return <h1>{q.data}</h1>; }\n`,
    );
    expect(codes(root)).toContain("FE-DATA001");
  });

  it("flags hooks that render JSX (FE-LAY002)", () => {
    const root = makeRepo();
    put(root, `${FEATURE}/hooks/use-widgets.tsx`, "export const useX = () => <div />;\n");
    expect(codes(root)).toContain("FE-LAY002");
  });

  it("flags a nested features folder (FE-STR005)", () => {
    const root = makeRepo();
    put(root, `${FEATURE}/features/inner/index.ts`, "export {};\n");
    expect(codes(root)).toContain("FE-STR005");
  });

  it("flags component groups nested deeper than one level (FE-STR005)", () => {
    const root = makeRepo();
    put(root, `${FEATURE}/views/components/group/Card.tsx`, "export const Card = () => null;\n");
    expect(codes(root)).not.toContain("FE-STR005");
    put(
      root,
      `${FEATURE}/views/components/group/deeper/Card.tsx`,
      "export const Card = () => null;\n",
    );
    expect(codes(root)).toContain("FE-STR005");
  });

  it("flags cross-module internal imports but allows public.ts (FE-STR012)", () => {
    const root = makeRepo();
    put(root, `${MODULES}/other/module.ts`, "export default { id: 'other', features: [] };\n");
    put(root, `${MODULES}/other/public.ts`, "export const thing = 1;\n");
    put(root, `${MODULES}/other/features/.gitkeep`, "");
    put(
      root,
      `${FEATURE}/hooks/use-widgets.ts`,
      `import { thing } from "../../../../other/public";\nexport const useWidgets = () => thing;\n`,
    );
    expect(codes(root)).not.toContain("FE-STR012");

    put(
      root,
      `${FEATURE}/hooks/use-widgets.ts`,
      `import { x } from "../../../../other/features/gadgets/hooks/use-gadgets";\nexport const useWidgets = () => x;\n`,
    );
    expect(codes(root)).toContain("FE-STR012");
  });

  it("flags features missing from module.ts (FE-STR011)", () => {
    const root = makeRepo();
    put(root, `${MODULES}/demo/module.ts`, `export default { id: "demo", features: [] };\n`);
    expect(codes(root)).toContain("FE-STR011");
  });

  it("flags routes without permission (FE-RBAC001)", () => {
    const root = makeRepo();
    put(
      root,
      `${FEATURE}/routes/widgets.routes.tsx`,
      `export const routes = [{ path: "/demo/widgets" }];\n`,
    );
    expect(codes(root)).toContain("FE-RBAC001");
  });

  it("flags banned imports and arbitrary colors (FE-IMPORT002/FE-UI001)", () => {
    const root = makeRepo();
    put(
      root,
      `${FEATURE}/views/components/WidgetsTable.tsx`,
      `import { Plus } from "lucide-react";\nexport const T = () => <Plus className="text-[#fff]" />;\n`,
    );
    const found = codes(root);
    expect(found).toContain("FE-IMPORT002");
    expect(found).toContain("FE-UI001");
  });

  it("flags hardcoded strings in views unless waived (FE-I18N001)", () => {
    const root = makeRepo();
    const page = `${FEATURE}/views/pages/WidgetsListPage.tsx`;
    put(root, page, `export const Page = () => <h1>Widgets overview</h1>;\n`);
    expect(codes(root)).toContain("FE-I18N001");
    put(root, page, `// dx: allow-i18n\nexport const Page = () => <h1>Widgets overview</h1>;\n`);
    expect(codes(root)).not.toContain("FE-I18N001");
  });

  it("flags listeners without cleanup (FE-MEM001)", () => {
    const root = makeRepo();
    put(
      root,
      `${FEATURE}/views/components/WidgetsTable.tsx`,
      `import { useEffect } from "react";\nexport function T() { useEffect(() => { window.addEventListener("resize", () => {}); }, []); return null; }\n`,
    );
    expect(codes(root)).toContain("FE-MEM001");
  });

  it("flags locale key mismatches (FE-I18N002)", () => {
    const root = makeRepo();
    put(root, `${FEATURE}/locales/ja.json`, JSON.stringify({ widgets: {} }));
    expect(codes(root)).toContain("FE-I18N002");
  });
});
