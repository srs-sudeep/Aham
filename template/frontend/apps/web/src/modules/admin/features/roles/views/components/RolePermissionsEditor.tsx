import { useEffect, useState } from "react";
import { Button, Checkbox, Label, useTranslation } from "@aham/ui-kit";
import type { PermissionCatalogEntry, Role } from "../../model/roles.schema";

export function RolePermissionsEditor({
  role,
  catalog,
  onSave,
  submitting = false,
}: {
  role: Role;
  catalog: PermissionCatalogEntry[];
  onSave: (permissions: string[]) => Promise<unknown> | unknown;
  submitting?: boolean;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(role.permissions);

  useEffect(() => {
    setSelected(role.permissions);
  }, [role.permissions]);

  function toggle(code: string, checked: boolean) {
    setSelected((prev) =>
      checked ? [...new Set([...prev, code])] : prev.filter((p) => p !== code),
    );
  }

  if (role.isSystem) {
    return <p className="text-sm text-muted-foreground">{t("roles.systemImmutable")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("roles.fields.permissions")}</Label>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3">
          {catalog.map((entry) => (
            <label key={entry.code} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={selected.includes(entry.code)}
                onCheckedChange={(value) => toggle(entry.code, value === true)}
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
      <Button
        disabled={submitting}
        onClick={() => {
          void onSave(selected);
        }}
      >
        {submitting ? t("roles.form.saving") : t("roles.form.savePermissions")}
      </Button>
    </div>
  );
}
