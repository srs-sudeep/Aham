import { useMemo } from "react";
import {
  ApiError,
  Button,
  Form,
  FormActions,
  FormField,
  Input,
  Textarea,
  mapServerErrors,
  useTranslation,
  useZodForm,
} from "@aham/ui-kit";
import { createCategoryFormSchema, type CategoryFormValues } from "../../model/category.schema";

export function CategoryForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitting = false,
}: {
  defaultValues: CategoryFormValues;
  /** Reject (e.g. with `ApiError`) to surface server-side field errors on the form. */
  onSubmit: (values: CategoryFormValues) => Promise<unknown> | unknown;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const { t } = useTranslation();
  const schema = useMemo(() => createCategoryFormSchema((key) => t(key)), [t]);
  const form = useZodForm(schema, { defaultValues });

  async function handleSubmit(values: CategoryFormValues) {
    try {
      await onSubmit(values);
    } catch (error) {
      // ApiError toasts are handled globally; map field errors onto the inputs.
      if (error instanceof ApiError) mapServerErrors(error.fields, form.setError);
    }
  }

  return (
    <Form form={form} onSubmit={handleSubmit}>
      <FormField name="name" label={t("categories.fields.name")} required>
        {(p) => (
          <Input
            id={p.id}
            aria-invalid={p["aria-invalid"]}
            aria-describedby={p["aria-describedby"]}
            {...p.field}
          />
        )}
      </FormField>
      <FormField name="description" label={t("categories.fields.description")}>
        {(p) => (
          <Textarea
            id={p.id}
            rows={3}
            aria-invalid={p["aria-invalid"]}
            aria-describedby={p["aria-describedby"]}
            {...p.field}
          />
        )}
      </FormField>
      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {t("categories.form.cancel")}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t("categories.form.saving") : t("categories.form.save")}
        </Button>
      </FormActions>
    </Form>
  );
}
