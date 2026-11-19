# My Platform

Generated from the **FastAPI Platform Template** · layout: `monorepo` · modular monolith · messaging: `none` · repo manager: `none`

## First run
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh   # once per machine
uv sync --all-packages                             # python + deps from uv.lock
uv run pre-commit install                          # commit-time checks
docker compose up -d postgres redis                # infra only
uv run dx db upgrade core-api                      # after an Alembic revision exists
uv run dx run core-api                             # http://localhost:8001/docs
```

Modules in this example: **identity**, **billing**, **categories**, **items**. Pair with
`frontend/web-spa` (`VITE_AUTH_MODE=saas`, `VITE_API_BASE_URL=http://localhost:8001/api/v1`).

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
| Pull request | CI: quality → affected tests (Postgres) → schemathesis fuzzing → Docker build |

Read **AGENTS.md** before writing code.

## Updating from the template
```bash
uvx copier update --trust     # pulls template improvements as a reviewable diff
```
