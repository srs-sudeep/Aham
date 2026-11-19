# HANDOFF: continue this work in Claude Code

This repo was designed and built in a claude.ai chat. This file carries the context that the code itself doesn't.

## Goal
A reusable Copier template for every FastAPI project on our team. Leads own the baseline (RBAC, errors,
logging, middleware, DB, health, telemetry, messaging, lint/CI). Developers only write modules
(router / schemas / service / repository / models / dependencies). Wrong structure must be flagged
in the editor, by AI agents, at commit and in the PR, not in code review.

## Requirements (from the user)
1. Microservices optional; Kafka optional; repo manager optional (Nx / moon / none).
2. One client needs **polyrepo**, another **monorepo**. Both must share one baseline.
3. Docker for everyone. **No Kubernetes** (too heavy at our scale).
4. AI-assisted dev: Claude Code + Cursor configs; immediate flagging of structure/RBAC/pattern violations.
5. CI/CD with API tests AND structure tests.
6. Fixed error format with separate user message and developer message; standard middlewares and structured logs.
7. Own CLI (`dx`) when no repo manager is used.

## Key decisions (and why)
- **Copier** (not cookiecutter): `copier update` lets every project pull baseline fixes later.
- **uv** workspaces for monorepo; polyrepo services pin `platform-kit` by **git tag** (`[tool.uv.sources]`).
- Three layouts: `monorepo`, `polyrepo_service`, `polyrepo_kit`. The service/module skeletons live ONLY in
  `platform_kit/cli/templates/` (single source of truth); copier's post-task runs `dx new-service`.
- **Own AST checker** (`dx check`, `platform_kit/cli/checks.py`, 26 rule codes) instead of import-linter + Semgrep:
  one place for rules, precise messages, fast enough for per-file AI hooks, and no per-service config to maintain.
- **SecureRouter** uses composition (not subclassing APIRouter); `permission=` and `summary=` are required
  kwargs, so Pyright flags omissions while typing. `create_app()` refuses to start with unprotected routes.
- Errors: `AppError` has a user `message` and a developer `detail`; detail is returned only in dev/test, never prod.
- Pyright over ty/Pyrefly for now (stability); revisit when ty reaches 1.0.
- `dx` is stdlib-only and `platform_kit/__init__` uses lazy exports, so hooks start fast without importing FastAPI.
- Explicit transactions: repositories flush, services call `repo.commit()`.
- Python-side timestamp defaults (avoid async lazy-load after flush).

## Verification status
Verified in the chat sandbox (no network there):
- All 5 combinations render (monolith, microservices+kafka+nx, microservices+moon, polyrepo service+kafka, polyrepo kit).
- All generated TOML/YAML/JSON parse; all Python compiles; generated services pass `dx check` with 0 violations.
- `packages/platform-kit/tests/test_checks.py` (13 tests) pass; Claude hooks return exit 2 correctly.

**NOT yet run** (FastAPI etc. could not be installed there):
- Runtime: `test_errors.py`, `test_rbac.py`, the generated service tests (`tests/api`, `tests/unit`, `test_architecture.py`).
- `ruff` / `pyright` over the kit code itself (strict rule set in root `pyproject.toml.jinja`).
- Real `copier copy` (the chat used a Jinja2 emulation), the GitHub Actions pipeline, Docker builds, Kafka/outbox, OTel.

## Next steps for Claude Code (in order)
1. `uvx copier copy --trust . /tmp/try-mono` (answer: monorepo, microservices, kafka, none), then in it:
   `uv run dx test`, `uv run dx lint`. Fix anything in the TEMPLATE (here), not in /tmp.
2. Repeat for monolith, and for polyrepo_kit + polyrepo_service (push the kit to a test repo and tag `v0.1.0`).
3. Run ruff/pyright on `template/packages/platform-kit` and fix the findings without loosening rules.
4. `docker build` a generated service; `uv run dx up` and hit `/health/ready` and `/docs`.
5. Kafka path: publish via outbox, consume in another service, check the relay and `/health/ready`.
6. Open a PR in a generated repo to exercise CI (schemathesis, oasdiff, affected matrix).
7. `uv run pre-commit autoupdate` to refresh hook versions.

## Open items to confirm with the user
- CI provider: only GitHub Actions is implemented. Ask whether Azure DevOps or GitLab is needed (port is mechanical).
- Real values: CODEOWNERS team handle, kit git URL, JWKS/issuer/audience for the client IdP.
- Whether Renovate (supports git-tag sources) should replace Dependabot for bumping `platform-kit` in service repos.
