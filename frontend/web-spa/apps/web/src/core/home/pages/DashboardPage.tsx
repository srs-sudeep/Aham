import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Page,
  PageHeader,
  Text,
  buildNavGroups,
  useAuth,
  useTranslation,
} from "@aham/ui-kit";
import { registeredModules } from "../../../app/registry";

export function DashboardPage() {
  const { t } = useTranslation();
  const { can, principal } = useAuth();
  const navigate = useNavigate();
  const groups = useMemo(() => buildNavGroups(registeredModules), []);

  const visible = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) }))
    .filter((group) => group.items.length > 0);

  const name = principal?.name || principal?.email || "";

  return (
    <Page>
      <PageHeader
        title={t("home.title")}
        description={name ? t("home.welcome", { name }) : t("home.subtitle")}
      />
      <Text variant="label">{t("home.quickLinks")}</Text>
      {visible.length === 0 ? (
        <EmptyState message={t("home.empty")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle>{t(group.labelKey)}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <Button
                    key={item.to}
                    variant="outline"
                    className="justify-start"
                    onClick={() => {
                      void navigate({ to: item.to });
                    }}
                  >
                    {t(item.labelKey)}
                  </Button>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
