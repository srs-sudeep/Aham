import fs from "node:fs";
import path from "node:path";
import { RULES } from "./rules.js";

export type Finding = {
  code: string;
  message: string;
  file: string;
  line?: number;
};

const REQUIRED_DIRS = ["api", "hooks", "views", "routes"];
const ARBITRARY_RE = /(?:text|bg|border|from|to|via|fill|stroke)-\[(?:#[\da-fA-F]+|rgb|hsl|\d)/;
const FIXED_WIDTH_RE = /\bw-\[\d{3,}px\]/;
const HARDCODED_JSX_TEXT = />([A-Z][^<{]{2,})</;
const FETCH_RE = /\bfetch\s*\(|\baxios\b/;
const PERMISSION_RE = /permission\s*[:=]/
const QUERY_RE = /\buse(Query|Mutation|InfiniteQuery)\s*\(/;
const LISTENER_RE = /addEventListener\s*\(|setInterval\s*\(/;
const CLEANUP_RE = /removeEventListener\s*\(|clearInterval\s*\(|return\s*\(\s*\(\s*\)\s*=>/;
const THEME_HACK_RE = /document\.documentElement\.(classList|dataset|lang)/;

export function runChecks(repoRoot: string, paths?: string[]): Finding[] {
  const findings: Finding[] = [];
  const webSrc = path.join(repoRoot, "apps/web/src");
  const featuresDir = path.join(webSrc, "features");
  const allowBaseline = process.env.DX_ALLOW_BASELINE === "1";

  if (!allowBaseline) {
    const protectedGlobs = ["packages/ui-kit/", "apps/web/src/routes/"];
    for (const rel of paths ?? listFiles(repoRoot)) {
      const norm = rel.replaceAll("\\\\", "/");
      if (protectedGlobs.some((p) => norm.includes(p)) && paths) {
        // only flag when explicitly checking edited protected files via hook
        if (paths.includes(rel) || paths.some((p) => rel.endsWith(p) || p.endsWith(rel))) {
          findings.push({
            code: "FE-CORE001",
            message: RULES["FE-CORE001"],
            file: rel,
          });
        }
      }
    }
  }

  if (!fs.existsSync(featuresDir)) return findings;

  for (const name of fs.readdirSync(featuresDir)) {
    const featurePath = path.join(featuresDir, name);
    if (!fs.statSync(featurePath).isDirectory()) continue;
    checkFeature(featurePath, name, findings);
  }

  // full-repo scan of feature source
  for (const file of listFiles(featuresDir).filter((f) => /\.(tsx?|jsx?)$/.test(f))) {
    scanFile(file, findings);
  }

  return findings;
}

function checkFeature(featurePath: string, name: string, findings: Finding[]) {
  for (const dir of REQUIRED_DIRS) {
    if (!fs.existsSync(path.join(featurePath, dir))) {
      findings.push({
        code: "FE-STR001",
        message: `${RULES["FE-STR001"]}: ${name}/${dir}`,
        file: featurePath,
      });
    }
  }
  if (!fs.existsSync(path.join(featurePath, "index.ts")) && !fs.existsSync(path.join(featurePath, "index.tsx"))) {
    findings.push({
      code: "FE-STR002",
      message: `${RULES["FE-STR002"]}: ${name}`,
      file: featurePath,
    });
  }
  for (const entry of fs.readdirSync(featurePath)) {
    const full = path.join(featurePath, entry);
    if (fs.statSync(full).isFile() && !/^index\.tsx?$/.test(entry) && entry !== "README.md") {
      findings.push({
        code: "FE-STR003",
        message: `${RULES["FE-STR003"]}: ${name}/${entry}`,
        file: full,
      });
    }
  }
}

function scanFile(file: string, findings: Finding[]) {
  const content = fs.readFileSync(file, "utf8");
  const rel = file;
  const parts = file.replaceAll("\\\\", "/").split("/");
  const featIdx = parts.lastIndexOf("features");
  const section = featIdx >= 0 ? parts[featIdx + 2] : "";

  const lines = content.split("\n");
  lines.forEach((line, i) => {
    const lineNo = i + 1;
    if (ARBITRARY_RE.test(line) && section !== undefined) {
      findings.push({ code: "FE-UI001", message: RULES["FE-UI001"], file: rel, line: lineNo });
    }
    if (FIXED_WIDTH_RE.test(line) && section === "views") {
      findings.push({ code: "FE-RESP001", message: RULES["FE-RESP001"], file: rel, line: lineNo });
    }
    if (THEME_HACK_RE.test(line)) {
      findings.push({ code: "FE-THEME001", message: RULES["FE-THEME001"], file: rel, line: lineNo });
    }
  });

  if (section === "views") {
    if (/from\s+['\"].*\/api(\/|['\"])/.test(content) || FETCH_RE.test(content)) {
      findings.push({ code: "FE-LAY001", message: RULES["FE-LAY001"], file: rel });
    }
    if (/from\s+['\"]lucide-react['\"]/.test(content) || /components\/ui\//.test(content)) {
      findings.push({ code: "FE-IMPORT002", message: RULES["FE-IMPORT002"], file: rel });
    }
    if (!content.includes("// dx: allow-i18n") && HARDCODED_JSX_TEXT.test(content) && !/\$\{/.test(content)) {
      // soft heuristic
      const m = content.match(HARDCODED_JSX_TEXT);
      if (m && !m[1].trim().startsWith("{")) {
        findings.push({ code: "FE-I18N001", message: RULES["FE-I18N001"], file: rel });
      }
    }
  }

  if (section === "hooks") {
    if (/from\s+['\"].*\/views(\/|['\"])/.test(content) || /<[A-Z]/.test(content)) {
      findings.push({ code: "FE-LAY002", message: RULES["FE-LAY002"], file: rel });
    }
  }

  if (section === "api") {
    if (/from\s+['\"]react['\"]/.test(content) || /\/(hooks|views)\//.test(content)) {
      findings.push({ code: "FE-LAY003", message: RULES["FE-LAY003"], file: rel });
    }
    if (/\baxios\b/.test(content)) {
      findings.push({ code: "FE-IMPORT003", message: RULES["FE-IMPORT003"], file: rel });
    }
  }

  if (section === "routes") {
    if (FETCH_RE.test(content)) {
      findings.push({ code: "FE-LAY004", message: RULES["FE-LAY004"], file: rel });
    }
    if (!PERMISSION_RE.test(content)) {
      findings.push({ code: "FE-RBAC001", message: RULES["FE-RBAC001"], file: rel });
    }
  }

  if (QUERY_RE.test(content) && section !== "hooks") {
    findings.push({ code: "FE-DATA001", message: RULES["FE-DATA001"], file: rel });
  }

  if (/features\/[^/]+\/.+features\//.test(content) || /from\s+['\"]\.\.\/\.\.\/[^'"]+\/(api|hooks|views)/.test(content)) {
    if (/from\s+['\"][^'\"]*features\/[^'\"]+\//.test(content) && !/features\/[^'\"]+['\"]/.test(content)) {
      findings.push({ code: "FE-IMPORT001", message: RULES["FE-IMPORT001"], file: rel });
    }
  }

  if (LISTENER_RE.test(content) && content.includes("useEffect") && !CLEANUP_RE.test(content)) {
    findings.push({ code: "FE-MEM001", message: RULES["FE-MEM001"], file: rel });
  }
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

export function formatFindings(findings: Finding[]): string {
  return findings
    .map((f) => `${f.file}${f.line ? `:${f.line}` : ""}: ${f.code} ${f.message}`)
    .join("\n");
}
