import { useState } from "react";
import { toast } from "sonner";
import { Button, Can, ConfirmDialog, ListPage, QueryState, useTranslation } from "@aham/ui-kit";
import { useCancelSubscription, useCheckout } from "../../hooks/use-billing-mutations";
import { usePlans, useSubscription } from "../../hooks/use-billing";
import { PlansList } from "../components/PlansList";
import { SubscriptionSummary } from "../components/SubscriptionSummary";

export function BillingListPage() {
  const { t } = useTranslation();
  const plansQuery = usePlans();
  const subscriptionQuery = useSubscription();
  const checkout = useCheckout();
  const cancelSubscription = useCancelSubscription();
  const [cancelOpen, setCancelOpen] = useState(false);

  async function handleCheckout(planCode: string) {
    try {
      const result = await checkout.mutateAsync(planCode);
      toast.success(t("billing.toast.checkoutStarted"));
      if (result.checkoutUrl.startsWith("http")) {
        window.location.assign(result.checkoutUrl);
      }
    } catch {
      // Global mutation toast already shown.
    }
  }

  async function confirmCancel() {
    try {
      await cancelSubscription.mutateAsync();
      toast.success(t("billing.toast.canceled"));
      setCancelOpen(false);
    } catch {
      // Global mutation toast already shown.
    }
  }

  return (
    <ListPage
      titleKey="billing.title"
      description={t("billing.description")}
      actions={
        subscriptionQuery.data?.status === "active" ? (
          <Can permission="billing.subscription:delete">
            <Button variant="outline" onClick={() => setCancelOpen(true)}>
              {t("billing.cancel")}
            </Button>
          </Can>
        ) : null
      }
    >
      <div className="space-y-8">
        <QueryState query={subscriptionQuery} emptyMessage={t("billing.noSubscription")}>
          {(subscription) => <SubscriptionSummary subscription={subscription} />}
        </QueryState>

        <section className="space-y-3">
          <h2 className="text-base font-medium">{t("billing.plansTitle")}</h2>
          <QueryState query={plansQuery} emptyMessage={t("billing.noPlans")}>
            {(plans) => (
              <PlansList
                plans={plans}
                subscription={subscriptionQuery.data}
                checkingOut={checkout.isPending}
                onCheckout={handleCheckout}
              />
            )}
          </QueryState>
        </section>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t("billing.cancelDialog.title")}
        description={t("billing.cancelDialog.description")}
        confirmLabel={t("billing.cancel")}
        destructive
        loading={cancelSubscription.isPending}
        onConfirm={confirmCancel}
      />
    </ListPage>
  );
}
