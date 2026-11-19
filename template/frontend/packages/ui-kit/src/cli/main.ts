#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { formatFindings, runChecks } from "./checks.js";
import { RULES } from "./rules.js";
import { newFeature } from "./scaffold.js";

function findRoot(start = process.cwd()): string {
  let cur = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(cur, "pnpm-workspace.yaml"))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) return process.cwd();
    cur = parent;
  }
}

function usage() {
  console.log(`dx <command>

Commands:
  check [--format github]   Full-repo frontend architecture checks
  rules                     List rule codes
  new-feature <name>        Scaffold feature folders
  hook <pre|post>           AI hook helpers
`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const root = findRoot();

  if (!cmd || cmd === "-h" || cmd === "--help") {
    usage();
    return;
  }

  if (cmd === "rules") {
    for (const [code, msg] of Object.entries(RULES)) console.log(`${code}\t${msg}`);
    return;
  }

  if (cmd === "check") {
    const findings = runChecks(root);
    if (args.includes("--format") && args.includes("github")) {
      for (const f of findings) {
        const level = "error";
        console.log(`::${level} file=${f.file},line=${f.line ?? 1}::${f.code} ${f.message}`);
      }
    } else if (findings.length) {
      console.error(formatFindings(findings));
    }
    process.exit(findings.length ? 1 : 0);
  }

  if (cmd === "new-feature") {
    const name = args[0];
    if (!name) throw new Error("usage: dx new-feature <name>");
    newFeature(root, name);
    console.log(`Created features/${name}`);
    return;
  }

  if (cmd === "hook") {
    const kind = args[0];
    if (kind === "pre") {
      const file = process.env.DX_HOOK_FILE || "";
      if (file.includes("packages/ui-kit") && process.env.DX_ALLOW_BASELINE !== "1") {
        console.error("FE-CORE001 Protected ui-kit path");
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

  usage();
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
