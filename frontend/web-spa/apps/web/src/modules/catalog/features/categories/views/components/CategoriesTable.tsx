import { useMemo } from "react";
import { Button, Can, DataTable, useTranslation } from "@aham/ui-kit";
import type { ColumnDef } from "@aham/ui-kit";
import type { Category } from "../../model/category.schema";

export function CategoriesTable({
  categories,
  isLoading,
  onOpen,
  onDelete,
}: {
  categories: Category[];
  isLoading?: boolean;
  onOpen: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<Category>[]>(
    () => [
      {
        id: "name",
        header: t("categories.columns.name"),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: "description",
        header: t("categories.columns.description"),
        enableSorting: false,
        cell: ({ row }) => row.original.description ?? t("common.notAvailable"),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("categories.columns.actions")}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => onOpen(row.original)}>
              {t("common.view")}
            </Button>
            <Can permission="core-api.category:delete">
              <Button variant="ghost" size="sm" onClick={() => onDelete(row.original)}>
                {t("categories.delete")}
              </Button>
            </Can>
          </div>
        ),
      },
    ],
    [t, onOpen, onDelete],
  );

  return (
    <DataTable
      columns={columns}
      data={categories}
      isLoading={isLoading}
      getRowId={(category) => category.id}
      onRowClick={onOpen}
      emptyMessage={t("categories.empty")}
    />
  );
}
