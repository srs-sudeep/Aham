---
description: Review the current diff against the project rules
---
Run `uv run dx check` and `git diff --stat`. Then review the diff for things the tools cannot see:
business logic in routers, permissions that are too broad (e.g. READ used for a write), PUBLIC endpoints,
user-facing error messages that leak internals, missing tests for new branches, N+1 queries,
non-idempotent retries, breaking API/event changes. Report as a checklist with file:line references.
