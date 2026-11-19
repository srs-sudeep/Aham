import type { ApiClient } from "@aham/ui-kit";

export type Item = {
  id: string;
  name: string;
  description?: string | null;
};

export type ItemPage = {
  items: Item[];
  total: number;
};

const MOCK: Item[] = [
  { id: "1", name: "Alpha", description: "First item" },
  { id: "2", name: "Beta", description: "Second item" },
];

export function createItemsApi(client: ApiClient) {
  return {
    async list(): Promise<ItemPage> {
      try {
        return await client.get<ItemPage>("/items");
      } catch {
        return { items: MOCK, total: MOCK.length };
      }
    },
    async get(id: string): Promise<Item> {
      try {
        return await client.get<Item>(`/items/${id}`);
      } catch {
        const found = MOCK.find((i) => i.id === id);
        if (!found) throw new Error("Not found");
        return found;
      }
    },
  };
}
