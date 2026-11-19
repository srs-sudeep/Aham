# My Platform

Generated from the **FastAPI Platform Template** · layout: `polyrepo_service` · microservices · messaging: `kafka`

## First run
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh   # once per machine
uv sync --all-packages                             # python + deps from uv.lock
uv run pre-commit install                          # commit-time checks
docker compose up -d postgres kafka        # infra only
uv run dx db upgrade core-api                 # after the first migration exists
uv run dx run core-api                        # http://localhost:8001/docs
```

## Daily commands
| Task | Command |
|---|---|
| New feature module | `uv run dx new-module <service> <plural_name>` |
| Run one service | `uv run dx run <service>` |
| Everything in Docker | `uv run dx up` (`--observability` adds Jaeger) |
| Migration | `uv run dx db revision <service> -m "..."` |
| RBAC matrix | `uv run dx permissions <service>` |
| Dev token | `uv run dx token <service> --all` |
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
| Pull request | CI: quality → affected tests (Postgres) → schemathesis fuzzing → OpenAPI breaking-change check → Docker build |

Read **AGENTS.md** before writing code.

## Updating from the template
```bash
uvx copier update --trust     # pulls template improvements as a reviewable diff
```
