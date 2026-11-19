import type { ErrorComponentProps } from "@tanstack/react-router";
import { ErrorState, Page, useTranslation } from "@aham/ui-kit";

export function RouteErrorBoundary({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <Page className="p-[var(--space-page)]">
      <ErrorState
        title={t("routeError.title")}
        message={error instanceof Error && error.message ? error.message : t("routeError.body")}
        error={error}
        onRetry={reset}
      />
    </Page>
  );
}
