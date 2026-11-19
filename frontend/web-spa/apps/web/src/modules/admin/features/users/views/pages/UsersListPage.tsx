import { useMemo, useState } from "react";
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
import { useRoles } from "../../../roles";
import { useInviteUser, useUpdateUser } from "../../hooks/use-users-mutations";
import { useUsers } from "../../hooks/use-users";
import type { InviteFormValues, TenantUser } from "../../model/users.schema";
import { EditUserForm } from "../components/EditUserForm";
import { InviteUserForm } from "../components/InviteUserForm";
import { UsersTable } from "../components/UsersTable";

export function UsersListPage() {
  const { t } = useTranslation();
  const query = useUsers();
  const rolesQuery = useRoles();
  const inviteUser = useInviteUser();
  const updateUser = useUpdateUser();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TenantUser | null>(null);
  const [pendingToggle, setPendingToggle] = useState<TenantUser | null>(null);

  const roleOptions = useMemo(() => {
    const fromApi = (rolesQuery.data ?? []).map((role) => role.name);
    return fromApi.length > 0 ? fromApi : ["admin", "member", "viewer"];
  }, [rolesQuery.data]);

  async function submitInvite(values: InviteFormValues) {
    await inviteUser.mutateAsync(values);
    toast.success(t("users.toast.invited"));
    setInviteOpen(false);
  }

  async function submitEdit(values: { role: string }) {
    if (!editing) return;
    await updateUser.mutateAsync({ userId: editing.userId, input: { role: values.role } });
    toast.success(t("users.toast.updated"));
    setEditing(null);
  }

  async function confirmToggle() {
    if (!pendingToggle) return;
    const next =
      pendingToggle.membershipStatus === "active" ? ("disabled" as const) : ("active" as const);
    try {
      await updateUser.mutateAsync({
        userId: pendingToggle.userId,
        input: { membershipStatus: next },
      });
      toast.success(next === "disabled" ? t("users.toast.disabled") : t("users.toast.enabled"));
      setPendingToggle(null);
    } catch {
      // Global mutation toast already shown.
    }
  }

  return (
    <ListPage
      titleKey="users.title"
      description={t("users.description")}
      actions={
        <Can permission="identity.user:create">
          <Button onClick={() => setInviteOpen(true)}>{t("users.invite")}</Button>
        </Can>
      }
    >
      <QueryState
        query={query}
        emptyMessage={t("users.empty")}
        loading={<UsersTable rows={[]} isLoading onEdit={() => {}} onToggleStatus={() => {}} />}
      >
        {(rows) => <UsersTable rows={rows} onEdit={setEditing} onToggleStatus={setPendingToggle} />}
      </QueryState>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.inviteDialog.title")}</DialogTitle>
          </DialogHeader>
          <InviteUserForm
            roleOptions={roleOptions}
            submitting={inviteUser.isPending}
            onCancel={() => setInviteOpen(false)}
            onSubmit={submitInvite}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.editDialog.title")}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <EditUserForm
              user={editing}
              roleOptions={roleOptions}
              submitting={updateUser.isPending}
              onCancel={() => setEditing(null)}
              onSubmit={submitEdit}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => {
          if (!open) setPendingToggle(null);
        }}
        title={
          pendingToggle?.membershipStatus === "active"
            ? t("users.disableDialog.title")
            : t("users.enableDialog.title")
        }
        description={t(
          pendingToggle?.membershipStatus === "active"
            ? "users.disableDialog.description"
            : "users.enableDialog.description",
          { email: pendingToggle?.email ?? "" },
        )}
        confirmLabel={
          pendingToggle?.membershipStatus === "active" ? t("users.disable") : t("users.enable")
        }
        destructive={pendingToggle?.membershipStatus === "active"}
        loading={updateUser.isPending}
        onConfirm={confirmToggle}
      />
    </ListPage>
  );
}
