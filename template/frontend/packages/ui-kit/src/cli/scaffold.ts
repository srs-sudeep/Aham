import fs from "node:fs";
import path from "node:path";

export function newFeature(repoRoot: string, name: string) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error("Feature name must be lowercase kebab-case");
  }
  const base = path.join(repoRoot, "apps/web/src/features", name);
  if (fs.existsSync(base)) throw new Error(`Feature already exists: ${name}`);

  const pkg = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const resource = name.replace(/-/g, "_");

  for (const dir of ["api", "hooks", "views", "routes", "locales"]) {
    fs.mkdirSync(path.join(base, dir), { recursive: true });
  }

  fs.writeFileSync(
    path.join(base, "api/index.ts"),
    `import type { ApiClient } from "@aham/ui-kit";\n\nexport function create${pkg[0].toUpperCase()}${pkg.slice(1)}Api(client: ApiClient) {\n  return {\n    list: () => client.get<unknown[]>(\`/${name}\`),\n  };\n}\n`,
  );
  fs.writeFileSync(
    path.join(base, "hooks/index.ts"),
    `import { useQuery } from "@tanstack/react-query";\nimport { create${pkg[0].toUpperCase()}${pkg.slice(1)}Api } from "../api";\nimport type { ApiClient } from "@aham/ui-kit";\n\nexport function use${pkg[0].toUpperCase()}${pkg.slice(1)}List(client: ApiClient) {\n  const api = create${pkg[0].toUpperCase()}${pkg.slice(1)}Api(client);\n  return useQuery({ queryKey: ["${name}", "list"], queryFn: () => api.list() });\n}\n`,
  );
  fs.writeFileSync(
    path.join(base, "views/ListPage.tsx"),
    `import { PageHeader, Card, CardContent, Text } from "@aham/ui-kit/components";\nimport { useTranslation } from "@aham/ui-kit";\n\nexport function ${pkg[0].toUpperCase()}${pkg.slice(1)}ListPage() {\n  const { t } = useTranslation();\n  return (\n    <div>\n      <PageHeader title={t("${name}.title")} description={t("${name}.description")} />\n      <Card>\n        <CardContent className="pt-6">\n          <Text variant="muted">{t("${name}.empty")}</Text>\n        </CardContent>\n      </Card>\n    </div>\n  );\n}\n`,
  );
  fs.writeFileSync(
    path.join(base, "routes/index.ts"),
    `import type { Permission } from "@aham/ui-kit";\n\nexport const ${pkg}RouteMeta = {\n  path: "/${name}",\n  permission: "${resource}:list" as Permission,\n};\n`,
  );
  fs.writeFileSync(
    path.join(base, "locales/en.json"),
    JSON.stringify({ [name]: { title: name, description: `${name} feature`, empty: "No rows yet." } }, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(base, "locales/ja.json"),
    JSON.stringify({ [name]: { title: name, description: `${name} 機能`, empty: "データがありません。" } }, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(base, "index.ts"),
    `import { Package } from "@aham/ui-kit/components";\nimport type { NavItem } from "@aham/ui-kit";\n\nexport { ${pkg}RouteMeta } from "./routes";\nexport { ${pkg[0].toUpperCase()}${pkg.slice(1)}ListPage } from "./views/ListPage";\n\nexport const ${pkg}Nav: NavItem = {\n  labelKey: "${name}.title",\n  to: "/${name}",\n  permission: "${resource}:list",\n  icon: Package,\n};\n`,
  );
}
