import { HttpResponse, http } from "msw";
import type { ItemDto, ItemPayloadDto } from "../model/item.mappers";

/**
 * MSW handlers for the items API (enabled with VITE_USE_MOCKS=1).
 * Data lives in memory, one store per `X-Tenant-ID`, and resets on reload.
 * Category ids match the seed data in categories.handlers.ts.
 */
const SEED: ItemDto[] = [
  {
    id: "item-1",
    name: "Wireless Keyboard",
    sku: "KB-100",
    status: "active",
    category_id: "cat-hardware",
    price: 79.9,
    currency: "USD",
    description: "Compact bluetooth keyboard.",
  },
  {
    id: "item-2",
    name: "27-inch Monitor",
    sku: "MN-270",
    status: "active",
    category_id: "cat-hardware",
    price: 329,
    currency: "USD",
    description: "QHD IPS display.",
  },
  {
    id: "item-3",
    name: "Team License",
    sku: "LIC-TEAM",
    status: "draft",
    category_id: "cat-software",
    price: 1200,
    currency: "USD",
  },
  {
    id: "item-4",
    name: "Onboarding Workshop",
    sku: "SVC-ONB",
    status: "inactive",
    category_id: "cat-services",
    price: 50000,
    currency: "JPY",
  },
];

const stores = new Map<string, ItemDto[]>();

function storeFor(request: Request): ItemDto[] {
  const tenant = request.headers.get("x-tenant-id") ?? "default";
  let store = stores.get(tenant);
  if (!store) {
    store = SEED.map((item) => ({ ...item }));
    stores.set(tenant, store);
  }
  return store;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string[]>,
) {
  return HttpResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

function validate(
  payload: Partial<ItemPayloadDto>,
  store: ItemDto[],
  selfId?: string,
): Record<string, string[]> | null {
  const fields: Record<string, string[]> = {};
  if (!payload.name?.trim()) fields.name = ["Name is required"];
  if (!payload.sku?.trim()) fields.sku = ["SKU is required"];
  else if (store.some((i) => i.sku === payload.sku && i.id !== selfId)) {
    fields.sku = ["SKU already exists"];
  }
  return Object.keys(fields).length > 0 ? fields : null;
}

export const itemsHandlers = [
  http.get("*/items", ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") ?? 20));
    const q = url.searchParams.get("q")?.toLowerCase().trim();
    const status = url.searchParams.get("status");

    const filtered = storeFor(request).filter((item) => {
      if (status && item.status !== status) return false;
      if (q && !`${item.name} ${item.sku}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      items: filtered.slice(start, start + pageSize),
      total: filtered.length,
    });
  }),

  http.get("*/items/:id", ({ request, params }) => {
    const item = storeFor(request).find((i) => i.id === params.id);
    if (!item) return errorResponse(404, "not_found", "Item not found");
    return HttpResponse.json(item);
  }),

  http.post("*/items", async ({ request }) => {
    const store = storeFor(request);
    const payload = (await request.json()) as ItemPayloadDto;
    const fields = validate(payload, store);
    if (fields) return errorResponse(422, "validation_error", "Validation failed", fields);
    const item: ItemDto = { ...payload, id: `item-${crypto.randomUUID().slice(0, 8)}` };
    store.unshift(item);
    return HttpResponse.json(item, { status: 201 });
  }),

  http.put("*/items/:id", async ({ request, params }) => {
    const store = storeFor(request);
    const index = store.findIndex((i) => i.id === params.id);
    if (index === -1) return errorResponse(404, "not_found", "Item not found");
    const payload = (await request.json()) as ItemPayloadDto;
    const fields = validate(payload, store, String(params.id));
    if (fields) return errorResponse(422, "validation_error", "Validation failed", fields);
    const item: ItemDto = { ...payload, id: String(params.id) };
    store[index] = item;
    return HttpResponse.json(item);
  }),

  http.delete("*/items/:id", ({ request, params }) => {
    const store = storeFor(request);
    const index = store.findIndex((i) => i.id === params.id);
    if (index === -1) return errorResponse(404, "not_found", "Item not found");
    store.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
