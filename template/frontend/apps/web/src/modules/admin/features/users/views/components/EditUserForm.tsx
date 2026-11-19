import { useMemo } from "react";
import { Controller } from "react-hook-form";
import {
  Button,
  Form,
  FormActions,
  FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useTranslation,
  useZodForm,
} from "@aham/ui-kit";
import { z } from "zod";
import type { TenantUser } from "../../model/users.schema";

const editSchema = z.object({
  role: z.string().min(1),
});

type EditValues = z.infer<typeof editSchema>;

export function EditUserForm({
  user,
  roleOptions,
  onSubmit,
  onCancel,
  submitting = false,
}: {
  user: TenantUser;
  roleOptions: string[];
  onSubmit: (values: EditValues) => Promise<unknown> | unknown;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const { t } = useTranslation();
  const schema = useMemo(() => editSchema, []);
  const form = useZodForm(schema, { defaultValues: { role: user.role } });

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormField name="role" label={t("users.fields.role")} required>
        {(p) => (
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={p.id} onBlur={field.onBlur}>
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
          {submitting ? t("users.form.saving") : t("users.form.save")}
        </Button>
      </FormActions>
    </Form>
  );
}
