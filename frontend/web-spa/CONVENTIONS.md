# Frontend conventions

Vite + React ERP-style SPA. Product code lives in **modules**; each module is a
set of **features**. Everything is enforced by `pnpm dx check` (editor hooks,
pre-commit and CI run the same rules). Rule codes: `pnpm dx rules`.

## 1. Folder tree

```
packages/ui-kit/                 # PROTECTED baseline (tokens, components, shell, prefs, dx CLI)
  src/primitives/                #   layer 0: shadcn/radix wrappers (kit-internal only)
  src/components/                #   layer 1: public components + icons (@aham/ui-kit/components)
  src/{layout,data,form,feedback,patterns}/   layer 2: Page, DataTable, Form, QueryState, ListPage…
  src/{shell,preferences,api,i18n,format,tenancy,auth,testing}/   runtime services
apps/web/src/
  app/                           # PROTECTED: router, providers, registry (auto-discovers modules)
  core/                          # PROTECTED: auth/login, shell, home, settings, errors, core locales
  lib/                           # api client, i18n bootstrap, MSW bootstrap
  modules/<module>/
    module.ts                    # defineModule({ id, labelKey, icon, order, features: [...] })
    public.ts                    # the ONLY file other modules may import
    locales/{en,ja}.json         # module-level copy
    shared/{api,hooks,model,components}/   # reused by this module's features only
    features/<feature>/
      index.ts                   # defineFeature({ id, routes, nav, locales })
      api/       *.api.ts, *.keys.ts, *.handlers.ts (MSW)
      hooks/     use-*.ts (TanStack Query via useApi) — no JSX
      model/     *.schema.ts (zod), *.constants.ts, *.mappers.ts — pure TS
      views/pages/        route-level screens (flat)
      views/components/   feature UI (one group level max)
      routes/    *.routes.tsx (path + permission)
      locales/   {en,ja}.json
apps/web/e2e/                    # Playwright smoke tests
```

Max depth: features never nest features; `views/pages` is flat; component groups
are 1 level deep (`views/components/pricing/…`). Tests are colocated
(`*.test.ts[x]`) and exempt from style rules.

## 2. Import matrix

Rows may import columns. `✓` allowed, `✗` forbidden (rule code in parentheses).

| from \ to              |     ui-kit root/components      | model |      api       |   hooks    |   views    |   other feature (same module)   |       other module        |
| ---------------------- | :-----------------------------: | :---: | :------------: | :--------: | :--------: | :-----------------------------: | :-----------------------: |
| `views/*`              |                ✓                |   ✓   | ✗ (LAY001/005) |     ✓      |     ✓      | its `index.ts` only (IMPORT001) | `public.ts` only (STR012) |
| `hooks/*`              |                ✓                |   ✓   |       ✓        |     ✓      | ✗ (LAY002) |         `index.ts` only         |     `public.ts` only      |
| `api/*`                |        client types only        |   ✓   |       ✓        | ✗ (LAY003) | ✗ (LAY003) |         `index.ts` only         |     `public.ts` only      |
| `model/*`              |            no React             |   ✓   |   ✗ (LAY004)   |     ✗      |     ✗      |         `index.ts` only         |     `public.ts` only      |
| `routes/*`, `index.ts` |                ✓                |   ✓   |       –        |     ✓      |     ✓      |                ✓                |     `public.ts` only      |
| `shared/*`             | same layering as feature layers |       |                |            |            |                ✗                |     `public.ts` only      |

Always banned in `apps/web`: `lucide-react`, `axios`, `@radix-ui/*`,
`@aham/ui-kit/primitives` (IMPORT002/003). Use `@aham/ui-kit` /
`@aham/ui-kit/components`. `fetch`/`apiClient` only inside `api/`. `useQuery` /
`useMutation` only inside `hooks/` (DATA001). Never import `app/` or `core/`
from modules.

## 3. Golden code

**Module + feature manifests** (`module.ts`, `features/items/index.ts`):

```ts
export default defineModule({
  id: "catalog",
  labelKey: "catalog.title",
  icon: Package,
  order: 20,
  features: [items, categories],
});

export default defineFeature({
  id: "items",
  routes: itemsRoutes, // each route declares `permission`
  nav: {
    labelKey: "items.title",
    to: "/catalog/items",
    permission: "core-api.item:list",
    icon: Package,
  },
  locales: { en, ja },
});
```

Adding `modules/<name>/module.ts` registers the module (`app/registry.ts` globs it).

**Tenant-scoped keys factory** (`api/items.keys.ts`) — every key starts with `all(tenantId)`:

```ts
export const itemsKeys = {
  all: (tenantId: string | null) => ["catalog", "items", tenantId] as const,
  lists: (t: string | null) => [...itemsKeys.all(t), "list"] as const,
  list: (t: string | null, s: ItemsSearch) => [...itemsKeys.lists(t), s] as const,
  detail: (t: string | null, id: string) => [...itemsKeys.all(t), "detail", id] as const,
};
```

**Hooks via `useApi`** (`hooks/use-items.ts`):

```ts
export function useItems(search: ItemsSearch) {
  const { client, tenantId } = useApi();
  return useQuery({
    queryKey: itemsKeys.list(tenantId, search),
    queryFn: () => itemsApi.list(client, search),
    placeholderData: keepPreviousData,
  });
}
```

**List page** (`views/pages/ItemsListPage.tsx`) — `ListPage` + `QueryState`, no data fetching in JSX:

```tsx
<ListPage
  titleKey="items.title"
  actions={<Can permission="core-api.item:create">…</Can>}
  filters={<FilterBar>…</FilterBar>}
>
  <QueryState query={query} isEmpty={(d) => d.items.length === 0} emptyMessage={t("items.empty")}>
    {(data) => <ItemsTable items={data.items} /* … */ />}
  </QueryState>
</ListPage>
```

Search state lives in the URL, parsed by a zod schema in `model/` (`itemsSearchSchema`).
Forms: `useZodForm` + `Form`/`FormField`, map 422s with `mapServerErrors`.
Cross-module reuse goes through `public.ts` (e.g. `ItemPicker`, `useItemOptions`).

## 4. Styling rules

- Compose UI from kit components only (`Button`, `Card`, `Badge`, `Page`, `Section`, …).
- In features, Tailwind is for **layout utilities only**: `flex`, `grid`, `gap-*`, `space-y-*`, `p-*`, `w-full`, `items-*`, `justify-*`.
- Colors/typography come from tokens (`bg-background`, `text-muted-foreground`, `Typography` components). No `bg-[#…]`, `text-[13px]`, `border-[rgb…]` (UI001). No fixed widths ≥ 300px in views (RESP001).
- Theme, color preset, locale, density and regional formats change only through `PreferencesProvider` / `/settings` (THEME001). Never touch `document.documentElement`.
- Dates/numbers/money: `formatDate`, `formatDateTime`, `formatNumber`, `formatMoney` from the kit.
- All user-facing text via `t("<feature>.<key>")`; keep `en` and `ja` keys in sync (I18N001/002).

## 5. Mocks, tests, e2e, Storybook

- `VITE_USE_MOCKS=1 pnpm dev` starts MSW with `*.handlers.ts` (see `lib/mocks.ts`). Run `pnpm --filter @<slug>/web mocks:init` once to create the worker file.
- Unit/component tests: `pnpm test` (Vitest; jsdom via `// @vitest-environment jsdom`; wrap with `TestProviders` from `@aham/ui-kit/testing`).
- E2E: `pnpm --filter @<slug>/web e2e` (Playwright, starts Vite with mocks).
- Storybook: `pnpm --filter @aham/ui-kit storybook` (theme/density toolbar).

## 6. Commands

| Command                                    | Purpose                                                              |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `pnpm dx check [--format github]`          | Full-repo architecture/style rules (run before commit)               |
| `pnpm dx rules`                            | List rule codes                                                      |
| `pnpm new-module <name>`                   | Scaffold `modules/<name>` (module.ts, public.ts, shared/, features/) |
| `pnpm new-feature <module>/<name>`         | Scaffold a feature (also `<name> --module <module>`)                 |
| `pnpm gen-api <openapi-url>`               | Generate `apps/web/src/lib/api-types.ts`                             |
| `pnpm typecheck && pnpm lint && pnpm test` | Standard gates (CI runs all + build)                                 |

Protected paths (`packages/ui-kit`, `apps/web/src/app`, `apps/web/src/core`) need
`DX_ALLOW_BASELINE=1` and a lead's review.
