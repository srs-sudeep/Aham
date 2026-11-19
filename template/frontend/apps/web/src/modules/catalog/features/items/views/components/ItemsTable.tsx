import { useMemo } from "react";
import { Button, Can, DataTable, formatMoney, usePreferences, useTranslation } from "@aham/ui-kit";
import type { ColumnDef } from "@aham/ui-kit";
import { useCategoryOptions } from "../../../../shared/hooks/use-category-options";
import type { Item } from "../../model/item.schema";
import { ItemStatusBadge } from "./ItemStatusBadge";

export function ItemsTable({
  items,
  isLoading,
  onOpen,
  onEdit,
  onDelete,
}: {
  items: Item[];
  isLoading?: boolean;
  onOpen: (item: Item) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  const { t } = useTranslation();
  const { locale, currency: preferredCurrency } = usePreferences();
  const categories = useCategoryOptions();

  const categoryLabels = useMemo(
    () => new Map((categories.data ?? []).map((option) => [option.value, option.label])),
    [categories.data],
  );

  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      {
        id: "name",
        header: t("items.columns.name"),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: "sku",
        header: t("items.columns.sku"),
        enableSorting: false,
        cell: ({ row }) => <span className="font-mono text-muted">{row.original.sku}</span>,
      },
      {
        id: "status",
        header: t("items.columns.status"),
        enableSorting: false,
        cell: ({ row }) => <ItemStatusBadge status={row.original.status} />,
      },
      {
        id: "category",
        header: t("items.columns.category"),
        enableSorting: false,
        cell: ({ row }) => {
          const id = row.original.categoryId;
          return id ? (categoryLabels.get(id) ?? id) : t("common.notAvailable");
        },
      },
      {
        id: "price",
        header: t("items.columns.price"),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.price === undefined
            ? t("common.notAvailable")
            : formatMoney(
                row.original.price,
                row.original.currency ?? preferredCurrency ?? "USD",
                locale,
              ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("items.columns.actions")}</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
            <Can permission="core-api.item:update">
              <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>
                {t("items.edit")}
              </Button>
            </Can>
            <Can permission="core-api.item:delete">
              <Button variant="ghost" size="sm" onClick={() => onDelete(row.original)}>
                {t("items.delete")}
              </Button>
            </Can>
          </div>
        ),
      },
    ],
    [t, categoryLabels, locale, preferredCurrency, onEdit, onDelete],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      isLoading={isLoading}
      getRowId={(item) => item.id}
      onRowClick={onOpen}
      emptyMessage={t("items.empty")}
    />
  );
}
