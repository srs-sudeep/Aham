#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { formatFindings, isProtectedPath, runChecks } from "./checks.js";
import { RULES } from "./rules.js";
import { newFeature, newModule } from "./scaffold.js";

const API_TYPES_OUT = "apps/web/src/lib/api-types.ts";

function findRoot(start = process.cwd()): string {
  let cur = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(cur, "pnpm-workspace.yaml"))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return process.cwd();
    cur = parent;
  }
}

/** Read `--flag value` / `--flag=value`; returns the value and the remaining args. */
function takeOption(args: string[], flag: string): { value?: string; rest: string[] } {
  const rest: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === flag) value = args[++i];
    else if (a.startsWith(`${flag}=`)) value = a.slice(flag.length + 1);
    else rest.push(a);
  }
  return { value, rest };
}

function usage() {
  console.log(`dx <command>

Commands:
  check [--format github]        Full-repo frontend architecture checks
  rules                          List rule codes
  new-module <name>              Scaffold modules/<name> (module.ts, public.ts, shared/, features/)
  new-feature <module>/<name>    Scaffold a feature (or: new-feature <name> --module <module>)
  gen-api [url]                  Generate ${API_TYPES_OUT} from an OpenAPI spec
  hook <pre|post>                AI hook helpers
`);
}

function runCheck(root: string, args: string[]): never {
  const { value: format } = takeOption(args, "--format");
  const findings = runChecks(root);
  if (format === "github") {
    for (const f of findings) {
      const msg = `${f.code} ${f.message}`.replace(/\r?\n/g, " ");
      console.log(`::error file=${f.file},line=${f.line ?? 1}::${msg}`);
    }
  } else {
    console.log(formatFindings(findings));
  }
  process.exit(findings.length ? 1 : 0);
}

function genApi(root: string, url?: string): void {
  if (!url) {
    console.log(`Generate API types from an OpenAPI spec:

  pnpm gen-api http://localhost:8000/openapi.json

which runs:

  npx openapi-typescript <url> -o ${API_TYPES_OUT}
`);
    return;
  }
  const res = spawnSync("npx", ["--yes", "openapi-typescript", url, "-o", API_TYPES_OUT], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
  console.log(`Wrote ${API_TYPES_OUT}`);
}

function runHook(root: string, kind: string | undefined): void {
  if (kind === "pre") {
    const file = process.env.DX_HOOK_FILE ?? "";
    if (file && process.env.DX_ALLOW_BASELINE !== "1" && isProtectedPath(root, file)) {
      console.error(`FE-CORE001 ${RULES["FE-CORE001"]}: ${file}`);
      process.exit(2);
    }
    return;
  }
  if (kind === "post") {
    const findings = runChecks(root);
    if (findings.length) {
      console.error(formatFindings(findings));
      process.exit(2);
    }
    return;
  }
  throw new Error("usage: dx hook <pre|post>");
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const root = findRoot();

  switch (cmd) {
    case undefined:
    case "-h":
    case "--help":
      return usage();
    case "rules":
      for (const [code, msg] of Object.entries(RULES)) console.log(`${code}\t${msg}`);
      return;
    case "check":
      return runCheck(root, args);
    case "new-module": {
      if (!args[0]) throw new Error("usage: dx new-module <name>");
      newModule(root, args[0]);
      console.log(`Created modules/${args[0]}`);
      return;
    }
    case "new-feature": {
      const { value: moduleName, rest } = takeOption(args, "--module");
      if (!rest[0]) throw new Error("usage: dx new-feature <module>/<name>");
      newFeature(root, rest[0], moduleName);
      console.log(
        `Created feature ${moduleName && !rest[0].includes("/") ? `${moduleName}/` : ""}${rest[0]}`,
      );
      return;
    }
    case "gen-api":
      return genApi(root, args[0]);
    case "hook":
      return runHook(root, args[0]);
    default:
      usage();
      process.exit(1);
  }
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
