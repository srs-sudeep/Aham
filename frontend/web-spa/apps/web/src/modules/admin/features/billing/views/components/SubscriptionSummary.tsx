import { Badge, useTranslation } from "@aham/ui-kit";
import type { Subscription } from "../../model/billing.schema";

export function SubscriptionSummary({ subscription }: { subscription: Subscription }) {
  const { t } = useTranslation();
  const periodEnd = new Date(subscription.periodEnd);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-medium">{t("billing.subscriptionTitle")}</h2>
        <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
          {subscription.status}
        </Badge>
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t("billing.fields.plan")}</dt>
          <dd className="font-medium">{subscription.planCode}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("billing.fields.periodEnd")}</dt>
          <dd className="font-medium">
            {Number.isNaN(periodEnd.getTime())
              ? subscription.periodEnd
              : periodEnd.toLocaleDateString()}
          </dd>
        </div>
      </dl>
    </div>
  );
}
