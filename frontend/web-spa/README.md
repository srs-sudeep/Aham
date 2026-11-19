# Web SPA

Vite + React SPA generated from the Aham frontend template.

## Stack

- Vite, React, TypeScript
- TanStack Router + TanStack Query
- Tailwind CSS + **shadcn/ui** via `@aham/ui-kit`
- i18n, theme presets, settings at `/settings`
- `pnpm dx check` — full-repo architecture/style rules

## Layout

```
packages/ui-kit/   # protected baseline (tokens, components, shell, prefs, dx)
apps/web/          # app shell + features
  src/routes/      # fixed core routes (login, shell, 403, 404, settings)
  src/features/    # product features: api / hooks / views / routes / locales
```

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm dx check     # full-repo rules
pnpm dx new-feature orders
```

Core routes are fixed. Add product pages only as features.
