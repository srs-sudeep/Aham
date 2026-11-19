import { z } from "zod";
import type { Category } from "../../../shared/model/category.types";

export type { Category };

/** Payload for create / update (everything but the server-assigned id). */
export type CategoryInput = Omit<Category, "id">;

export type CategoryPage = {
  items: Category[];
  total: number;
};

// ── list search params (URL state) ───────────────────────────────────────────

export const categoriesSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
});

export type CategoriesSearch = z.infer<typeof categoriesSearchSchema>;

// ── form ─────────────────────────────────────────────────────────────────────

type Translate = (key: string) => string;

export function createCategoryFormSchema(t: Translate) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t("categories.validation.nameRequired"))
      .max(80, t("categories.validation.nameTooLong")),
    description: z.string().max(500, t("categories.validation.descriptionTooLong")),
  });
}

export type CategoryFormValues = z.infer<ReturnType<typeof createCategoryFormSchema>>;

export const emptyCategoryFormValues: CategoryFormValues = { name: "", description: "" };

export function categoryToFormValues(category: Category): CategoryFormValues {
  return { name: category.name, description: category.description ?? "" };
}

export function formValuesToCategoryInput(values: CategoryFormValues): CategoryInput {
  const description = values.description.trim();
  return {
    name: values.name.trim(),
    description: description === "" ? undefined : description,
  };
}
