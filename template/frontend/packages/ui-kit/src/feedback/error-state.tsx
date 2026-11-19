import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Text } from "../components/typography";

function describeError(error: unknown): string | undefined {
  if (error instanceof Error && error.message) return error.message;
  return undefined;
}

export function ErrorState({
  title,
  message,
  error,
  onRetry,
  className,
}: {
  title?: ReactNode;
  /** Overrides the message derived from `error`. */
  message?: ReactNode;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const resolvedMessage =
    message ?? describeError(error) ?? t("feedback.error.message", "Something went wrong.");

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/40 p-8 text-center",
        className,
      )}
    >
      <AlertCircle className="h-8 w-8 text-destructive" />
      <div className="font-medium">{title ?? t("feedback.error.title", "Unable to load data")}</div>
      <Text variant="muted">{resolvedMessage}</Text>
      {requestId ? (
        <Text variant="muted" as="span" className="font-mono text-xs">
          {t("feedback.error.requestId", "Request ID")}: {requestId}
        </Text>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          {t("feedback.retry", "Retry")}
        </Button>
      ) : null}
    </div>
  );
}
