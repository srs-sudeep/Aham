import { useMemo } from "react";
import { Controller } from "react-hook-form";
import {
  ApiError,
  Button,
  Form,
  FormActions,
  FormField,
  FormSection,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  mapServerErrors,
  useTranslation,
  useZodForm,
} from "@aham/ui-kit";
import { CategoryPicker } from "../../../../shared/components/CategoryPicker";
import { ITEM_CURRENCIES, ITEM_STATUSES } from "../../model/item.constants";
import { toFormErrorFields } from "../../model/item.mappers";
import { createItemFormSchema, type ItemFormValues } from "../../model/item.schema";

export function ItemForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitting = false,
}: {
  defaultValues: ItemFormValues;
  /** Reject (e.g. with `ApiError`) to surface server-side field errors on the form. */
  onSubmit: (values: ItemFormValues) => Promise<unknown> | unknown;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const { t } = useTranslation();
  const schema = useMemo(() => createItemFormSchema((key) => t(key)), [t]);
  const form = useZodForm(schema, { defaultValues });

  async function handleSubmit(values: ItemFormValues) {
    try {
      await onSubmit(values);
    } catch (error) {
      // ApiError toasts are handled globally; map field errors onto the inputs.
      if (error instanceof ApiError)
        mapServerErrors(toFormErrorFields(error.fields), form.setError);
    }
  }

  return (
    <Form form={form} onSubmit={handleSubmit}>
      <FormSection title={t("items.form.general")}>
        <FormField name="name" label={t("items.fields.name")} required>
          {(p) => (
            <Input
              id={p.id}
              aria-invalid={p["aria-invalid"]}
              aria-describedby={p["aria-describedby"]}
              {...p.field}
            />
          )}
        </FormField>
        <FormField name="sku" label={t("items.fields.sku")} required>
          {(p) => (
            <Input
              id={p.id}
              aria-invalid={p["aria-invalid"]}
              aria-describedby={p["aria-describedby"]}
              {...p.field}
            />
          )}
        </FormField>
        <FormField name="status" label={t("items.fields.status")}>
          {(p) => (
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={p.id} onBlur={field.onBlur}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`items.status.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <FormField name="categoryId" label={t("items.fields.category")}>
          {(p) => (
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <CategoryPicker
                  id={p.id}
                  value={field.value}
                  onChange={field.onChange}
                  invalid={p.invalid}
                  describedBy={p["aria-describedby"]}
                />
              )}
            />
          )}
        </FormField>
        <FormField
          name="description"
          label={t("items.fields.description")}
          className="sm:col-span-2"
        >
          {(p) => (
            <Textarea
              id={p.id}
              rows={4}
              aria-invalid={p["aria-invalid"]}
              aria-describedby={p["aria-describedby"]}
              {...p.field}
            />
          )}
        </FormField>
      </FormSection>

      <FormSection title={t("items.form.pricing")}>
        <FormField name="price" label={t("items.fields.price")}>
          {(p) => (
            <Input
              id={p.id}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              aria-invalid={p["aria-invalid"]}
              aria-describedby={p["aria-describedby"]}
              {...p.field}
            />
          )}
        </FormField>
        <FormField name="currency" label={t("items.fields.currency")}>
          {(p) => (
            <Controller
              control={form.control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={p.id} onBlur={field.onBlur}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
      </FormSection>

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {t("items.form.cancel")}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t("items.form.saving") : t("items.form.save")}
        </Button>
      </FormActions>
    </Form>
  );
}
