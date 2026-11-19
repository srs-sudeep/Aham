import { Link } from "@tanstack/react-router";
import { Button, Page, PageHeader, Text, useTranslation } from "@aham/ui-kit";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Page className="p-[var(--space-page)]">
      <PageHeader title={t("notFound.title")} />
      <Text variant="muted">{t("notFound.body")}</Text>
      <Button asChild variant="outline">
        <Link to="/">{t("notFound.action")}</Link>
      </Button>
    </Page>
  );
}
