import type { ApiClient } from "@aham/ui-kit";
import type { Category, CategoryOption } from "../model/category.types";
import { toQueryString } from "./query-string";

/** Wire format for platform-kit `/api/v1/categories`. */
export type CategoryDto = {
  id: string;
  name: string;
  description?: string | null;
  tenant_id?: string;
};

export type CategoryListDto = {
  items: CategoryDto[];
  total: number;
};

export function toCategory(dto: CategoryDto): Category {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? undefined,
  };
}

export function toCategoryOption(category: Category): CategoryOption {
  return { value: category.id, label: category.name };
}

/** Read-only lookup used by pickers in other features / modules. */
export const categoriesLookupApi = {
  async options(client: ApiClient): Promise<CategoryOption[]> {
    const dto = await client.get<CategoryListDto>(`/categories${toQueryString({ pageSize: 100 })}`);
    return dto.items.map(toCategory).map(toCategoryOption);
  },
};
