# Web SPA

Vite + React ERP-style SPA generated from the Aham frontend template.

Architecture, import rules and golden code: **[CONVENTIONS.md](./CONVENTIONS.md)**.
AI agents: see [AGENTS.md](./AGENTS.md).

## Stack

- Vite, React, TypeScript
- TanStack Router + TanStack Query
- Tailwind CSS + **shadcn/ui** via `@aham/ui-kit`
- i18n (en/ja), theme presets, tenant-aware API client
- MSW mocks, Vitest + Testing Library, Playwright, Storybook (ui-kit)
- `pnpm dx check` — full-repo architecture/style rules

## Layout

```
packages/ui-kit/            # protected baseline (tokens, components, shell, prefs, dx CLI)
apps/web/src/
  app/                      # router, providers, module registry (protected)
  core/                     # login, shell, home, /settings, 403/404 (protected)
  modules/<module>/         # product code
    module.ts public.ts     # manifest + cross-module surface
    shared/                 # module-wide api/hooks/model/components
    features/<feature>/     # api / hooks / model / views / routes / locales
apps/web/e2e/               # Playwright smoke tests
```

Reference modules:

- **`catalog`** — items + categories (lists, detail, forms, tenant-scoped keys, MSW)
- **`admin`** — users, roles, billing against `/auth/*` and `/billing/*`

SPA permission strings match the SaaS JWT resources (`core-api.item:*`,
`identity.user:*`, `billing.plan:list`, …).

## Develop

```bash
pnpm install
pnpm dev                       # http://localhost:5173
VITE_USE_MOCKS=1 pnpm dev      # run against MSW mocks (no backend needed)
pnpm dx check                  # full-repo rules
pnpm new-module orders
pnpm new-feature orders/invoices
pnpm gen-api http://localhost:8000/openapi.json
pnpm test                      # unit + component tests
pnpm --filter @web-spa/web e2e   # Playwright smoke (starts Vite with mocks)
pnpm --filter @aham/ui-kit storybook        # component catalog
```

### Mocks

Set `VITE_USE_MOCKS=1` to start MSW in the browser (`apps/web/src/lib/mocks.ts`
registers each feature's `*.handlers.ts`). Create the worker file once with
`pnpm --filter @web-spa/web mocks:init`.

### Settings

`/settings` is a core page: theme mode, color preset, language, density and
regional formats (dates/numbers/currency). Values are stored by the kit
`PreferencesProvider`; features never set theme or locale themselves.

Core routes are fixed. Add product pages only as module features.
