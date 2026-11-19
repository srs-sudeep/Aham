import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";
import { RULES } from "./rules.js";

export type Finding = {
  code: string;
  message: string;
  /** Path relative to the repo root (posix separators). */
  file: string;
  line?: number;
};

export type DxConfig = {
  protected_paths: string[];
  modules_dir: string;
  max_feature_depth: number;
  max_component_group_depth: number;
};

const DEFAULT_CONFIG: DxConfig = {
  protected_paths: ["packages/ui-kit", "apps/web/src/app", "apps/web/src/core"],
  modules_dir: "apps/web/src/modules",
  max_feature_depth: 2,
  max_component_group_depth: 1,
};

const FEATURE_DIRS = [
  "api",
  "hooks",
  "model",
  "views/pages",
  "views/components",
  "routes",
  "locales",
];
/** Max path segments (including the file name) below the feature root, per section. */
const SECTION_DEPTH: Record<string, number> = {
  api: 2,
  hooks: 2,
  model: 2,
  routes: 2,
  locales: 2,
};
const IGNORED_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".git"]);
const REQUIRED_LOCALES = ["en", "ja"];
const I18N_ATTRS = new Set(["title", "placeholder", "aria-label", "alt", "label", "description"]);

const ARBITRARY_RE = /(?:text|bg|border|from|to|via|fill|stroke)-\[(?:#[\da-fA-F]|rgb|hsl|\d)/;
const FIXED_WIDTH_RE = /(?<!max-)\b(?:min-)?w-\[(\d{3,})px\]/;
const QUERY_RE = /\buse(?:Query|Mutation|InfiniteQuery|SuspenseQuery)\s*\(/;
const FETCH_RE = /\bfetch\s*\(|\bapiClient\b/;
const THEME_RE = /document\.documentElement\.(?:classList|dataset|setAttribute|lang|style)\b/;
const LISTENER_RE = /\baddEventListener\s*\(|\bsetInterval\s*\(/;
const CLEANUP_RE =
  /\b(?:removeEventListener|clearInterval|clearTimeout|abort|unsubscribe|disconnect)\b/;
const ALLOW_I18N = "// dx: allow-i18n";

// ── helpers ──────────────────────────────────────────────────────────────────

const posix = (p: string) => p.split(path.sep).join("/");
const isDir = (p: string) => fs.existsSync(p) && fs.statSync(p).isDirectory();
const isTest = (f: string) => /\.test\.[cm]?[jt]sx?$/.test(f);
const isSource = (f: string) => /\.(?:ts|tsx)$/.test(f) && !f.endsWith(".d.ts");
const hasSeg = (spec: string, name: string) => new RegExp(`(^|/)${name}(/|$)`).test(spec);
const isLocalSpec = (spec: string) => spec.startsWith(".") || spec.startsWith("@/");
const isReact = (spec: string) =>
  /^react(?:-dom)?(?:\/|$)/.test(spec) || spec.startsWith("@tanstack/react-query");

function subdirs(dir: string): string[] {
  if (!isDir(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !IGNORED_DIRS.has(e.name) && !e.name.startsWith("."))
    .map((e) => e.name);
}

function walk(dir: string): { files: string[]; dirs: string[] } {
  const out = { files: [] as string[], dirs: [] as string[] };
  if (!isDir(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.dirs.push(full);
      const sub = walk(full);
      out.files.push(...sub.files);
      out.dirs.push(...sub.dirs);
    } else if (e.isFile() && !e.name.startsWith(".")) {
      out.files.push(full);
    }
  }
  return out;
}

/** Replace comments with blanks (keeping line breaks) so regex scans ignore them. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

function loadConfig(repoRoot: string): DxConfig {
  const file = path.join(repoRoot, "dx.config.json");
  if (!fs.existsSync(file)) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...(JSON.parse(fs.readFileSync(file, "utf8")) as Partial<DxConfig>) };
}

export function isProtectedPath(repoRoot: string, file: string): boolean {
  const rel = posix(path.isAbsolute(file) ? path.relative(repoRoot, file) : file);
  return loadConfig(repoRoot).protected_paths.some((p) => {
    const base = p.replace(/\/+$/, "");
    return rel === base || rel.startsWith(`${base}/`);
  });
}

type Ctx = {
  root: string;
  cfg: DxConfig;
  modulesRoot: string;
  findings: Finding[];
  project: Project;
  rel: (p: string) => string;
  add: (code: string, file: string, line?: number, extra?: string) => void;
};

function createCtx(root: string): Ctx {
  const cfg = loadConfig(root);
  const findings: Finding[] = [];
  const rel = (p: string) => posix(path.relative(root, p) || ".");
  return {
    root,
    cfg,
    modulesRoot: path.join(root, cfg.modules_dir),
    findings,
    rel,
    project: new Project({
      useInMemoryFileSystem: true,
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    }),
    add(code, file, line, extra) {
      const base = RULES[code] ?? code;
      findings.push({
        code,
        message: extra ? `${base}: ${extra}` : base,
        file: rel(file),
        ...(line ? { line } : {}),
      });
    },
  };
}

// ── A. module / feature structure ───────────────────────────────────────────

function checkStructure(ctx: Ctx) {
  for (const mod of subdirs(ctx.modulesRoot)) {
    const modDir = path.join(ctx.modulesRoot, mod);
    const featuresDir = path.join(modDir, "features");
    if (!fs.existsSync(path.join(modDir, "module.ts")))
      ctx.add("FE-STR001", modDir, undefined, mod);
    if (!fs.existsSync(path.join(modDir, "public.ts")))
      ctx.add("FE-STR002", modDir, undefined, mod);
    if (!isDir(featuresDir)) ctx.add("FE-STR010", modDir, undefined, `${mod}/features/ is missing`);

    const features = subdirs(featuresDir);
    for (const feature of features)
      checkFeature(ctx, path.join(featuresDir, feature), `${mod}/${feature}`);

    // `features` directories may only exist once: <module>/features
    for (const dir of walk(modDir).dirs) {
      const segs = posix(path.relative(modDir, dir)).split("/");
      if (path.basename(dir) === "features" && segs.length >= ctx.cfg.max_feature_depth) {
        ctx.add("FE-STR005", dir, undefined, "nested features/ directory");
      }
    }

    checkModuleManifest(ctx, modDir, features);
    checkLocaleParity(ctx, path.join(modDir, "locales"));
  }
}

function checkFeature(ctx: Ctx, featureDir: string, label: string) {
  for (const d of FEATURE_DIRS) {
    if (!isDir(path.join(featureDir, d)))
      ctx.add("FE-STR003", featureDir, undefined, `${label}/${d}`);
  }
  if (
    !fs.existsSync(path.join(featureDir, "index.ts")) &&
    !fs.existsSync(path.join(featureDir, "index.tsx"))
  ) {
    ctx.add("FE-STR004", featureDir, undefined, label);
  }

  const maxGroup = ctx.cfg.max_component_group_depth;
  for (const file of walk(featureDir).files) {
    const segs = posix(path.relative(featureDir, file)).split("/");
    const [section, sub] = segs;
    if (segs.length === 1) {
      if (!/^index\.tsx?$/.test(section) && section !== "README.md") {
        ctx.add(
          "FE-STR010",
          file,
          undefined,
          "feature root may only contain index.ts and section folders",
        );
      }
    } else if (section === "views") {
      if (sub === "components") {
        // views/components/<file> or views/components/<group>/<file>
        if (segs.length > 3 + maxGroup) {
          ctx.add(
            "FE-STR005",
            file,
            undefined,
            `component groups may be ${maxGroup} level(s) deep`,
          );
        }
      } else if (sub === "pages") {
        if (segs.length > 3) ctx.add("FE-STR010", file, undefined, "views/pages must be flat");
      } else {
        ctx.add(
          "FE-STR010",
          file,
          undefined,
          "views files belong in views/pages or views/components",
        );
      }
    } else if (section in SECTION_DEPTH) {
      if (segs.length > SECTION_DEPTH[section]) {
        ctx.add("FE-STR010", file, undefined, `${section}/ must be flat`);
      }
    } else {
      ctx.add("FE-STR010", file, undefined, `unexpected folder ${section}/`);
    }
  }
}

function checkModuleManifest(ctx: Ctx, modDir: string, features: string[]) {
  const file = path.join(modDir, "module.ts");
  if (!fs.existsSync(file)) return;
  const sf = ctx.project.createSourceFile(file, fs.readFileSync(file, "utf8"), { overwrite: true });
  const specByName = new Map<string, string>();
  for (const decl of sf.getImportDeclarations()) {
    const spec = decl.getModuleSpecifierValue();
    const def = decl.getDefaultImport();
    if (def) specByName.set(def.getText(), spec);
    for (const n of decl.getNamedImports())
      specByName.set((n.getAliasNode() ?? n.getNameNode()).getText(), spec);
  }
  const prop = sf
    .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .find((p) => p.getName() === "features");
  const init = prop?.getInitializer();
  if (!prop || !init || !Node.isArrayLiteralExpression(init)) {
    ctx.add(
      "FE-STR011",
      file,
      prop?.getStartLineNumber(),
      "expected `features: [...]` array literal",
    );
    return;
  }
  const listed = new Set<string>();
  for (const el of init.getElements()) {
    const spec = Node.isIdentifier(el) ? specByName.get(el.getText()) : undefined;
    const name = spec && /(?:^|\/)features\/([^/]+)/.exec(spec)?.[1];
    if (name) listed.add(name);
    else
      ctx.add(
        "FE-STR011",
        file,
        el.getStartLineNumber(),
        `\`${el.getText()}\` is not an imported feature manifest`,
      );
  }
  for (const feature of features) {
    if (!listed.has(feature))
      ctx.add("FE-STR011", file, prop.getStartLineNumber(), `feature "${feature}" is not listed`);
  }
  ctx.project.removeSourceFile(sf);
}

// ── B. source scans ──────────────────────────────────────────────────────────

type Layer = "api" | "hooks" | "model" | "views" | "routes" | "locales" | "components";
type Loc = { module: string; feature?: string; layer?: Layer; sub?: string };

function classify(ctx: Ctx, file: string): Loc | null {
  const segs = posix(path.relative(ctx.modulesRoot, file)).split("/");
  if (segs[0] === ".." || segs.length < 2) return null;
  const loc: Loc = { module: segs[0] };
  if (segs[1] === "features" && segs.length >= 5) {
    loc.feature = segs[2];
    loc.layer = segs[3] as Layer;
    loc.sub = segs[4];
  } else if (segs[1] === "shared" && segs.length >= 4) {
    loc.layer = segs[2] === "components" ? "components" : (segs[2] as Layer);
  }
  return loc;
}

type Imp = { spec: string; line: number };

function importsOf(sf: SourceFile): Imp[] {
  const out: Imp[] = [];
  for (const d of sf.getImportDeclarations())
    out.push({ spec: d.getModuleSpecifierValue(), line: d.getStartLineNumber() });
  for (const d of sf.getExportDeclarations()) {
    const spec = d.getModuleSpecifierValue();
    if (spec) out.push({ spec, line: d.getStartLineNumber() });
  }
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const arg = call.getArguments()[0];
    if (
      call.getExpression().getKind() === SyntaxKind.ImportKeyword &&
      arg &&
      Node.isStringLiteral(arg)
    ) {
      out.push({ spec: arg.getLiteralValue(), line: call.getStartLineNumber() });
    }
  }
  return out;
}

/** Resolve an import to `{module, rest}` inside modules_dir, or null if it points elsewhere. */
function moduleTarget(ctx: Ctx, file: string, spec: string) {
  let abs: string | undefined;
  if (spec.startsWith(".")) abs = path.resolve(path.dirname(file), spec);
  else {
    const m = /^(?:(?:@|~)\/|(?:apps\/web\/)?src\/)?modules\/(.+)$/.exec(spec);
    if (m) abs = path.join(ctx.modulesRoot, m[1]);
  }
  if (!abs) return null;
  const rel = posix(path.relative(ctx.modulesRoot, abs));
  if (rel.startsWith("..") || rel === "") return null;
  const [module, ...rest] = rel.split("/");
  return { module, rest };
}

function scanFiles(ctx: Ctx) {
  const webSrc = path.dirname(ctx.modulesRoot);
  for (const file of walk(webSrc).files) {
    if (!isSource(file) || isTest(file)) continue;
    const inModules = file.startsWith(ctx.modulesRoot + path.sep);
    scanFile(ctx, file, inModules);
  }
}

function scanFile(ctx: Ctx, file: string, inModules: boolean) {
  const text = fs.readFileSync(file, "utf8");
  const code = stripComments(text);
  const sf = ctx.project.createSourceFile(file, text, { overwrite: true });
  const imports = importsOf(sf);
  const add = (c: string, line?: number, extra?: string) => ctx.add(c, file, line, extra);

  // Rules that apply to the whole app (apps/web/src).
  for (const { spec, line } of imports) {
    if (spec === "axios") {
      add("FE-IMPORT002", line, spec);
      add("FE-IMPORT003", line, spec);
    } else if (
      spec === "lucide-react" ||
      spec.startsWith("@radix-ui/") ||
      spec.startsWith("@aham/ui-kit/primitives")
    ) {
      add("FE-IMPORT002", line, spec);
    }
  }
  code.split("\n").forEach((l, i) => {
    if (THEME_RE.test(l)) add("FE-THEME001", i + 1);
  });

  const loc = inModules ? classify(ctx, file) : null;
  if (!inModules) {
    ctx.project.removeSourceFile(sf);
    return;
  }
  const isHandlers = /\.handlers\.tsx?$/.test(file);
  const layer = loc?.layer;
  const isComponents = layer === "components" || (layer === "views" && loc?.sub === "components");
  const isView = layer === "views" || layer === "components";

  for (const { spec, line } of imports) {
    // Module boundaries
    const target = moduleTarget(ctx, file, spec);
    if (target && loc) {
      if (target.module !== loc.module) {
        if (!/^public(?:\.tsx?)?$/.test(target.rest.join("/"))) add("FE-STR012", line, spec);
      } else if (loc.feature && target.rest[0] === "features" && target.rest[1] !== loc.feature) {
        const inner = target.rest.slice(2).join("/");
        if (inner && !/^index(?:\.tsx?)?$/.test(inner)) add("FE-IMPORT001", line, spec);
      }
    }

    // Layering
    const local = isLocalSpec(spec);
    if (isView && (spec === "axios" || (local && hasSeg(spec, "api"))))
      add("FE-LAY001", line, spec);
    if (isComponents && local && hasSeg(spec, "api")) add("FE-LAY005", line, spec);
    if (layer === "hooks" && local && hasSeg(spec, "views")) add("FE-LAY002", line, spec);
    if (
      layer === "api" &&
      (isReact(spec) || (local && (hasSeg(spec, "hooks") || hasSeg(spec, "views"))))
    ) {
      add("FE-LAY003", line, spec);
    }
    if (
      layer === "model" &&
      (isReact(spec) ||
        (local && (hasSeg(spec, "api") || hasSeg(spec, "hooks") || hasSeg(spec, "views"))))
    ) {
      add("FE-LAY004", line, spec);
    }
  }

  if (layer === "hooks") {
    const jsx = sf.forEachDescendant((n) =>
      Node.isJsxElement(n) || Node.isJsxSelfClosingElement(n) || Node.isJsxFragment(n)
        ? n
        : undefined,
    );
    if (jsx) add("FE-LAY002", jsx.getStartLineNumber(), "JSX in hook");
  }
  if (layer === "routes" && !/\bpermission\b/.test(text)) add("FE-RBAC001");

  code.split("\n").forEach((l, i) => {
    const line = i + 1;
    if (isView && FETCH_RE.test(l)) add("FE-LAY001", line, "fetch/apiClient");
    if (layer !== "hooks" && QUERY_RE.test(l)) add("FE-DATA001", line);
    if (isHandlers) return;
    if (ARBITRARY_RE.test(l)) add("FE-UI001", line);
    const w = isView ? FIXED_WIDTH_RE.exec(l) : null;
    if (w && Number(w[1]) >= 300) add("FE-RESP001", line, `${w[0]}`);
  });

  if (!isHandlers) checkEffects(sf, add);
  if (isView && !isHandlers && !text.includes(ALLOW_I18N)) checkHardcodedText(sf, add);
  ctx.project.removeSourceFile(sf);
}

type Add = (code: string, line?: number, extra?: string) => void;

function checkEffects(sf: SourceFile, add: Add) {
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (!/^(?:React\.)?use(?:Layout)?Effect$/.test(call.getExpression().getText())) continue;
    const body = call.getArguments()[0]?.getText() ?? "";
    if (LISTENER_RE.test(body) && !(/\breturn\b/.test(body) && CLEANUP_RE.test(body))) {
      add("FE-MEM001", call.getStartLineNumber());
    }
  }
}

function checkHardcodedText(sf: SourceFile, add: Add) {
  const hasWords = (s: string) => /\p{L}{2,}/u.test(s.replace(/&\w+;/g, ""));
  sf.forEachDescendant((n) => {
    if (Node.isJsxText(n)) {
      const raw = n.getText();
      if (hasWords(raw)) {
        const offset = raw.length - raw.trimStart().length;
        add(
          "FE-I18N001",
          sf.getLineAndColumnAtPos(n.getStart() + offset).line,
          raw.trim().slice(0, 40),
        );
      }
    } else if (Node.isJsxAttribute(n)) {
      const init = n.getInitializer();
      if (
        init &&
        Node.isStringLiteral(init) &&
        I18N_ATTRS.has(n.getNameNode().getText()) &&
        hasWords(init.getLiteralValue())
      ) {
        add(
          "FE-I18N001",
          n.getStartLineNumber(),
          `${n.getNameNode().getText()}="${init.getLiteralValue().slice(0, 40)}"`,
        );
      }
    } else if (Node.isJsxExpression(n)) {
      const e = n.getExpression();
      const parent = n.getParent();
      if (
        e &&
        (Node.isStringLiteral(e) || Node.isNoSubstitutionTemplateLiteral(e)) &&
        !Node.isJsxAttribute(parent) &&
        hasWords(e.getLiteralValue())
      ) {
        add("FE-I18N001", n.getStartLineNumber(), e.getLiteralValue().slice(0, 40));
      }
    }
  });
}

// ── C. protected paths ───────────────────────────────────────────────────────

function git(root: string, args: string[]): string[] | null {
  try {
    const out = execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
    });
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

function checkProtectedPaths(ctx: Ctx) {
  if (process.env.DX_ALLOW_BASELINE === "1") return;
  const changed = new Set<string>();
  const base =
    git(ctx.root, ["diff", "--name-only", "--relative", "origin/main...HEAD"]) ??
    git(ctx.root, ["diff", "--name-only", "--relative", "HEAD~1", "HEAD"]);
  for (const list of [
    base,
    git(ctx.root, ["diff", "--name-only", "--relative"]),
    git(ctx.root, ["diff", "--name-only", "--relative", "--cached"]),
    git(ctx.root, ["ls-files", "--others", "--exclude-standard"]),
  ]) {
    for (const f of list ?? []) changed.add(posix(f));
  }
  for (const f of [...changed].sort()) {
    if (isProtectedPath(ctx.root, f)) ctx.add("FE-CORE001", path.join(ctx.root, f));
  }
}

// ── D. i18n key parity ───────────────────────────────────────────────────────

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return prefix ? [prefix] : [];
  return Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
}

function checkLocaleParity(ctx: Ctx, localesDir: string) {
  if (!isDir(localesDir)) return;
  const present = fs
    .readdirSync(localesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5));
  if (present.length === 0) return;
  const keys = new Map<string, Set<string>>();
  for (const locale of present) {
    const file = path.join(localesDir, `${locale}.json`);
    try {
      keys.set(locale, new Set(flatten(JSON.parse(fs.readFileSync(file, "utf8")))));
    } catch {
      ctx.add("FE-I18N002", file, undefined, "invalid JSON");
    }
  }
  for (const locale of REQUIRED_LOCALES) {
    if (!present.includes(locale))
      ctx.add("FE-I18N002", localesDir, undefined, `${locale}.json is missing`);
  }
  const all = new Set([...keys.values()].flatMap((s) => [...s]));
  for (const [locale, own] of keys) {
    const missing = [...all].filter((k) => !own.has(k)).sort();
    if (missing.length) {
      const more = missing.length > 5 ? ` (+${missing.length - 5} more)` : "";
      ctx.add(
        "FE-I18N002",
        path.join(localesDir, `${locale}.json`),
        undefined,
        `missing ${missing.slice(0, 5).join(", ")}${more}`,
      );
    }
  }
}

function checkLocales(ctx: Ctx) {
  for (const mod of subdirs(ctx.modulesRoot)) {
    const featuresDir = path.join(ctx.modulesRoot, mod, "features");
    for (const feature of subdirs(featuresDir))
      checkLocaleParity(ctx, path.join(featuresDir, feature, "locales"));
  }
}

// ── public API ───────────────────────────────────────────────────────────────

export function runChecks(repoRoot: string): Finding[] {
  const ctx = createCtx(path.resolve(repoRoot));
  checkStructure(ctx);
  checkLocales(ctx);
  if (isDir(ctx.modulesRoot)) scanFiles(ctx);
  checkProtectedPaths(ctx);

  const seen = new Set<string>();
  return ctx.findings
    .filter((f) => {
      const key = `${f.code}|${f.file}|${f.line ?? ""}|${f.message}`;
      return seen.has(key) ? false : (seen.add(key), true);
    })
    .sort(
      (a, b) =>
        a.file.localeCompare(b.file) ||
        (a.line ?? 0) - (b.line ?? 0) ||
        a.code.localeCompare(b.code),
    );
}

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) return "dx check: no problems found";
  const lines = findings.map(
    (f) => `${f.file}${f.line ? `:${f.line}` : ""}  ${f.code}  ${f.message}`,
  );
  return `${lines.join("\n")}\n\ndx check: ${findings.length} problem${findings.length === 1 ? "" : "s"} found`;
}
