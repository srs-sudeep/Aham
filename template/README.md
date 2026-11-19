# Aham Platform Template

One Copier template for **backend** (FastAPI) or **frontend** (Vite + ui-kit).

```bash
uvx copier copy --trust ./template my-project
# stack: backend | frontend
uvx copier update --trust
```

## Stack: backend

See the original FastAPI platform docs below. Source tree: [`backend/`](backend/).

Questions: `repo_layout`, `architecture`, `messaging`, `platform_profile` (`saas` | `api`), `repo_manager`, …  
Baseline: **platform-kit** + `dx check` (structure, RBAC, layering, plus MEM/ASYNC/CODE rules).

### `platform_profile=saas` (default for new backends)

Local IdP (access + refresh), Redis, multi-tenant memberships, org switcher, DB roles/permissions,
enterprise-shaped audit, plans/features/quotas with `require_feature` / `require_quota`, ManualProvider.
Phase 2 (implemented): per-tenant OIDC SSO, SCIM 2.0 Users, API keys (`aham_…` / `X-API-Key`),
TOTP MFA. **Stripe is optional** — default billing is ManualProvider (`/billing/subscription/activate`).
To enable cards: `platform-kit[stripe]` + `STRIPE_API_KEY` / `STRIPE_WEBHOOK_SECRET`.

```bash
uv run dx new-saas <service>          # monolith: identity + billing modules
docker compose up -d postgres redis
```

## Stack: frontend

Source tree: [`frontend/`](frontend/).

- Vite + React + TypeScript
- TanStack Router + TanStack Query
- Tailwind + **shadcn/ui** via `@aham/ui-kit` (tokens, presets, shell)
- **Fixed core routes:** `/login`, AppShell `/`, `/settings`, `/forbidden`, `/not-found`
- **Features:** `api/` · `hooks/` · `views/` · `routes/` · `locales/`
- `/settings`: light/dark/system, color presets, language (en/ja), density
- `pnpm dx check` — full-repo FE rules (STR/LAY/UI/RBAC/DATA/MEM/I18N/THEME/…)

```bash
pnpm install
pnpm dev
pnpm dx check
pnpm dx new-feature orders
```

---

# FastAPI Platform Template (backend)

One Copier template for every FastAPI project, whether it is a monolith, a monorepo of microservices or a polyrepo,
with or without Kafka, with or without Nx/moon. The baseline (RBAC, errors, logging, middleware, DB, health,
telemetry, messaging, tooling) is written once in **platform-kit**. Teams only write **modules**: schemas,
models, service, repository, endpoints.

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

## How the rules are enforced

Backend and frontend each run **full-repo** `dx check` on commit and CI (not only the diff). AI hooks may scope to edited files for speed.

`uv run dx rules` / `pnpm dx rules` lists rule codes for that stack.

## No Kubernetes

Every backend service is a non-root Docker image with a healthcheck and migrations-on-start.

## Verified / to verify

- Frontend: `copier copy` with `stack=frontend` renders; `pnpm dx check` + ui-kit tests + Vite production build succeed for `frontend/web-spa`.
- Backend: structure/`dx check` unit tests include new MEM/CODE rules in the template kit. Full runtime/CI still follow HANDOFF.
