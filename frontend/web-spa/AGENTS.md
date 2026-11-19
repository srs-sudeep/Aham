# Agent guide — Web SPA

## Do

- Put product UI in `apps/web/src/features/<name>/{api,hooks,views,routes,locales}`
- Import UI only from `@aham/ui-kit` / `@aham/ui-kit/components`
- Use `t()` for user-facing copy; register nav with `labelKey`
- Declare `permission` on every non-core route
- Change theme/locale only via kit Preferences APIs / `/settings`

## Do not

- Edit `packages/ui-kit` unless `DX_ALLOW_BASELINE=1`
- Import raw `components/ui` paths, `axios`, or call `fetch` from views
- Hardcode colors/font sizes (`text-[13px]`, `bg-[#…]`) in features
- Invent themes outside kit-registered presets
- Put API calls in views or JSX in `api/` / `hooks/`

Run `pnpm dx check` after edits. Commit/CI runs the **full** rule set on the whole repo.
