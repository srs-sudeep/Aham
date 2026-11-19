import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "../primitives/skeleton";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";

export type QueryLike<TData> = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  data: TData | undefined;
  refetch?: () => unknown;
};

function defaultIsEmpty(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  return false;
}

function DefaultSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function QueryState<TData>({
  query,
  children,
  loading,
  empty,
  emptyMessage,
  isEmpty = defaultIsEmpty,
  onRetry,
}: {
  query: QueryLike<TData>;
  children: (data: TData) => ReactNode;
  /** Custom loading UI (defaults to a skeleton). */
  loading?: ReactNode;
  /** Custom empty UI (defaults to EmptyState). */
  empty?: ReactNode;
  emptyMessage?: ReactNode;
  isEmpty?: (data: TData) => boolean;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();

  if (query.isLoading) return <>{loading ?? <DefaultSkeleton />}</>;

  if (query.isError) {
    const retry = onRetry ?? (query.refetch ? () => void query.refetch?.() : undefined);
    return <ErrorState error={query.error} onRetry={retry} />;
  }

  const data = query.data;
  if (data === undefined || data === null || isEmpty(data)) {
    return (
      <>
        {empty ?? (
          <EmptyState
            message={emptyMessage ?? t("feedback.empty.message", "No data to display.")}
          />
        )}
      </>
    );
  }

  return <>{children(data)}</>;
}
