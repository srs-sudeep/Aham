# HANDOFF: continue this work

## Goal

Reusable Copier template for FastAPI **and** Vite frontend. Leads own the baseline; developers write modules/features. Wrong structure is flagged in the editor, by AI agents, at commit, and in CI.

## Layout of this template package

```
template/
  copier.yml          # stack: backend | frontend → _subdirectory
  backend/            # FastAPI + platform-kit (former template/)
  frontend/           # Vite + ui-kit
```

## Frontend (done in this pass)

- ui-kit: tokens + color presets, full shadcn set, AppShell, PreferencesProvider, i18n, api/query, Node `dx check`
- Core routes including `/settings` (theme mode, color preset, locale, density)
- Feature contract: `api` / `hooks` / `views` / `routes` / `locales`
- Example: `frontend/web-spa` (generated via copier `--skip-tasks`, then `pnpm install`)
- Enforcement: CI workflow, pre-commit dx check, Claude hooks, Cursor rules

## Backend expansions (this pass)

New `dx check` codes in platform-kit: `MEM001`, `MEM002`, `MEM003`, `CODE001`; broader `ASYNC001`. Tests added in `test_checks.py`.

## SaaS spine (enterprise-informed)

- Copier `platform_profile`: `saas` (default) | `api`
- Kit: Redis, rate limit, TokenIssuer/refresh, tenancy+RLS, entitlements (features+quotas), audit, provider ports
- `dx new-saas` / post-copy tasks scaffold identity + billing
- Example: `backend/mono-monolith` has identity+billing modules + Redis in compose
- Phase 2: OIDC SSO, SCIM Users, API keys, TOTP MFA; Stripe optional (`platform-kit[stripe]`)

## Next steps

1. Regenerate remaining backend examples from `./template` with `stack=backend` + `platform_profile=saas` where desired.
2. Runtime verify: postgres+redis, register/login/switch-tenant, require_feature/quota, RLS IDOR tests.
3. Run full backend `uv run dx test` / Docker / Kafka paths.
4. Optional: `stack: full` monorepo running both checkers.
5. Prefer `pnpm approve-builds --all` once after install (esbuild scripts).
6. Add stricter ESLint flat config when ready (lint scripts are placeholders today).

## Open items

- CI provider beyond GitHub Actions
- Real CODEOWNERS / JWKS / kit git URL
- Preferences API sync (localStorage only for now)
- OpenAPI codegen into feature `api/`
