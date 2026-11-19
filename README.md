# Aham

One repo for the **template** and its **example outputs** (backend + frontend).

```
Aham/
├── template/     # Single Copier source (stack: backend | frontend)
│   ├── backend/  # FastAPI + platform-kit
│   └── frontend/ # Vite + React + ui-kit
├── backend/      # Example generated API kits
├── frontend/     # Example generated UI kits
└── docs/         # Docusaurus documentation site
```

## Generate

```bash
uvx copier copy --trust ./template my-new-project
# choose stack=backend or stack=frontend
```

Pull improvements into an existing project: `uvx copier update --trust`.

## Backend examples (`backend/`)

| Folder | Shape |
|---|---|
| `poly-kit` | Shared platform-kit + contracts (incl. SaaS helpers) |
| `poly-service-kafka` | Standalone service + Kafka (pins local `poly-kit`) |
| `mono-monolith` | Monorepo monolith + **SaaS spine** (identity, billing, catalog, Redis) |
| `mono-micro-kafka-nx` | Monorepo microservices + Kafka + Nx |
| `mono-micro-moon` | Monorepo microservices + moon |

`platform_profile=saas` adds Redis, local IdP, tenancy, entitlements, IAM admin APIs (`/auth/users|roles|permissions`), and billing. Showcase catalog: tenant-scoped `categories` + `items` (gated by `catalog` entitlement).

`mono-monolith` ships an **initial Alembic revision** (identity + billing + catalog + RLS on catalog tables). Fresh generates still start with empty `versions/` until you run `dx db revision` or copy from the example.

## Frontend examples (`frontend/`)

| Folder | Shape |
|---|---|
| `web-spa` | Vite SPA + ui-kit — **catalog** (items/categories) + **admin** (users/roles/billing) |

Permissions match the SaaS JWT resource strings (`core-api.item:*`, `identity.user:*`, `billing.*`, …). Pair with mono-monolith or use `VITE_AUTH_MODE=dev` + MSW.

Details: [template/README.md](template/README.md) · [template/HANDOFF.md](template/HANDOFF.md)

## Documentation

Full docs (template, backend, frontend) live in [`docs/`](docs/) (Docusaurus).

```bash
cd docs
npm install
npm start    # http://localhost:3000
```
