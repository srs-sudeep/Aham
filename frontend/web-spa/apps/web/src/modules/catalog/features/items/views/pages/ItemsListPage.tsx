import { useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Button,
  Can,
  ConfirmDialog,
  FilterBar,
  Input,
  Label,
  ListPage,
  Pagination,
  QueryState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useTranslation,
} from "@aham/ui-kit";
import { useDeleteItem } from "../../hooks/use-item-mutations";
import { useItems } from "../../hooks/use-items";
import { ITEM_STATUSES } from "../../model/item.constants";
import { itemsSearchSchema, type Item, type ItemStatus } from "../../model/item.schema";
import { ItemsTable } from "../components/ItemsTable";

const ALL = "__all__";

export function ItemsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  // Route-level validateSearch already normalizes this; parse again for safe defaults.
  const search = useMemo(() => itemsSearchSchema.parse(rawSearch), [rawSearch]);

  const query = useItems(search);
  const deleteItem = useDeleteItem();
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const [draftQuery, setDraftQuery] = useState(search.q ?? "");

  function updateSearch(patch: Partial<typeof search>) {
    void navigate({
      to: "/catalog/items",
      search: { ...search, ...patch },
    });
  }

  function openItem(item: Item) {
    void navigate({ to: "/catalog/items/$itemId", params: { itemId: item.id } });
  }

  function editItem(item: Item) {
    void navigate({ to: "/catalog/items/$itemId/edit", params: { itemId: item.id } });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteItem.mutateAsync(pendingDelete.id);
      toast.success(t("items.toast.deleted"));
      setPendingDelete(null);
    } catch {
      // The query client's default mutation handler already shows an error toast.
    }
  }

  return (
    <ListPage
      titleKey="items.title"
      description={t("items.description")}
      actions={
        <Can permission="items:create">
          <Button
            onClick={() => {
              void navigate({ to: "/catalog/items/new" });
            }}
          >
            {t("items.new")}
          </Button>
        </Can>
      }
      filters={
        <FilterBar
          actions={
            <Button
              variant="ghost"
              onClick={() => {
                setDraftQuery("");
                updateSearch({ q: undefined, status: undefined, page: 1 });
              }}
            >
              {t("items.filters.reset")}
            </Button>
          }
        >
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              updateSearch({ q: draftQuery.trim() || undefined, page: 1 });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="items-filter-q">{t("items.filters.search")}</Label>
              <Input
                id="items-filter-q"
                className="w-64"
                value={draftQuery}
                placeholder={t("items.filters.searchPlaceholder")}
                onChange={(event) => setDraftQuery(event.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              {t("items.filters.apply")}
            </Button>
          </form>
          <div className="space-y-2">
            <Label htmlFor="items-filter-status">{t("items.filters.status")}</Label>
            <Select
              value={search.status ?? ALL}
              onValueChange={(value) =>
                updateSearch({ status: value === ALL ? undefined : (value as ItemStatus), page: 1 })
              }
            >
              <SelectTrigger id="items-filter-status" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("items.filters.allStatuses")}</SelectItem>
                {ITEM_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`items.status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterBar>
      }
    >
      <QueryState
        query={query}
        isEmpty={() => false}
        loading={
          <ItemsTable
            items={[]}
            isLoading
            onOpen={openItem}
            onEdit={editItem}
            onDelete={setPendingDelete}
          />
        }
      >
        {(data) => (
          <>
            <ItemsTable
              items={data.items}
              onOpen={openItem}
              onEdit={editItem}
              onDelete={setPendingDelete}
            />
            <Pagination
              page={search.page}
              pageSize={search.pageSize}
              total={data.total}
              onChange={({ page, pageSize }) => updateSearch({ page, pageSize })}
            />
          </>
        )}
      </QueryState>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("items.deleteDialog.title")}
        description={t("items.deleteDialog.description", { name: pendingDelete?.name ?? "" })}
        confirmLabel={t("items.delete")}
        destructive
        loading={deleteItem.isPending}
        onConfirm={confirmDelete}
      />
    </ListPage>
  );
}
