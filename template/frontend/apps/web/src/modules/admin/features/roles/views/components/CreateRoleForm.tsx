import { useMemo } from "react";
import {
  ApiError,
  Button,
  Checkbox,
  Form,
  FormActions,
  FormField,
  Input,
  Label,
  mapServerErrors,
  useTranslation,
  useZodForm,
} from "@aham/ui-kit";
import {
  createRoleFormSchema,
  type CreateRoleFormValues,
  type PermissionCatalogEntry,
} from "../../model/roles.schema";

export function CreateRoleForm({
  catalog,
  onSubmit,
  onCancel,
  submitting = false,
}: {
  catalog: PermissionCatalogEntry[];
  onSubmit: (values: CreateRoleFormValues) => Promise<unknown> | unknown;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const { t } = useTranslation();
  const schema = useMemo(() => createRoleFormSchema, []);
  const form = useZodForm(schema, { defaultValues: { name: "", permissions: [] } });
  const selected = form.watch("permissions") ?? [];

  function togglePermission(code: string, checked: boolean) {
    const next = checked ? [...new Set([...selected, code])] : selected.filter((p) => p !== code);
    form.setValue("permissions", next, { shouldDirty: true });
  }

  async function handleSubmit(values: CreateRoleFormValues) {
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof ApiError) mapServerErrors(error.fields, form.setError);
    }
  }

  return (
    <Form form={form} onSubmit={handleSubmit}>
      <FormField name="name" label={t("roles.fields.name")} required>
        {(p) => (
          <Input
            id={p.id}
            placeholder={t("roles.fields.namePlaceholder")}
            aria-invalid={p["aria-invalid"]}
            aria-describedby={p["aria-describedby"]}
            {...p.field}
          />
        )}
      </FormField>
      <div className="space-y-2">
        <Label>{t("roles.fields.permissions")}</Label>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
          {catalog.map((entry) => (
            <label key={entry.code} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={selected.includes(entry.code)}
                onCheckedChange={(value) => togglePermission(entry.code, value === true)}
              />
              <span>
                <span className="font-medium">{entry.code}</span>
                {entry.description ? (
                  <span className="block text-muted-foreground">{entry.description}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </div>
      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {t("roles.form.cancel")}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t("roles.form.saving") : t("roles.form.create")}
        </Button>
      </FormActions>
    </Form>
  );
}
