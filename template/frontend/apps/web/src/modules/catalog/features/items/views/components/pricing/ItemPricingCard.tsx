import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
  formatMoney,
  usePreferences,
  useTranslation,
} from "@aham/ui-kit";
import type { Item } from "../../../model/item.schema";

export function ItemPricingCard({ item }: { item: Pick<Item, "price" | "currency"> }) {
  const { t } = useTranslation();
  const { locale, currency: preferredCurrency } = usePreferences();
  const hasPrice = item.price !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("items.pricing.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <Text variant="muted">{t("items.pricing.price")}</Text>
        {hasPrice ? (
          <p className="text-h2 font-semibold">
            {formatMoney(item.price, item.currency ?? preferredCurrency ?? "USD", locale)}
          </p>
        ) : (
          <Text variant="muted">{t("items.pricing.none")}</Text>
        )}
      </CardContent>
    </Card>
  );
}
