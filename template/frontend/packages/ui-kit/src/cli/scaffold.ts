import fs from "node:fs";
import path from "node:path";

const KEBAB_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const pascal = (s: string) => camel(s).replace(/^./, (c) => c.toUpperCase());
const title = (s: string) => s.split("-").map(pascal).join(" ");

function assertKebab(kind: string, value: string) {
  if (!KEBAB_RE.test(value))
    throw new Error(`${kind} name must be lowercase kebab-case: "${value}"`);
}

function modulesDir(repoRoot: string): string {
  const cfgFile = path.join(repoRoot, "dx.config.json");
  let dir = "apps/web/src/modules";
  if (fs.existsSync(cfgFile)) {
    dir =
      (JSON.parse(fs.readFileSync(cfgFile, "utf8")) as { modules_dir?: string }).modules_dir ?? dir;
  }
  return path.join(repoRoot, dir);
}

function write(base: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(base, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** Scaffold `<modules_dir>/<name>/` (module manifest, public surface, locales, shared/, features/). */
export function newModule(repoRoot: string, name: string): string {
  assertKebab("Module", name);
  const base = path.join(modulesDir(repoRoot), name);
  if (fs.existsSync(base)) throw new Error(`Module already exists: ${name}`);
  const key = camel(name);

  write(base, {
    "module.ts": `import { Package, defineModule } from "@aham/ui-kit";

export default defineModule({
  id: "${name}",
  labelKey: "${key}.title",
  icon: Package,
  order: 100,
  features: [],
});
`,
    "public.ts": `/**
 * Public surface of the ${name} module. Other modules must import from here
 * (never from \`features/*\` internals).
 */
export {};
`,
    "locales/en.json": json({ [key]: { title: title(name) } }),
    "locales/ja.json": json({ [key]: { title: title(name) } }),
    "shared/api/.gitkeep": "",
    "shared/hooks/.gitkeep": "",
    "shared/components/.gitkeep": "",
    "shared/model/.gitkeep": "",
    "features/.gitkeep": "",
  });
  return base;
}

/**
 * Scaffold a feature with the full golden tree.
 * `target` is "<module>/<feature>", or just "<feature>" when `moduleName` is given (--module).
 */
export function newFeature(repoRoot: string, target: string, moduleName?: string): string {
  const parts = target.split("/").filter(Boolean);
  const [mod, name] = parts.length === 2 ? parts : [moduleName, parts[0]];
  if (parts.length > 2 || !mod || !name) {
    throw new Error("usage: dx new-feature <module>/<feature>  (or <feature> --module <module>)");
  }
  assertKebab("Module", mod);
  assertKebab("Feature", name);

  const moduleDir = path.join(modulesDir(repoRoot), mod);
  if (!fs.existsSync(path.join(moduleDir, "module.ts"))) {
    throw new Error(`Module "${mod}" does not exist; run: dx new-module ${mod}`);
  }
  const base = path.join(moduleDir, "features", name);
  if (fs.existsSync(base)) throw new Error(`Feature already exists: ${mod}/${name}`);

  const P = pascal(name);
  const c = camel(name);
  const route = `/${mod}/${name}`;
  const perm = (action: string) => `${name.replace(/-/g, "_")}:${action}`;

  write(base, {
    [`api/${name}.keys.ts`]: `/** Tenant-scoped query keys; every key starts with \`all(tenantId)\`. */
export const ${c}Keys = {
  all: (tenantId: string | null) => ["${mod}", "${name}", tenantId] as const,
  list: (tenantId: string | null) => [...${c}Keys.all(tenantId), "list"] as const,
};
`,
    [`api/${name}.api.ts`]: `import type { ApiClient } from "@aham/ui-kit";
import type { ${P}Input, ${P}Row } from "../model/${name}.schema";

/** Thin HTTP layer. Errors propagate to callers. */
export const ${c}Api = {
  list(client: ApiClient): Promise<${P}Row[]> {
    return client.get<${P}Row[]>("/${name}");
  },

  create(client: ApiClient, input: ${P}Input): Promise<${P}Row> {
    return client.post<${P}Row>("/${name}", input);
  },
};
`,
    [`api/${name}.handlers.ts`]: `import { HttpResponse, http } from "msw";
import type { ${P}Row } from "../model/${name}.schema";

/** MSW handlers (enabled with VITE_USE_MOCKS=1). Register in apps/web/src/lib/mocks.ts. */
const rows: ${P}Row[] = [{ id: "${name}-1", name: "Sample" }];

export const ${c}Handlers = [
  http.get("*/${name}", () => HttpResponse.json(rows)),
  http.post("*/${name}", async ({ request }) => {
    const input = (await request.json()) as Omit<${P}Row, "id">;
    const row: ${P}Row = { id: \`${name}-\${rows.length + 1}\`, ...input };
    rows.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),
];
`,
    [`model/${name}.schema.ts`]: `import { z } from "zod";

export const ${c}RowSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
});

export type ${P}Row = z.infer<typeof ${c}RowSchema>;

/** Payload for create (everything but the server-assigned id). */
export type ${P}Input = Omit<${P}Row, "id">;
`,
    [`hooks/use-${name}.ts`]: `import { useQuery } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { ${c}Api } from "../api/${name}.api";
import { ${c}Keys } from "../api/${name}.keys";

export function use${P}() {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: ${c}Keys.list(tenantId),
    queryFn: () => ${c}Api.list(client),
  });
}
`,
    [`hooks/use-${name}-mutations.ts`]: `import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@aham/ui-kit";
import { ${c}Api } from "../api/${name}.api";
import { ${c}Keys } from "../api/${name}.keys";
import type { ${P}Input } from "../model/${name}.schema";

export function useCreate${P}() {
  const { client, tenantId } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ${P}Input) => ${c}Api.create(client, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ${c}Keys.all(tenantId) }),
  });
}
`,
    [`views/pages/${P}ListPage.tsx`]: `import { ListPage, QueryState, useTranslation } from "@aham/ui-kit";
import { use${P} } from "../../hooks/use-${name}";
import { ${P}Table } from "../components/${P}Table";

export function ${P}ListPage() {
  const { t } = useTranslation();
  const query = use${P}();

  return (
    <ListPage titleKey="${c}.title" description={t("${c}.description")}>
      <QueryState query={query} emptyMessage={t("${c}.empty")}>
        {(rows) => <${P}Table rows={rows} />}
      </QueryState>
    </ListPage>
  );
}
`,
    [`views/components/${P}Table.tsx`]: `import { useMemo } from "react";
import { DataTable, useTranslation } from "@aham/ui-kit";
import type { ColumnDef } from "@aham/ui-kit";
import type { ${P}Row } from "../../model/${name}.schema";

export function ${P}Table({ rows }: { rows: ${P}Row[] }) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<${P}Row>[]>(
    () => [
      {
        id: "name",
        header: t("${c}.columns.name"),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
    ],
    [t],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      emptyMessage={t("${c}.empty")}
    />
  );
}
`,
    [`routes/${name}.routes.tsx`]: `import { lazy } from "react";
import type { FeatureRoute } from "@aham/ui-kit";

const ${P}ListPage = lazy(() =>
  import("../views/pages/${P}ListPage").then((m) => ({ default: m.${P}ListPage })),
);

export const ${c}Routes: FeatureRoute[] = [
  { path: "${route}", permission: "${perm("list")}", component: ${P}ListPage },
];
`,
    "locales/en.json": json({
      [c]: {
        title: title(name),
        description: `${title(name)} in this module.`,
        empty: "Nothing here yet.",
        columns: { name: "Name" },
      },
    }),
    "locales/ja.json": json({
      [c]: {
        title: title(name),
        description: `${title(name)}の一覧です。`,
        empty: "データがありません。",
        columns: { name: "名前" },
      },
    }),
    "index.ts": `import { Package, defineFeature } from "@aham/ui-kit";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import { ${c}Routes } from "./routes/${name}.routes";

export default defineFeature({
  id: "${name}",
  routes: ${c}Routes,
  nav: {
    labelKey: "${c}.title",
    to: "${route}",
    permission: "${perm("list")}",
    icon: Package,
  },
  locales: { en, ja },
});
`,
  });

  registerFeature(path.join(moduleDir, "module.ts"), name, c);
  return base;
}

/** Heuristic: add the feature import and append it to the `features: [...]` array. */
function registerFeature(moduleFile: string, name: string, ident: string): boolean {
  let src = fs.readFileSync(moduleFile, "utf8");
  const arrayRe = /(features\s*:\s*\[)([^\]]*)(\])/;
  const m = arrayRe.exec(src);
  if (!m) return false;

  const importLine = `import ${ident} from "./features/${name}";\n`;
  const items = m[2]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  src = src.replace(arrayRe, `$1${[...items, ident].join(", ")}$3`);

  const imports = [...src.matchAll(/^import\b[^;]*?["'][^"']+["'];?[ \t]*$/gm)];
  const last = imports[imports.length - 1];
  src = last
    ? src.slice(0, last.index + last[0].length + 1) +
      importLine +
      src.slice(last.index + last[0].length + 1)
    : importLine + src;
  fs.writeFileSync(moduleFile, src);
  return true;
}
