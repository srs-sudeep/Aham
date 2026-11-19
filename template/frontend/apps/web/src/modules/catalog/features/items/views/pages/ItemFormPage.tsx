import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button, FormPage, QueryState, useTranslation } from "@aham/ui-kit";
import { useCreateItem, useUpdateItem } from "../../hooks/use-item-mutations";
import { useItem } from "../../hooks/use-items";
import { emptyItemFormValues, formValuesToInput, itemToFormValues } from "../../model/item.mappers";
import type { ItemFormValues } from "../../model/item.schema";
import { ItemForm } from "../components/ItemForm";

/** Serves both `/catalog/items/new` and `/catalog/items/$itemId/edit`. */
export function ItemFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { itemId } = useParams({ strict: false }) as { itemId?: string };
  const isEdit = Boolean(itemId);

  const query = useItem(itemId);
  const createItem = useCreateItem();
  const updateItem = useUpdateItem(itemId ?? "");

  function goToList() {
    void navigate({ to: "/catalog/items" });
  }

  async function submit(values: ItemFormValues) {
    const input = formValuesToInput(values);
    if (itemId) {
      await updateItem.mutateAsync(input);
      toast.success(t("items.toast.updated"));
      void navigate({ to: "/catalog/items/$itemId", params: { itemId } });
      return;
    }
    const created = await createItem.mutateAsync(input);
    toast.success(t("items.toast.created"));
    void navigate({ to: "/catalog/items/$itemId", params: { itemId: created.id } });
  }

  const submitting = createItem.isPending || updateItem.isPending;

  return (
    <FormPage
      title={isEdit ? t("items.form.editTitle") : t("items.form.createTitle")}
      description={isEdit ? t("items.form.editDescription") : t("items.form.createDescription")}
      breadcrumbs={[
        { label: t("catalog.title") },
        { label: t("items.title"), to: "/catalog/items" },
        { label: isEdit ? t("items.form.editTitle") : t("items.form.createTitle") },
      ]}
      onNavigate={(to) => {
        void navigate({ to });
      }}
      actions={
        <Button variant="outline" onClick={goToList}>
          {t("items.back")}
        </Button>
      }
    >
      {isEdit ? (
        <QueryState query={query}>
          {(item) => (
            <ItemForm
              defaultValues={itemToFormValues(item)}
              onSubmit={submit}
              onCancel={goToList}
              submitting={submitting}
            />
          )}
        </QueryState>
      ) : (
        <ItemForm
          defaultValues={emptyItemFormValues}
          onSubmit={submit}
          onCancel={goToList}
          submitting={submitting}
        />
      )}
    </FormPage>
  );
}
