import type { ApiClient } from "@aham/ui-kit";
import { toQueryString } from "../../../shared/api/query-string";
import {
  toCategory,
  type CategoryDto,
  type CategoryListDto,
} from "../../../shared/api/categories-lookup.api";
import type {
  Category,
  CategoriesSearch,
  CategoryInput,
  CategoryPage,
} from "../model/category.schema";

function toPayload(input: CategoryInput): Omit<CategoryDto, "id"> {
  return { name: input.name, description: input.description ?? null };
}

/** Thin HTTP layer. Errors propagate to callers — there is no mock fallback. */
export const categoriesApi = {
  async list(client: ApiClient, search: CategoriesSearch): Promise<CategoryPage> {
    const dto = await client.get<CategoryListDto>(`/categories${toQueryString({ q: search.q })}`);
    return { items: dto.items.map(toCategory), total: dto.total };
  },

  async get(client: ApiClient, id: string): Promise<Category> {
    return toCategory(await client.get<CategoryDto>(`/categories/${encodeURIComponent(id)}`));
  },

  async create(client: ApiClient, input: CategoryInput): Promise<Category> {
    return toCategory(await client.post<CategoryDto>("/categories", toPayload(input)));
  },

  async update(client: ApiClient, id: string, input: CategoryInput): Promise<Category> {
    return toCategory(
      await client.put<CategoryDto>(`/categories/${encodeURIComponent(id)}`, toPayload(input)),
    );
  },

  async delete(client: ApiClient, id: string): Promise<void> {
    await client.delete<void>(`/categories/${encodeURIComponent(id)}`);
  },
};
