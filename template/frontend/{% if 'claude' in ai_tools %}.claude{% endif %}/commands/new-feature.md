Create the structure with the dx CLI (see `CONVENTIONS.md`):

1. New module (only if it does not exist): `pnpm new-module <module>` (creates `modules/<module>/{module.ts,public.ts,shared,features}`).
   Modules are auto-registered by `app/registry.ts`. If you add module-level `locales/`, merge them in `apps/web/src/lib/i18n.ts` like `catalog`.
2. New feature: `pnpm new-feature <module>/<feature>` (or `pnpm new-feature <feature> --module <module>`).
   The CLI appends the feature manifest to the module's `features: [...]`; verify it in `module.ts`.
3. Fill in `api` → `hooks` → `model` → `views` → `routes`, with `permission` on every route and
   `en` + `ja` keys in the feature `locales/`.
4. Run `pnpm dx check`.
