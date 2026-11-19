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
| Getting started | Local SaaS pairing, MSW mode, meta-repo drift |
| Template | Copier options (`auth_mode`), generation, example drift |
| Backend | API reference, env map, permissions, data model, tenancy, dx rules |
| Frontend | Modules→features, auth, catalog, MSW, FE-* codes, testing |

Config: `docusaurus.config.ts` · Sidebars: `sidebars.ts`
