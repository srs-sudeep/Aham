# Aham meta-repo

This repo is a **Copier template** plus generated **examples**. Agents working here edit the
template; the examples are output.

## Layout
- `template/` is the source of truth. `template/copier.yml` asks `stack` (backend | frontend) and
  renders `template/backend/` or `template/frontend/`.
- `backend/*` and `frontend/web-spa` are rendered examples. Do not hand-edit them: change
  `template/`, re-render, and copy the result over (see `scripts/check-examples.sh` for the exact
  answers each example uses).
- One exception: `platform-kit` is developed in `backend/mono-monolith/packages/platform-kit`
  (so its tests run against a real service), then rsynced into
  `template/backend/{% if has_kit_source %}packages{% endif %}/platform-kit` and the other kit
  examples. When rsyncing with `--delete`, exclude `*.jinja`, `project.json` and `moon.yml`
  (repo-manager files that only exist on the template / Nx / moon side). The SaaS module templates in `platform_kit/cli/templates/saas/` mirror
  `backend/mono-monolith/services/core-api/src/core_api/modules/{identity,billing}` with
  `core_api` → `$package` and `$` → `$$`.
- `docs/` is the Docusaurus site.

## Rendering
```bash
uvx copier copy --trust --defaults --skip-tasks --data stack=frontend ... template /tmp/out
```
Drop `--skip-tasks` to also run `uv sync`, `dx new-service`, `pnpm install` like a real user.

## Definition of done
- `./scripts/check-examples.sh` passes (examples match the template, no nested `.git`).
- Every touched example passes its own checks: backend `uv run ruff check . && uv run pyright &&
  uv run dx check && uv run pytest -q`; frontend `pnpm format:check && pnpm typecheck && pnpm lint &&
  pnpm dx check && pnpm test && pnpm --filter ./apps/web build`.
- `.github/workflows/template.yml` renders a matrix of answer combinations; add a row when you add
  a Copier choice.
