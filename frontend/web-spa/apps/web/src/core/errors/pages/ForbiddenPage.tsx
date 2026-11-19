import { Link } from "@tanstack/react-router";
import { Button, Page, PageHeader, Text, useTranslation } from "@aham/ui-kit";

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <Page className="p-[var(--space-page)]">
      <PageHeader title={t("forbidden.title")} />
      <Text variant="muted">{t("forbidden.body")}</Text>
      <Button asChild variant="outline">
        <Link to="/">{t("forbidden.action")}</Link>
      </Button>
    </Page>
  );
}
