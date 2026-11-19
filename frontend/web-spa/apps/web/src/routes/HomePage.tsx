import { PageHeader, Card, CardContent, Text } from "@aham/ui-kit/components";
import { useTranslation } from "@aham/ui-kit";

export function HomePage() {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t("home.title")} description={t("home.subtitle")} />
      <Card>
        <CardContent className="pt-6">
          <Text>{t("home.body")}</Text>
        </CardContent>
      </Card>
    </div>
  );
}
