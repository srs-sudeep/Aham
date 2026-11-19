import { useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Button,
  Can,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FilterBar,
  Input,
  Label,
  ListPage,
  QueryState,
  useTranslation,
} from "@aham/ui-kit";
import { useCategories } from "../../hooks/use-categories";
import { useCreateCategory, useDeleteCategory } from "../../hooks/use-category-mutations";
import {
  categoriesSearchSchema,
  emptyCategoryFormValues,
  formValuesToCategoryInput,
  type Category,
  type CategoryFormValues,
} from "../../model/category.schema";
import { CategoriesTable } from "../components/CategoriesTable";
import { CategoryForm } from "../components/CategoryForm";

export function CategoriesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  const search = useMemo(() => categoriesSearchSchema.parse(rawSearch), [rawSearch]);

  const query = useCategories(search);
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [draftQuery, setDraftQuery] = useState(search.q ?? "");

  function updateSearch(q: string | undefined) {
    void navigate({ to: "/catalog/categories", search: { q } });
  }

  function openCategory(category: Category) {
    void navigate({
      to: "/catalog/categories/$categoryId",
      params: { categoryId: category.id },
    });
  }

  async function submitCreate(values: CategoryFormValues) {
    await createCategory.mutateAsync(formValuesToCategoryInput(values));
    toast.success(t("categories.toast.created"));
    setCreateOpen(false);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteCategory.mutateAsync(pendingDelete.id);
      toast.success(t("categories.toast.deleted"));
      setPendingDelete(null);
    } catch {
      // The query client's default mutation handler already shows an error toast.
    }
  }

  return (
    <ListPage
      titleKey="categories.title"
      description={t("categories.description")}
      actions={
        <Can permission="categories:create">
          <Button onClick={() => setCreateOpen(true)}>{t("categories.new")}</Button>
        </Can>
      }
      filters={
        <FilterBar
          actions={
            <Button
              variant="ghost"
              onClick={() => {
                setDraftQuery("");
                updateSearch(undefined);
              }}
            >
              {t("categories.filters.reset")}
            </Button>
          }
        >
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              updateSearch(draftQuery.trim() || undefined);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="categories-filter-q">{t("categories.filters.search")}</Label>
              <Input
                id="categories-filter-q"
                className="w-64"
                value={draftQuery}
                placeholder={t("categories.filters.searchPlaceholder")}
                onChange={(event) => setDraftQuery(event.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">
              {t("categories.filters.apply")}
            </Button>
          </form>
        </FilterBar>
      }
    >
      <QueryState
        query={query}
        isEmpty={() => false}
        loading={
          <CategoriesTable
            categories={[]}
            isLoading
            onOpen={openCategory}
            onDelete={setPendingDelete}
          />
        }
      >
        {(data) => (
          <CategoriesTable
            categories={data.items}
            onOpen={openCategory}
            onDelete={setPendingDelete}
          />
        )}
      </QueryState>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("categories.form.createTitle")}</DialogTitle>
          </DialogHeader>
          <CategoryForm
            defaultValues={emptyCategoryFormValues}
            onSubmit={submitCreate}
            onCancel={() => setCreateOpen(false)}
            submitting={createCategory.isPending}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("categories.deleteDialog.title")}
        description={t("categories.deleteDialog.description", { name: pendingDelete?.name ?? "" })}
        confirmLabel={t("categories.delete")}
        destructive
        loading={deleteCategory.isPending}
        onConfirm={confirmDelete}
      />
    </ListPage>
  );
}
