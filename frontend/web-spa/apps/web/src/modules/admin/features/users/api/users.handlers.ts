import { HttpResponse, http } from "msw";
import type { TenantUserDto } from "../model/users.schema";

const SEED: TenantUserDto[] = [
  {
    user_id: "user-1",
    email: "owner@acme.test",
    status: "active",
    membership_status: "active",
    role_id: "role-admin",
    role: "admin",
  },
  {
    user_id: "user-2",
    email: "member@acme.test",
    status: "active",
    membership_status: "active",
    role_id: "role-member",
    role: "member",
  },
];

const stores = new Map<string, TenantUserDto[]>();

function storeFor(request: Request): TenantUserDto[] {
  const tenant = request.headers.get("x-tenant-id") ?? "default";
  let store = stores.get(tenant);
  if (!store) {
    store = SEED.map((row) => ({ ...row }));
    stores.set(tenant, store);
  }
  return store;
}

export const usersHandlers = [
  http.get("*/auth/users", ({ request }) => HttpResponse.json(storeFor(request))),
  http.post("*/auth/invitations", async ({ request }) => {
    const body = (await request.json()) as { email: string; role: string };
    const store = storeFor(request);
    store.push({
      user_id: `user-${store.length + 1}`,
      email: body.email,
      status: "active",
      membership_status: "active",
      role_id: `role-${body.role}`,
      role: body.role,
    });
    return HttpResponse.json({ ok: true }, { status: 201 });
  }),
  http.patch("*/auth/users/:userId", async ({ request, params }) => {
    const body = (await request.json()) as {
      role?: string;
      membership_status?: string;
    };
    const store = storeFor(request);
    const row = store.find((u) => u.user_id === params.userId);
    if (!row) {
      return HttpResponse.json(
        { error: { code: "membership_not_found", message: "Not found" } },
        { status: 404 },
      );
    }
    if (body.role) row.role = body.role;
    if (body.membership_status) row.membership_status = body.membership_status;
    return HttpResponse.json(row);
  }),
];
