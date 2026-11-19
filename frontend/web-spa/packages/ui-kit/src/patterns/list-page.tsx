import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "../layout/page";
import { PageHeader } from "../layout/page-header";

export function ListPage({
  title,
  titleKey,
  description,
  actions,
  filters,
  children,
  className,
}: {
  title?: ReactNode;
  /** i18n key; used when `title` is not provided. */
  titleKey?: string;
  description?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? (titleKey ? t(titleKey) : null);
  return (
    <Page className={className}>
      <PageHeader
        className="mb-0"
        title={resolvedTitle}
        description={description}
        actions={actions}
      />
      {filters ? <div>{filters}</div> : null}
      <div className="space-y-4">{children}</div>
    </Page>
  );
}
