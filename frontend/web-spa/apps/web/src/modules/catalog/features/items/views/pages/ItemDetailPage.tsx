import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Button,
  Can,
  Card,
  CardContent,
  ConfirmDialog,
  DetailPage,
  QueryState,
  Text,
  useTranslation,
} from "@aham/ui-kit";
import { useCategoryOptions } from "../../../../shared/hooks/use-category-options";
import { useDeleteItem } from "../../hooks/use-item-mutations";
import { useItem } from "../../hooks/use-items";
import { ItemPricingCard } from "../components/pricing/ItemPricingCard";
import { ItemStatusBadge } from "../components/ItemStatusBadge";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Text variant="muted">{label}</Text>
      <div className="text-body">{children}</div>
    </div>
  );
}

export function ItemDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { itemId } = useParams({ strict: false }) as { itemId?: string };
  const query = useItem(itemId);
  const categories = useCategoryOptions();
  const deleteItem = useDeleteItem();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const item = query.data;
  const categoryLabel = item?.categoryId
    ? (categories.data?.find((c) => c.value === item.categoryId)?.label ?? item.categoryId)
    : t("common.notAvailable");

  function goToList() {
    void navigate({ to: "/catalog/items" });
  }

  async function confirmDelete() {
    if (!itemId) return;
    try {
      await deleteItem.mutateAsync(itemId);
      toast.success(t("items.toast.deleted"));
      goToList();
    } catch {
      // The query client's default mutation handler already shows an error toast.
    }
  }

  return (
    <>
      <DetailPage
        title={item?.name ?? t("items.detail")}
        description={item?.sku}
        breadcrumbs={[
          { label: t("catalog.title") },
          { label: t("items.title"), to: "/catalog/items" },
          { label: item?.name ?? t("items.detail") },
        ]}
        onNavigate={(to) => {
          void navigate({ to });
        }}
        actions={
          <>
            <Button variant="outline" onClick={goToList}>
              {t("items.back")}
            </Button>
            {item ? (
              <>
                <Can permission="core-api.item:update">
                  <Button
                    onClick={() => {
                      void navigate({
                        to: "/catalog/items/$itemId/edit",
                        params: { itemId: item.id },
                      });
                    }}
                  >
                    {t("items.edit")}
                  </Button>
                </Can>
                <Can permission="core-api.item:delete">
                  <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                    {t("items.delete")}
                  </Button>
                </Can>
              </>
            ) : null}
          </>
        }
        overview={
          <QueryState query={query}>
            {(data) => (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                    <Field label={t("items.fields.name")}>{data.name}</Field>
                    <Field label={t("items.fields.sku")}>
                      <span className="font-mono">{data.sku}</span>
                    </Field>
                    <Field label={t("items.fields.status")}>
                      <ItemStatusBadge status={data.status} />
                    </Field>
                    <Field label={t("items.fields.category")}>{categoryLabel}</Field>
                    <div className="sm:col-span-2">
                      <Field label={t("items.fields.description")}>
                        {data.description ?? t("common.notAvailable")}
                      </Field>
                    </div>
                  </CardContent>
                </Card>
                <ItemPricingCard item={data} />
              </div>
            )}
          </QueryState>
        }
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("items.deleteDialog.title")}
        description={t("items.deleteDialog.description", { name: item?.name ?? "" })}
        confirmLabel={t("items.delete")}
        destructive
        loading={deleteItem.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
