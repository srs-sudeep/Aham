import { useMemo } from "react";
import { Badge, Button, Can, DataTable, useTranslation } from "@aham/ui-kit";
import type { ColumnDef } from "@aham/ui-kit";
import type { Role } from "../../model/roles.schema";

export function RolesTable({
  rows,
  isLoading,
  onOpen,
  onDelete,
}: {
  rows: Role[];
  isLoading?: boolean;
  onOpen: (role: Role) => void;
  onDelete: (role: Role) => void;
}) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      {
        id: "name",
        header: t("roles.columns.name"),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: "kind",
        header: t("roles.columns.kind"),
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={row.original.isSystem ? "secondary" : "default"}>
            {row.original.isSystem ? t("roles.kind.system") : t("roles.kind.custom")}
          </Badge>
        ),
      },
      {
        id: "permissions",
        header: t("roles.columns.permissions"),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.permissions.includes("*")
            ? t("roles.allPermissions")
            : t("roles.permissionCount", { count: row.original.permissions.length }),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("roles.columns.actions")}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => onOpen(row.original)}>
              {t("common.view")}
            </Button>
            {!row.original.isSystem ? (
              <Can permission="identity.role:delete">
                <Button variant="ghost" size="sm" onClick={() => onDelete(row.original)}>
                  {t("roles.delete")}
                </Button>
              </Can>
            ) : null}
          </div>
        ),
      },
    ],
    [t, onOpen, onDelete],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      getRowId={(row) => row.id}
      onRowClick={onOpen}
      emptyMessage={t("roles.empty")}
    />
  );
}
