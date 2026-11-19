import { Button, Can, useTranslation } from "@aham/ui-kit";
import type { Plan, Subscription } from "../../model/billing.schema";

export function PlansList({
  plans,
  subscription,
  checkingOut,
  onCheckout,
}: {
  plans: Plan[];
  subscription: Subscription | undefined;
  checkingOut?: boolean;
  onCheckout: (planCode: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {plans.map((plan) => {
        const current = subscription?.planCode === plan.code;
        return (
          <li key={plan.code} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("billing.interval", { interval: plan.interval })}
                </p>
              </div>
              {current ? (
                <span className="text-xs font-medium text-muted-foreground">
                  {t("billing.currentPlan")}
                </span>
              ) : null}
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {Object.entries(plan.features).map(([key, value]) => (
                <li key={key}>
                  {key}: {String(value)}
                </li>
              ))}
            </ul>
            {!current ? (
              <Can permission="billing.subscription:create">
                <Button size="sm" disabled={checkingOut} onClick={() => onCheckout(plan.code)}>
                  {t("billing.checkout")}
                </Button>
              </Can>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
