# Frontend examples

Generated UI kits from `../template` with `stack=frontend`.

| Folder | Notes |
|---|---|
| [`web-spa`](web-spa/) | Vite + React + TanStack Router/Query + `@aham/ui-kit` — **catalog** + **admin** modules |

```bash
cd web-spa
pnpm install
VITE_USE_MOCKS=1 pnpm dev   # MSW-backed catalog + admin demo
pnpm dx check               # full-repo frontend rules
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

See [`web-spa/CONVENTIONS.md`](web-spa/CONVENTIONS.md) for the folder tree, import matrix, and golden code.
Docs: [`docs/docs/frontend/`](../docs/docs/frontend/).
