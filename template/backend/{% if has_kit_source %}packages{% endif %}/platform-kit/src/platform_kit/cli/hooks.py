"""Claude Code hooks (wired in .claude/settings.json).

PreToolUse  (Edit|Write|MultiEdit): block edits to protected baseline paths  -> exit 2, reason shown to Claude
PostToolUse (Edit|Write|MultiEdit): format + lint + structure-check the edited file -> exit 2 so Claude fixes it

Leads who must edit protected paths: export DX_ALLOW_BASELINE=1 before launching Claude
(especially in a polyrepo_kit repo, where packages/platform-kit IS the product).
"""

import json
import os
import subprocess
import sys
from pathlib import Path

from platform_kit.cli.checks import run_checks
from platform_kit.cli.config import load_config

# Always blocked by basename even when not listed as a directory prefix.
_PROTECTED_BASENAMES = frozenset({"permissions.py"})


def _edited_path(payload: dict[str, object]) -> Path | None:
    tool_input = payload.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        return None
    raw = tool_input.get("file_path") or tool_input.get("path") or tool_input.get("notebook_path")
    return Path(str(raw)).resolve() if raw else None


def _is_protected(path: Path, root: Path, protected_paths: list[str]) -> str | None:
    """Return the matching protected entry, or None."""
    if path.name in _PROTECTED_BASENAMES:
        return path.name
    for protected in protected_paths:
        pattern = protected.removeprefix("./")
        if pattern.startswith("**/"):
            if path.name == pattern[3:]:
                return protected
            continue
        target = (root / pattern).resolve()
        try:
            if path == target or path.is_relative_to(target):
                return protected
        except (OSError, ValueError):
            continue
    return None


def claude_pre() -> int:
    payload = json.loads(sys.stdin.read() or "{}")
    path = _edited_path(payload)
    if path is None or os.environ.get("DX_ALLOW_BASELINE") == "1":
        return 0
    cfg = load_config(path.parent if path.parent.exists() else None)
    matched = _is_protected(path, cfg.root, cfg.protected_paths)
    if matched is not None:
        rel = path.relative_to(cfg.root) if path.is_relative_to(cfg.root) else path
        print(
            f"BLOCKED: {rel} is part of the protected baseline ({matched}). "
            "Do not modify it. Implement the change inside the service's modules/ folder instead, "
            "or ask a lead to change the baseline (they can run with DX_ALLOW_BASELINE=1).",
            file=sys.stderr,
        )
        return 2
    return 0


def claude_post() -> int:
    payload = json.loads(sys.stdin.read() or "{}")
    path = _edited_path(payload)
    if path is None or path.suffix != ".py" or not path.exists():
        return 0
    cfg = load_config(path.parent)
    subprocess.run([sys.executable, "-m", "ruff", "format", "--quiet", str(path)], check=False)
    lint = subprocess.run(
        [sys.executable, "-m", "ruff", "check", "--fix", "--quiet", "--output-format", "concise", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    violations = run_checks(cfg, [path])
    problems = [line for line in lint.stdout.splitlines() if line.strip()] + [str(v) for v in violations]
    if problems:
        print(
            "The file you just edited breaks project rules. Fix ALL of these before continuing "
            "(see AGENTS.md; run `uv run dx rules` for explanations):\n" + "\n".join(problems),
            file=sys.stderr,
        )
        return 2
    return 0
