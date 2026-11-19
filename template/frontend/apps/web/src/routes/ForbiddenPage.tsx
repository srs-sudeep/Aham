import { PageHeader, Text } from "@aham/ui-kit/components";
import { useTranslation } from "@aham/ui-kit";

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <div className="p-[var(--space-page)]">
      <PageHeader title={t("forbidden.title")} />
      <Text variant="muted">{t("forbidden.body")}</Text>
    </div>
  );
}
