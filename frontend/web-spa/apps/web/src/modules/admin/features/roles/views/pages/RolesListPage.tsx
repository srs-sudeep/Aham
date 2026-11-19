import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Button,
  Can,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ListPage,
  QueryState,
  useTranslation,
} from "@aham/ui-kit";
import { usePermissionCatalog, useRoles } from "../../hooks/use-roles";
import { useCreateRole, useDeleteRole } from "../../hooks/use-roles-mutations";
import type { CreateRoleFormValues, Role } from "../../model/roles.schema";
import { CreateRoleForm } from "../components/CreateRoleForm";
import { RolesTable } from "../components/RolesTable";

export function RolesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useRoles();
  const catalogQuery = usePermissionCatalog();
  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null);

  function openRole(role: Role) {
    void navigate({ to: "/admin/roles/$roleId", params: { roleId: role.id } });
  }

  async function submitCreate(values: CreateRoleFormValues) {
    await createRole.mutateAsync(values);
    toast.success(t("roles.toast.created"));
    setCreateOpen(false);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteRole.mutateAsync(pendingDelete.id);
      toast.success(t("roles.toast.deleted"));
      setPendingDelete(null);
    } catch {
      // Global mutation toast already shown.
    }
  }

  return (
    <ListPage
      titleKey="roles.title"
      description={t("roles.description")}
      actions={
        <Can permission="identity.role:create">
          <Button onClick={() => setCreateOpen(true)}>{t("roles.new")}</Button>
        </Can>
      }
    >
      <QueryState
        query={query}
        emptyMessage={t("roles.empty")}
        loading={<RolesTable rows={[]} isLoading onOpen={() => {}} onDelete={() => {}} />}
      >
        {(rows) => <RolesTable rows={rows} onOpen={openRole} onDelete={setPendingDelete} />}
      </QueryState>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("roles.createDialog.title")}</DialogTitle>
          </DialogHeader>
          <CreateRoleForm
            catalog={catalogQuery.data ?? []}
            submitting={createRole.isPending}
            onCancel={() => setCreateOpen(false)}
            onSubmit={submitCreate}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("roles.deleteDialog.title")}
        description={t("roles.deleteDialog.description", {
          name: pendingDelete?.name ?? "",
        })}
        confirmLabel={t("roles.delete")}
        destructive
        loading={deleteRole.isPending}
        onConfirm={confirmDelete}
      />
    </ListPage>
  );
}
