import { PageHeader, Text } from "@aham/ui-kit/components";
import { useTranslation } from "@aham/ui-kit";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="p-[var(--space-page)]">
      <PageHeader title={t("notFound.title")} />
      <Text variant="muted">{t("notFound.body")}</Text>
    </div>
  );
}
