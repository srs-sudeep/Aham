---
description: Add an endpoint to an existing module the approved way
argument-hint: <service> <module> <method + path + behaviour>
---
Add to `$1` module `$2`: $ARGUMENTS

Order of work: schema(s) in `schemas.py` → method on the `<Entity>Service` → (query in repository if needed) →
endpoint in `router.py` with `permission=`, `summary=`, return type, ≤ 6 statements → if it needs a new
Action/Resource, say so (Resource entries live in `permissions.py`) → API test covering success, 401, 403 and the error cases.
Then run the Definition of done from AGENTS.md.
