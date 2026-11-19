# My Platform

Generated from the **FastAPI Platform Template** · layout: `polyrepo_kit`

## First run
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh   # once per machine
uv sync --all-packages                             # python + deps from uv.lock
uv run pre-commit install                          # commit-time checks
```

## Daily commands
| Task | Command |
|---|---|
| Format | `uv run dx fmt` |
| Lint + types + structure | `uv run dx lint` |
| Tests | `uv run dx test [--service s] [--cov]` |
| Rule codes | `uv run dx rules` |

## Where rules are enforced
| Stage | What runs |
|---|---|
| Editor (VS Code / Cursor) | Ruff + Pyright on type; `dx watch` task feeds the Problems panel |
| AI agents | Claude Code hooks block baseline edits and re-check every edited file; Cursor rules in `.cursor/rules` |
| `git commit` | pre-commit: ruff, format, uv lock, dx check, pyright, gitleaks |
| Pull request | CI: quality → kit tests; tag `v*` → GitHub Release |

Read **AGENTS.md** before writing code.

## Updating from the template
```bash
uvx copier update --trust     # pulls template improvements as a reviewable diff
```
