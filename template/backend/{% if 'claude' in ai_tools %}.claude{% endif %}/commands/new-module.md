---
description: Scaffold a new feature module and implement it following AGENTS.md
argument-hint: <service> <plural_snake_name> <what it does>
---
1. Run `uv run dx new-module $1 $2`. Never create module files by hand.
2. Read the generated files, then adapt `models.py`, `schemas.py`, `service.py`, `repository.py` to: $ARGUMENTS
3. Keep endpoints thin; put rules in the service; raise domain errors from `errors.py`.
4. Update `tests/api/test_$2.py` and `tests/unit/test_$2_service.py` for the new behaviour.
5. Run `uv run dx db revision $1 -m "add $2"` and show me the migration.
6. Finish with the Definition of done from AGENTS.md and report the results.
