## What & why

## Checklist
- [ ] New endpoints declare the narrowest `permission=` (no new `PUBLIC` without a reason below)
- [ ] User-facing error messages are safe; developer detail is in `detail=`
- [ ] API + unit tests added/updated
- [ ] Migration added (`dx db revision`) if models changed
- [ ] No breaking API / event contract changes (or versioned + announced)
