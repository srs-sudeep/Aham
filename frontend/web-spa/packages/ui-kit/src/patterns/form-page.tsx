import type { ReactNode } from "react";
import { Page } from "../layout/page";
import { PageHeader } from "../layout/page-header";
import { Breadcrumbs, type BreadcrumbItem } from "../layout/breadcrumbs";
import { cn } from "../lib/utils";

export function FormPage({
  title,
  description,
  actions,
  breadcrumbs,
  onNavigate,
  children,
  className,
  contentClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Header actions (e.g. a back / cancel button). Form submit actions belong in `FormActions`. */
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  onNavigate?: (to: string) => void;
  /** Typically a `<Form>` containing sections and `FormActions`. */
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Page className={className}>
      <div>
        {breadcrumbs ? <Breadcrumbs items={breadcrumbs} onNavigate={onNavigate} /> : null}
        <PageHeader className="mb-0" title={title} description={description} actions={actions} />
      </div>
      <div className={cn("max-w-3xl", contentClassName)}>{children}</div>
    </Page>
  );
}
