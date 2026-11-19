import { useMemo } from "react";
import { Controller } from "react-hook-form";
import {
  ApiError,
  Button,
  Form,
  FormActions,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  mapServerErrors,
  useTranslation,
  useZodForm,
} from "@aham/ui-kit";
import { inviteFormSchema, type InviteFormValues } from "../../model/users.schema";

export function InviteUserForm({
  roleOptions,
  onSubmit,
  onCancel,
  submitting = false,
}: {
  roleOptions: string[];
  onSubmit: (values: InviteFormValues) => Promise<unknown> | unknown;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const { t } = useTranslation();
  const schema = useMemo(() => inviteFormSchema, []);
  const form = useZodForm(schema, {
    defaultValues: { email: "", role: roleOptions[0] ?? "member" },
  });

  async function handleSubmit(values: InviteFormValues) {
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof ApiError) mapServerErrors(error.fields, form.setError);
    }
  }

  return (
    <Form form={form} onSubmit={handleSubmit}>
      <FormField name="email" label={t("users.fields.email")} required>
        {(p) => (
          <Input
            id={p.id}
            type="email"
            aria-invalid={p["aria-invalid"]}
            aria-describedby={p["aria-describedby"]}
            {...p.field}
          />
        )}
      </FormField>
      <FormField name="role" label={t("users.fields.role")} required>
        {(p) => (
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={p.id} onBlur={field.onBlur} aria-invalid={p["aria-invalid"]}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FormField>
      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          {t("users.form.cancel")}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t("users.form.sending") : t("users.form.invite")}
        </Button>
      </FormActions>
    </Form>
  );
}
