import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge, Button, DetailPage, QueryState, useTranslation } from "@aham/ui-kit";
import { usePermissionCatalog, useRole } from "../../hooks/use-roles";
import { useSetRolePermissions } from "../../hooks/use-roles-mutations";
import { RolePermissionsEditor } from "../components/RolePermissionsEditor";

export function RoleDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { roleId } = useParams({ strict: false }) as { roleId: string };
  const query = useRole(roleId);
  const catalogQuery = usePermissionCatalog();
  const setPermissions = useSetRolePermissions();

  return (
    <DetailPage
      title={query.data?.name ?? t("roles.detailTitle")}
      description={t("roles.detailDescription")}
      actions={
        <Button
          variant="outline"
          onClick={() => {
            void navigate({ to: "/admin/roles" });
          }}
        >
          {t("common.back")}
        </Button>
      }
    >
      <QueryState query={query} emptyMessage={t("roles.empty")}>
        {(role) => (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={role.isSystem ? "secondary" : "default"}>
                {role.isSystem ? t("roles.kind.system") : t("roles.kind.custom")}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {role.permissions.includes("*")
                  ? t("roles.allPermissions")
                  : t("roles.permissionCount", { count: role.permissions.length })}
              </span>
            </div>
            <RolePermissionsEditor
              role={role}
              catalog={catalogQuery.data ?? []}
              submitting={setPermissions.isPending}
              onSave={async (permissions) => {
                await setPermissions.mutateAsync({
                  roleId: role.id,
                  input: { permissions },
                });
                toast.success(t("roles.toast.permissionsUpdated"));
              }}
            />
          </div>
        )}
      </QueryState>
    </DetailPage>
  );
}
