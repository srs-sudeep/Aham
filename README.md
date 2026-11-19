# Aham

One repo for the **template** and its **example outputs** (backend today, frontend next).

```
Aham/
├── template/     # Single Copier source (backend + frontend later)
├── backend/      # Example generated API kits
└── frontend/     # Example generated UI kits (empty for now)
```

## One template, not two

Keep a **single** `template/` folder with one `copier.yml`.

- Today it generates FastAPI backends (monolith / microservices / polyrepo, Kafka, Nx/moon, …).
- Later, add a Copier question such as `stack: backend | frontend` (or `full`) and Jinja
  conditionals — same flow, no second template repo to maintain.

Generate:

```bash
uvx copier copy --trust ./template my-new-project
# after publish:
# uvx copier copy --trust gh:srs-sudeep/Aham my-new-project
```

Pull improvements into an existing project: `uvx copier update --trust`.

## Example backends (`backend/`)

| Folder | Shape |
|---|---|
| `poly-kit` | Shared platform-kit + contracts |
| `poly-service-kafka` | Standalone service + Kafka |
| `mono-monolith` | Monorepo, one service, `dx` only |
| `mono-micro-kafka-nx` | Monorepo microservices + Kafka + Nx |
| `mono-micro-moon` | Monorepo microservices + moon |

## Example frontends (`frontend/`)

Reserved for UI starters produced from the same Copier template once the frontend path exists.

Details: [template/README.md](template/README.md) · [template/HANDOFF.md](template/HANDOFF.md)
