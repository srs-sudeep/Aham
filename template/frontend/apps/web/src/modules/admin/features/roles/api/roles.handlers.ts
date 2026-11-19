import { HttpResponse, http } from "msw";
import type { PermissionCatalogDto, RoleDto } from "../model/roles.schema";

const PERMISSIONS: PermissionCatalogDto[] = [
  { code: "identity.user:list", description: "List users" },
  { code: "identity.user:create", description: "Invite users" },
  { code: "identity.user:update", description: "Update users" },
  { code: "identity.role:list", description: "List roles" },
  { code: "identity.role:create", description: "Create roles" },
  { code: "identity.role:update", description: "Update roles" },
  { code: "identity.role:delete", description: "Delete roles" },
  { code: "identity.permission:list", description: "List permission catalog" },
  { code: "billing.plan:list", description: "List plans" },
  { code: "billing.subscription:read", description: "Read subscription" },
  { code: "billing.subscription:create", description: "Start checkout" },
  { code: "billing.subscription:delete", description: "Cancel subscription" },
];

const SEED: RoleDto[] = [
  {
    id: "role-admin",
    name: "admin",
    is_system: true,
    tenant_id: null,
    permissions: ["*"],
  },
  {
    id: "role-member",
    name: "member",
    is_system: true,
    tenant_id: null,
    permissions: ["identity.user:list", "billing.plan:list", "billing.subscription:read"],
  },
  {
    id: "role-viewer",
    name: "viewer",
    is_system: true,
    tenant_id: null,
    permissions: ["identity.user:list", "identity.role:list"],
  },
];

const stores = new Map<string, RoleDto[]>();

function storeFor(request: Request): RoleDto[] {
  const tenant = request.headers.get("x-tenant-id") ?? "default";
  let store = stores.get(tenant);
  if (!store) {
    store = SEED.map((row) => ({ ...row, permissions: [...row.permissions] }));
    stores.set(tenant, store);
  }
  return store;
}

export const rolesHandlers = [
  http.get("*/auth/permissions", () => HttpResponse.json(PERMISSIONS)),
  http.get("*/auth/roles", ({ request }) => HttpResponse.json(storeFor(request))),
  http.get("*/auth/roles/:roleId", ({ request, params }) => {
    const row = storeFor(request).find((r) => r.id === params.roleId);
    if (!row) {
      return HttpResponse.json(
        { error: { code: "role_not_found", message: "Not found" } },
        { status: 404 },
      );
    }
    return HttpResponse.json(row);
  }),
  http.post("*/auth/roles", async ({ request }) => {
    const body = (await request.json()) as { name: string; permissions?: string[] };
    const store = storeFor(request);
    const row: RoleDto = {
      id: `role-${body.name}`,
      name: body.name,
      is_system: false,
      tenant_id: request.headers.get("x-tenant-id") ?? "default",
      permissions: body.permissions ?? [],
    };
    store.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),
  http.patch("*/auth/roles/:roleId", async ({ request, params }) => {
    const body = (await request.json()) as { name?: string };
    const store = storeFor(request);
    const row = store.find((r) => r.id === params.roleId);
    if (!row || row.is_system) {
      return HttpResponse.json(
        { error: { code: "role_immutable", message: "Cannot update" } },
        { status: 400 },
      );
    }
    if (body.name) row.name = body.name;
    return HttpResponse.json(row);
  }),
  http.delete("*/auth/roles/:roleId", ({ request, params }) => {
    const store = storeFor(request);
    const idx = store.findIndex((r) => r.id === params.roleId);
    if (idx < 0 || store[idx]?.is_system) {
      return HttpResponse.json(
        { error: { code: "role_immutable", message: "Cannot delete" } },
        { status: 400 },
      );
    }
    store.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.put("*/auth/roles/:roleId/permissions", async ({ request, params }) => {
    const body = (await request.json()) as { permissions: string[] };
    const store = storeFor(request);
    const row = store.find((r) => r.id === params.roleId);
    if (!row || row.is_system) {
      return HttpResponse.json(
        { error: { code: "role_immutable", message: "Cannot update" } },
        { status: 400 },
      );
    }
    row.permissions = body.permissions;
    return HttpResponse.json(row);
  }),
];
