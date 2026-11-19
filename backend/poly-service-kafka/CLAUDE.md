@AGENTS.md

## Claude Code specifics
- Hooks in `.claude/settings.json` run after every edit: the file is formatted, linted and structure-checked.
  If a hook reports problems, fix them before doing anything else. Do not work around the hook.
- Edits to protected baseline paths are blocked by a PreToolUse hook. Explain to the user what baseline change is needed instead.
- Slash commands: `/new-module`, `/new-endpoint`, `/review-structure`.
- Prefer `uv run dx ...` commands over raw tool invocations.
