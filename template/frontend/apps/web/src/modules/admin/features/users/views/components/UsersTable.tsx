import { useMemo } from "react";
import { Badge, Button, Can, DataTable, useTranslation } from "@aham/ui-kit";
import type { ColumnDef } from "@aham/ui-kit";
import type { TenantUser } from "../../model/users.schema";

export function UsersTable({
  rows,
  isLoading,
  onEdit,
  onToggleStatus,
}: {
  rows: TenantUser[];
  isLoading?: boolean;
  onEdit: (user: TenantUser) => void;
  onToggleStatus: (user: TenantUser) => void;
}) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<TenantUser>[]>(
    () => [
      {
        id: "email",
        header: t("users.columns.email"),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.email}</span>,
      },
      {
        id: "role",
        header: t("users.columns.role"),
        enableSorting: false,
        cell: ({ row }) => row.original.role,
      },
      {
        id: "membershipStatus",
        header: t("users.columns.membershipStatus"),
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={row.original.membershipStatus === "active" ? "default" : "secondary"}>
            {t(`users.membershipStatus.${row.original.membershipStatus}`, {
              defaultValue: row.original.membershipStatus,
            })}
          </Badge>
        ),
      },
      {
        id: "status",
        header: t("users.columns.status"),
        enableSorting: false,
        cell: ({ row }) => row.original.status,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("users.columns.actions")}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
            <Can permission="identity.user:update">
              <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>
                {t("users.edit")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onToggleStatus(row.original)}>
                {row.original.membershipStatus === "active"
                  ? t("users.disable")
                  : t("users.enable")}
              </Button>
            </Can>
          </div>
        ),
      },
    ],
    [t, onEdit, onToggleStatus],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      getRowId={(row) => row.userId}
      emptyMessage={t("users.empty")}
    />
  );
}
