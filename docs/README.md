# Aham documentation

Docusaurus site covering the Copier template, FastAPI backends, and Vite SPA.

## Develop

```bash
cd docs
npm install
npm start    # http://localhost:3000
```

## Build

```bash
npm run build && npm run serve
```

## Content map

| Section | Highlights |
|---|---|
| Getting started | **HLA/LLD Mermaid + illustrations**, tech stack logos, local SaaS pairing, MSW |

| Template | Copier options (`auth_mode`), generation, example drift |
| Backend | API reference (IAM + catalog), permissions, data model, Alembic, tenancy, dx |
| Frontend | Modules→features, auth, catalog, **admin**, MSW, FE-* codes, testing |

Config: `docusaurus.config.ts` · Sidebars: `sidebars.ts`
