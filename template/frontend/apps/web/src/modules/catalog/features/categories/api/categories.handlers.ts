import { HttpResponse, http } from "msw";
import type { CategoryDto } from "../../../shared/api/categories-lookup.api";

/**
 * MSW handlers for the categories API (enabled with VITE_USE_MOCKS=1).
 * Data lives in memory, one store per `X-Tenant-ID`, and resets on reload.
 * Seed ids are referenced by items.handlers.ts.
 */
const SEED: CategoryDto[] = [
  { id: "cat-hardware", name: "Hardware", description: "Physical devices and accessories." },
  { id: "cat-software", name: "Software", description: "Licenses and subscriptions." },
  { id: "cat-services", name: "Services", description: "Consulting and onboarding." },
];

const stores = new Map<string, CategoryDto[]>();

function storeFor(request: Request): CategoryDto[] {
  const tenant = request.headers.get("x-tenant-id") ?? "default";
  let store = stores.get(tenant);
  if (!store) {
    store = SEED.map((category) => ({ ...category }));
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
  payload: Partial<Omit<CategoryDto, "id">>,
  store: CategoryDto[],
  selfId?: string,
): Record<string, string[]> | null {
  const name = payload.name?.trim();
  if (!name) return { name: ["Name is required"] };
  const duplicate = store.some(
    (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== selfId,
  );
  return duplicate ? { name: ["Name already exists"] } : null;
}

export const categoriesHandlers = [
  http.get("*/categories", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase().trim();
    const pageParam = url.searchParams.get("page");
    const pageSizeParam = url.searchParams.get("pageSize");

    const filtered = storeFor(request).filter(
      (category) => !q || category.name.toLowerCase().includes(q),
    );
    // Paging is optional: the list page omits it, pickers pass pageSize.
    if (pageParam || pageSizeParam) {
      const page = Math.max(1, Number(pageParam ?? 1));
      const pageSize = Math.max(1, Number(pageSizeParam ?? 20));
      const start = (page - 1) * pageSize;
      return HttpResponse.json({
        items: filtered.slice(start, start + pageSize),
        total: filtered.length,
      });
    }
    return HttpResponse.json({ items: filtered, total: filtered.length });
  }),

  http.get("*/categories/:id", ({ request, params }) => {
    const category = storeFor(request).find((c) => c.id === params.id);
    if (!category) return errorResponse(404, "not_found", "Category not found");
    return HttpResponse.json(category);
  }),

  http.post("*/categories", async ({ request }) => {
    const store = storeFor(request);
    const payload = (await request.json()) as Omit<CategoryDto, "id">;
    const fields = validate(payload, store);
    if (fields) return errorResponse(422, "validation_error", "Validation failed", fields);
    const category: CategoryDto = { ...payload, id: `cat-${crypto.randomUUID().slice(0, 8)}` };
    store.push(category);
    return HttpResponse.json(category, { status: 201 });
  }),

  http.put("*/categories/:id", async ({ request, params }) => {
    const store = storeFor(request);
    const index = store.findIndex((c) => c.id === params.id);
    if (index === -1) return errorResponse(404, "not_found", "Category not found");
    const payload = (await request.json()) as Omit<CategoryDto, "id">;
    const fields = validate(payload, store, String(params.id));
    if (fields) return errorResponse(422, "validation_error", "Validation failed", fields);
    const category: CategoryDto = { ...payload, id: String(params.id) };
    store[index] = category;
    return HttpResponse.json(category);
  }),

  http.delete("*/categories/:id", ({ request, params }) => {
    const store = storeFor(request);
    const index = store.findIndex((c) => c.id === params.id);
    if (index === -1) return errorResponse(404, "not_found", "Category not found");
    store.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
