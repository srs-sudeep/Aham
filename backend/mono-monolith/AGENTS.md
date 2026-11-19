# AGENTS.md: rules for every contributor (humans, Claude Code, Cursor, Copilot)

This repo is generated from the **FastAPI Platform Template**. The structure is enforced by tooling,
so code that ignores these rules fails in the editor, in the AI hook, in pre-commit and in CI.
Run `uv run dx rules` to see every rule code.

## Repo shape
- `packages/platform-kit/`: **protected baseline** (RBAC, errors, logging, middleware, DB, health, telemetry, messaging, `dx` CLI). Do not edit.
- `services/<service>/`: one folder per application (this repo is a modular monolith: exactly one service).

## Where code goes (a feature = a module)
Create modules ONLY with: `uv run dx new-module <service> <plural_snake_name>`

```
src/<package>/modules/<module>/
  router.py        HTTP only: SecureRouter endpoints. Parse -> call service -> return schema. ≤ 6 statements per endpoint.
  schemas.py       Pydantic request/response models. No SQLAlchemy.
  service.py       Business logic in a <Entity>Service class. No FastAPI/Starlette imports. Raises AppError subclasses.
  repository.py    DB queries only (subclass BaseRepository). No schemas, no HTTP.
  models.py        SQLAlchemy tables only.
  dependencies.py  Wiring: builds the service for a request (the only file that may combine every layer).
  errors.py        (optional) Domain errors subclassing platform_kit errors.
  events.py        (optional) Event subscribers.
  constants.py     (optional) Constants/enums.
```
No other files or sub-folders inside a module. No `.py` files directly in `modules/`.

Import rules: router ↛ repository/models/sqlalchemy · service ↛ fastapi/router · repository ↛ service/schemas/fastapi ·
another module may be used only through its `service`, `schemas` or `errors` · **services never import each other**
(use `platform_kit.http.ServiceClient`).

## SaaS spine (when `platform_profile=saas`)
- Redis is required (`REDIS_URL`). Access JWT + opaque refresh (hashed in Redis); use `/auth/login`, `/auth/refresh`, `/auth/switch-tenant`.
- Install modules with `uv run dx new-saas <service>` (identity + billing). Do not hand-roll auth tables.
- Tenancy: roles live on **memberships**, not on the global user. Tokens carry `tid`; never trust a client-supplied tenant id.
  Tenant routes take `tenant_id: TenantIdDep` (binds RLS too). Only platform-operator routes (`_operator: PlatformOperatorDep`,
  `PLATFORM_OPERATOR_TENANT_ID`) may target another tenant. `dx check` TEN001 flags tenant-owned modules whose router binds neither.
- IAM admin APIs (under `/auth`): `GET/PATCH /users`, `GET/POST/PATCH/DELETE /roles`, `PUT /roles/{id}/permissions`,
  `GET /permissions`. System roles (`admin`/`member`/`viewer`) are shared and immutable; customize by creating **tenant** roles.
  `ROLE_PERMISSIONS` in `permissions.py` is the bootstrap seed + code fallback; live grants come from the Role/Permission tables
  and are embedded in the access JWT at issue time (`PermissionResolver` caches by role name — invalidate on mutation).
- Isolation ≠ authorization: use `TenantScopedMixin` + Postgres RLS (`platform_kit.tenancy.enable_rls_sql`) on domain tables; fail closed on tenant mismatch.
- Showcase catalog: `dx new-service --with-example` installs tenant-scoped `categories` + `items` (association via `category_id`);
  mutating routes are gated with `require_feature("catalog")`.
- Entitlements: gate paid features with `require_feature("…")` / `require_quota("…")` — never call a payment provider on the hot path. ManualProvider activates plans; Stripe is a phase-2 `PaymentProvider`.
- Audit: append-only (`/auth/audit`); never store passwords/tokens in payloads.
- Phase 2: OIDC SSO (`/auth/sso/*`), SCIM (`/scim/v2/Users`), API keys (`aham_…` / `X-API-Key`), TOTP MFA.
- Billing default is **ManualProvider**. Stripe is optional: install `platform-kit[stripe]` and set `STRIPE_*`.

## Endpoints & RBAC (mandatory)

This is **route-level RBAC** (permission strings on HTTP routes), not object-level / PBAC.
A permission like `orders.item:read` authorizes the endpoint; it does **not** scope rows by owner or tenant.
Object-level checks (IDOR, multi-tenant filters) are a separate concern — discuss with a lead before inventing patterns.
Under SaaS, also enforce `tid` isolation on every tenant-owned row (RLS + repository filters).

```python
router = SecureRouter(prefix="/purchase-orders", tags=["purchase-orders"])


@router.post(
    "", permission=Permission(Resource.PURCHASE_ORDER, Action.CREATE), summary="Create purchase order", status_code=201
)
async def create_purchase_order(body: PurchaseOrderCreate, svc: PurchaseOrderServiceDep) -> PurchaseOrderRead:
    return await svc.create(body)
```
- Every endpoint: `async def`, `permission=` (or `PUBLIC`, which reviewers will question), `summary=`, a return type.
- Resources live in `permissions.py` (`Resource` enum; `dx new-module` adds them). Role → permission mapping is `ROLE_PERMISSIONS`. `permissions.py` is protected — ask a lead to change it (or use `DX_ALLOW_BASELINE=1`).
- Never check route permissions by hand inside services; never use `APIRouter`/`FastAPI()` directly.

## Errors (two messages: user + developer)
- Raise `platform_kit` errors (or subclasses in `errors.py`): `NotFoundError`, `ConflictError`, `ForbiddenError`, `BadRequestError`, `UnprocessableError`, `ExternalServiceError`.
- `message` = safe text for end users. `detail=` = developer text (logged always, returned only in dev/test). Extra kwargs become log fields.
  `raise OrderNotFoundError(detail=f"order {order_id} missing for tenant {tenant}", order_id=str(order_id))`
- Never use `HTTPException`, never return error dicts by hand, never `except: pass`.
- Every error response is `{"error": {"code", "message", "request_id", "fields"?, "debug"?}}`.

## Logging
`log = get_logger(__name__)` then `log.info("purchase_order_created", purchase_order_id=str(po.id))`.
Event names are snake_case verbs; data goes in key/values, never f-strings. request_id/user_id/trace_id are added automatically.
No `print`, no `logging.getLogger`.

## Config, DB, HTTP
- Config: add fields to `settings.py` (env vars). Never read `os.environ`.
- DB: repositories `flush`; the service calls `await self.repo.commit()` once per write use-case. Schema changes need `uv run dx db revision <service> -m "..."`.
- Calling another service: `OrdersClient = ServiceClientDep("orders")`, inject it, `await client.get_json("/api/v1/orders/1")`.

## Tests (required with every change)
- `tests/api/test_<module>.py`: through HTTP with real auth: happy path, 401, 403, 404 envelope, 422 fields.
- `tests/unit/test_<module>_service.py`: service with a fake repository.
- `tests/test_architecture.py` already asserts RBAC + structure. Never delete or skip it.

## Definition of done (run before saying you are finished)
```
uv run dx fmt
uv run dx lint --service <service>
uv run dx test --service <service>
```
All three must pass. Never add `# dx: ignore`, `# type: ignore` or `# noqa` to get green without a comment explaining why.

## Never
Edit protected paths (packages/platform-kit, .github, `.claude`, `.cursor`, AGENTS.md, root pyproject.toml, `permissions.py`) ·
add dependencies without saying so · commit secrets or `.env` · disable tests or rules · invent new folders/layers.
Leads who must edit the baseline: `DX_ALLOW_BASELINE=1`.
