# FastAPI Platform Template

One Copier template for every FastAPI project, whether it is a monolith, a monorepo of microservices or a polyrepo,
with or without Kafka, with or without Nx/moon. The baseline (RBAC, errors, logging, middleware, DB, health,
telemetry, messaging, tooling) is written once in **platform-kit**. Teams only write **modules**: schemas,
models, service, repository, endpoints.

```bash
uvx copier copy --trust gh:<your-org>/fastapi-platform-template my-project   # new project
uvx copier update --trust                                                     # pull template improvements later
```

## The questions and what they change

| Question | Options | Effect |
|---|---|---|
| `repo_layout` | `monorepo` | uv workspace: `packages/platform-kit` + `services/*` (+ `packages/contracts`) |
| | `polyrepo_service` | one service at the repo root; platform-kit pinned by **git tag** |
| | `polyrepo_kit` | the repo that hosts platform-kit + contracts; CI releases on `v*` tags |
| `architecture` | `monolith` / `microservices` | monolith = exactly one service (`dx` refuses a second); microservices adds the OpenAPI contract check |
| `messaging` | `none` / `kafka` | Kafka in compose, FastStream + transactional outbox, `contracts` package |
| `repo_manager` | `none` / `nx` / `moon` | `none` = the built-in `dx` CLI does everything; nx/moon get project files + affected CI |
| `ai_tools` | `claude`, `cursor` | `CLAUDE.md` + `.claude/` hooks & commands; `.cursor/rules/*.mdc` |

Client A (polyrepo): generate one `polyrepo_kit` repo, then one `polyrepo_service` repo per service.
Client B (monorepo): one `monorepo` repo, then `uv run dx new-service <name>` per service.

## How the rules are enforced (the same rules everywhere)

The rules live in one place, `platform_kit/cli/checks.py` (`dx check`), plus Ruff and Pyright config.

1. **While typing.** `SecureRouter` verb methods make `permission=` and `summary=` *required* keyword arguments, so
   Pyright underlines a missing permission immediately. Ruff's banned-API rule flags `HTTPException` and `requests`.
   The `dx watch` VS Code/Cursor task feeds architecture violations into the Problems panel.
2. **When an AI edits.** Claude Code `PreToolUse` blocks edits to protected paths. `PostToolUse` formats, lints and
   structure-checks the edited file, and exit code 2 sends the problems back to Claude to fix. Cursor gets scoped `.mdc` rules.
3. **On commit.** pre-commit runs ruff, format, uv-lock, dx check, pyright and gitleaks.
4. **On the PR.** CI runs: quality (with inline PR annotations), then affected tests on Postgres with a coverage gate,
   then Schemathesis fuzzing from the OpenAPI spec, then the oasdiff breaking-change check (microservices), then the Docker build.
5. **At runtime.** `create_app()` refuses to start if any route lacks a permission. `tests/test_architecture.py` runs `dx check` as a test.

`uv run dx rules` lists all 26 rule codes (structure, RBAC, layering, errors, logging, config, SQL injection, blocking calls).

Authorization is **route-level RBAC** (`Resource:Action` on SecureRouter), not object-level PBAC — permissions gate endpoints, not individual rows.

## Errors and logs

Every error has a user `message` (always returned) and a developer `detail` (always logged; returned only in dev/test,
**never** in prod). There is one envelope for every status code:
`{"error": {"code", "message", "request_id", "fields"?, "debug"?}}`.
Logs are JSON (console in dev), and every line carries the same fields: timestamp, level, event, service, env, request_id, user_id, trace_id.

## No Kubernetes

Every service is a non-root Docker image with a healthcheck and migrations-on-start. `dx up` merges the root
`compose.yaml` with each `services/*/compose.service.yaml`. The same images run on one VM with Compose, or on
Azure Container Apps / ECS Fargate / Cloud Run (see `infra/README.md`).

## Layout of this template repo

```
copier.yml                                   questions + post-generation tasks
template/                                    rendered into the new project
  packages/platform-kit/src/platform_kit/    the baseline (protected in generated repos)
    app.py config.py errors.py logging.py middleware.py rbac.py security.py
    db.py health.py http.py telemetry.py messaging.py testing.py
    cli/  main.py checks.py scaffold.py hooks.py config.py
          templates/service/**  templates/module/**   <- single source of truth for new services/modules
  packages/contracts/                        event schemas (kafka / kit repo only)
  .github/  .claude/  .cursor/  .vscode/  AGENTS.md  compose.yaml  infra/  pyproject.toml ...
```

## Verified while building / to verify on first use

Verified: all 5 layout combinations render without errors; every generated TOML/YAML/JSON file parses and every Python file compiles;
generated services pass `dx check` with zero violations; the checker's own test suite (13 tests) passes; both Claude hooks return the right exit codes.

Not yet run (the build environment had no network access to install FastAPI etc.): the runtime test suites and the
generated CI pipeline. After generating your first project, run `uv run dx test` and push a PR to see CI run once.
Pin the `rev:` versions in `.pre-commit-config.yaml` with `uv run pre-commit autoupdate`.

## Extending the baseline

- **New rule:** add a code to `RULES` in `checks.py`, implement it, add a test in `tests/test_checks.py`.
- **New module file type:** add it to `[tool.dx] module_optional` and `LAYER_RULES`.
- **GitLab / Azure DevOps:** port `.github/workflows/ci.yml.jinja`. Every step is a `uv run dx ...` call, so the port is mechanical.
