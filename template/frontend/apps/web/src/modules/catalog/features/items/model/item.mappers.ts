import type { ApiErrorFields } from "@aham/ui-kit";
import { DEFAULT_CURRENCY, type ItemStatus } from "./item.constants";
import type { Item, ItemFormValues, ItemInput, ItemPage } from "./item.schema";

/** Wire format (snake_case) returned by platform-kit `/api/v1/items`. */
export type ItemDto = {
  id: string;
  name: string;
  sku: string;
  status: ItemStatus;
  category_id?: string | null;
  price?: number | null;
  currency?: string | null;
  description?: string | null;
  tenant_id?: string;
};

export type ItemListDto = {
  items: ItemDto[];
  total: number;
};

export type ItemPayloadDto = Omit<ItemDto, "id">;

export function toItem(dto: ItemDto): Item {
  return {
    id: dto.id,
    name: dto.name,
    sku: dto.sku,
    status: dto.status,
    categoryId: dto.category_id ?? undefined,
    price: dto.price ?? undefined,
    currency: dto.currency ?? undefined,
    description: dto.description ?? undefined,
  };
}

export function toItemPage(dto: ItemListDto): ItemPage {
  return { items: dto.items.map(toItem), total: dto.total };
}

export function toItemPayload(input: ItemInput): ItemPayloadDto {
  return {
    name: input.name,
    sku: input.sku,
    status: input.status,
    category_id: input.categoryId ?? null,
    price: input.price ?? null,
    currency: input.currency ?? null,
    description: input.description ?? null,
  };
}

export const emptyItemFormValues: ItemFormValues = {
  name: "",
  sku: "",
  status: "draft",
  categoryId: "",
  price: "",
  currency: DEFAULT_CURRENCY,
  description: "",
};

export function itemToFormValues(item: Item): ItemFormValues {
  const currency = item.currency as ItemFormValues["currency"] | undefined;
  return {
    name: item.name,
    sku: item.sku,
    status: item.status,
    categoryId: item.categoryId ?? "",
    price: item.price === undefined ? "" : String(item.price),
    currency: currency ?? DEFAULT_CURRENCY,
    description: item.description ?? "",
  };
}

export function formValuesToInput(values: ItemFormValues): ItemInput {
  const price = values.price.trim();
  const description = values.description.trim();
  return {
    name: values.name.trim(),
    sku: values.sku.trim(),
    status: values.status,
    categoryId: values.categoryId || undefined,
    price: price === "" ? undefined : Number(price),
    currency: price === "" ? undefined : values.currency,
    description: description === "" ? undefined : description,
  };
}

/** Rename API field names (snake_case) to form field names (camelCase). */
export function toFormErrorFields(fields: ApiErrorFields | undefined): ApiErrorFields | undefined {
  if (!fields) return undefined;
  const renamed: ApiErrorFields = {};
  for (const [key, messages] of Object.entries(fields)) {
    renamed[key === "category_id" ? "categoryId" : key] = messages;
  }
  return renamed;
}
