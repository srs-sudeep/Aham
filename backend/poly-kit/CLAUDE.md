@AGENTS.md

## Claude Code specifics
- Hooks in `.claude/settings.json` run after every edit: the file is formatted, linted and structure-checked.
  If a hook reports problems, fix them before doing anything else. Do not work around the hook.
- Edits to protected baseline paths are blocked by a PreToolUse hook. Explain to the user what baseline change is needed instead.
- This repo's product is `packages/platform-kit`. Leads must launch Claude with `DX_ALLOW_BASELINE=1` to edit it.
- Slash commands: `/new-module`, `/new-endpoint`, `/review-structure`.
- Prefer `uv run dx ...` commands over raw tool invocations.
