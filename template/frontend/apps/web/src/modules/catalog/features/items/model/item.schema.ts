import { z } from "zod";
import {
  DEFAULT_PAGE_SIZE,
  ITEM_CURRENCIES,
  ITEM_STATUSES,
  MAX_PAGE_SIZE,
  type ItemStatus,
} from "./item.constants";

export type { ItemStatus };

export type Item = {
  id: string;
  name: string;
  sku: string;
  status: ItemStatus;
  categoryId?: string;
  price?: number;
  currency?: string;
  description?: string;
};

/** Payload for create / update (everything but the server-assigned id). */
export type ItemInput = Omit<Item, "id">;

export type ItemPage = {
  items: Item[];
  total: number;
};

export const itemStatusSchema = z.enum(ITEM_STATUSES);

// ── list search params (URL state) ───────────────────────────────────────────

export const itemsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE),
  q: z.string().optional().catch(undefined),
  status: itemStatusSchema.optional().catch(undefined),
});

export type ItemsSearch = z.infer<typeof itemsSearchSchema>;

// ── form ─────────────────────────────────────────────────────────────────────

type Translate = (key: string) => string;

/**
 * Form values are plain strings (so input type === output type for the zod
 * resolver); `item.mappers.ts` converts to / from the typed `ItemInput`.
 * Messages are translated by the caller so users see localized errors.
 */
export function createItemFormSchema(t: Translate) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("items.validation.nameRequired"))
      .max(120, t("items.validation.nameTooLong")),
    sku: z
      .string()
      .trim()
      .min(1, t("items.validation.skuRequired"))
      .max(64, t("items.validation.skuTooLong")),
    status: itemStatusSchema,
    categoryId: z.string(),
    price: z
      .string()
      .trim()
      .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        message: t("items.validation.priceInvalid"),
      }),
    currency: z.enum(ITEM_CURRENCIES),
    description: z.string().max(1000, t("items.validation.descriptionTooLong")),
  });
}

export type ItemFormValues = z.infer<ReturnType<typeof createItemFormSchema>>;
