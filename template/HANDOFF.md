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

## Frontend ERP module structure and dx commands

Frontend product code is organised as **modules → features** (replaces the old flat `features/`):

```
apps/web/src/
  app/        # PROTECTED: router, providers, registry (globs modules/*/module.ts)
  core/       # PROTECTED: login, shell, home, /settings (theme/locale/density/regional), errors
  modules/<module>/{module.ts,public.ts,locales,shared,features/<feature>}
    # feature = {index.ts,api,hooks,model,views/{pages,components},routes,locales}
```

- Reference modules:
  - **`catalog`** (items + categories): tenant-scoped keys, `useApi`, `ListPage` + `QueryState`, MSW, tests.
    Permissions use `core-api.item:*` / `core-api.category:*`.
  - **`admin`** (users, roles, billing): SPA surfaces for `/auth/users|roles|permissions` and `/billing/*`.
- Cross-module imports only via `public.ts`; cross-feature only via the feature `index.ts`.
- Full rules, import matrix and golden code: `frontend/CONVENTIONS.md` (plain Markdown, not rendered by Copier).
  Agent entry points: `AGENTS.md.jinja`, `CLAUDE.md`, `.cursor/rules/*.mdc`.

dx commands (run from the generated frontend root):

| Command | Purpose |
| --- | --- |
| `pnpm dx check [--format github]` | Full-repo architecture/style rules (hooks, pre-commit, CI) |
| `pnpm dx rules` | List `FE-*` rule codes |
| `pnpm new-module <name>` | Scaffold a module |
| `pnpm new-feature <module>/<name>` | Scaffold a feature and register it in `module.ts` |
| `pnpm gen-api <openapi-url>` | Generate `apps/web/src/lib/api-types.ts` |

Testing/tooling added: Vitest + Testing Library setup (`apps/web/src/test/setup.ts`), colocated catalog tests,
Playwright smoke (`apps/web/e2e`, `pnpm --filter <slug>/web e2e`; needs a generated project because
`AuthenticatedLayout` is a `.jinja` file), Storybook for `packages/ui-kit` (`pnpm --filter @aham/ui-kit storybook`;
theme/density toolbar). Dependencies were not installed in the template itself, so run `pnpm install` in a
generated project to verify.

## Backend expansions (this pass)

New `dx check` codes in platform-kit: `MEM001`, `MEM002`, `MEM003`, `CODE001`; broader `ASYNC001`. Tests added in `test_checks.py`.

## SaaS spine (enterprise-informed)

- Copier `platform_profile`: `saas` (default) | `api`
- Kit: Redis, rate limit, TokenIssuer/refresh, tenancy+RLS, entitlements (features+quotas), audit, provider ports
- `dx new-saas` / post-copy tasks scaffold identity + billing
- Example: `backend/mono-monolith` has identity + billing + catalog (categories/items) + Redis + initial Alembic
- IAM admin APIs: `/auth/users`, `/auth/roles`, `/auth/permissions` (system roles immutable)
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
