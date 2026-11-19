import { useState } from "react";
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
import { useCategory } from "../../hooks/use-categories";
import { useDeleteCategory, useUpdateCategory } from "../../hooks/use-category-mutations";
import {
  categoryToFormValues,
  formValuesToCategoryInput,
  type CategoryFormValues,
} from "../../model/category.schema";
import { CategoryForm } from "../components/CategoryForm";

export function CategoryDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { categoryId } = useParams({ strict: false }) as { categoryId?: string };
  const query = useCategory(categoryId);
  const updateCategory = useUpdateCategory(categoryId ?? "");
  const deleteCategory = useDeleteCategory();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const category = query.data;

  function goToList() {
    void navigate({ to: "/catalog/categories" });
  }

  async function submitUpdate(values: CategoryFormValues) {
    await updateCategory.mutateAsync(formValuesToCategoryInput(values));
    toast.success(t("categories.toast.updated"));
    setEditing(false);
  }

  async function confirmDelete() {
    if (!categoryId) return;
    try {
      await deleteCategory.mutateAsync(categoryId);
      toast.success(t("categories.toast.deleted"));
      goToList();
    } catch {
      // The query client's default mutation handler already shows an error toast.
    }
  }

  return (
    <>
      <DetailPage
        title={category?.name ?? t("categories.detail")}
        breadcrumbs={[
          { label: t("catalog.title") },
          { label: t("categories.title"), to: "/catalog/categories" },
          { label: category?.name ?? t("categories.detail") },
        ]}
        onNavigate={(to) => {
          void navigate({ to });
        }}
        actions={
          <>
            <Button variant="outline" onClick={goToList}>
              {t("categories.back")}
            </Button>
            {category && !editing ? (
              <>
                <Can permission="core-api.category:update">
                  <Button onClick={() => setEditing(true)}>{t("categories.edit")}</Button>
                </Can>
                <Can permission="core-api.category:delete">
                  <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                    {t("categories.delete")}
                  </Button>
                </Can>
              </>
            ) : null}
          </>
        }
        overview={
          <QueryState query={query}>
            {(data) => (
              <Card className="max-w-3xl">
                <CardContent className="pt-6">
                  {editing ? (
                    <CategoryForm
                      defaultValues={categoryToFormValues(data)}
                      onSubmit={submitUpdate}
                      onCancel={() => setEditing(false)}
                      submitting={updateCategory.isPending}
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Text variant="muted">{t("categories.fields.name")}</Text>
                        <div className="text-body">{data.name}</div>
                      </div>
                      <div className="space-y-1">
                        <Text variant="muted">{t("categories.fields.description")}</Text>
                        <div className="text-body">
                          {data.description ?? t("common.notAvailable")}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </QueryState>
        }
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("categories.deleteDialog.title")}
        description={t("categories.deleteDialog.description", { name: category?.name ?? "" })}
        confirmLabel={t("categories.delete")}
        destructive
        loading={deleteCategory.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
