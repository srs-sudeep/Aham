# Aham

One repo for the **template** and its **example outputs** (backend + frontend).

```
Aham/
├── template/     # Single Copier source (stack: backend | frontend)
│   ├── backend/  # FastAPI + platform-kit
│   └── frontend/ # Vite + React + ui-kit
├── backend/      # Example generated API kits
└── frontend/     # Example generated UI kits
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
| `mono-monolith` | Monorepo monolith + **SaaS spine** (identity, billing, Redis) |
| `mono-micro-kafka-nx` | Monorepo microservices + Kafka + Nx |
| `mono-micro-moon` | Monorepo microservices + moon |

Copier question `platform_profile=saas` adds Redis, local IdP, tenancy, entitlements (`dx new-saas`).

## Frontend examples (`frontend/`)

| Folder | Shape |
|---|---|
| `web-spa` | Vite SPA + ui-kit (shadcn, settings/theme/i18n, items feature) |

Details: [template/README.md](template/README.md) · [template/HANDOFF.md](template/HANDOFF.md)
