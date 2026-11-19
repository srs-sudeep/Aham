import type { ApiClient } from "@aham/ui-kit";
import { toQueryString } from "../../../shared/api/query-string";
import {
  toItem,
  toItemPage,
  toItemPayload,
  type ItemDto,
  type ItemListDto,
} from "../model/item.mappers";
import type { Item, ItemInput, ItemPage, ItemsSearch } from "../model/item.schema";

/** Thin HTTP layer. Errors propagate to callers — there is no mock fallback. */
export const itemsApi = {
  async list(client: ApiClient, search: ItemsSearch): Promise<ItemPage> {
    const dto = await client.get<ItemListDto>(
      `/items${toQueryString({
        page: search.page,
        pageSize: search.pageSize,
        q: search.q,
        status: search.status,
      })}`,
    );
    return toItemPage(dto);
  },

  async get(client: ApiClient, id: string): Promise<Item> {
    return toItem(await client.get<ItemDto>(`/items/${encodeURIComponent(id)}`));
  },

  async create(client: ApiClient, input: ItemInput): Promise<Item> {
    return toItem(await client.post<ItemDto>("/items", toItemPayload(input)));
  },

  async update(client: ApiClient, id: string, input: ItemInput): Promise<Item> {
    return toItem(
      await client.put<ItemDto>(`/items/${encodeURIComponent(id)}`, toItemPayload(input)),
    );
  },

  async delete(client: ApiClient, id: string): Promise<void> {
    await client.delete<void>(`/items/${encodeURIComponent(id)}`);
  },
};
