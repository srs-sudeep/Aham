import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "../layout/page";
import { PageHeader } from "../layout/page-header";
import { Breadcrumbs, type BreadcrumbItem } from "../layout/breadcrumbs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../primitives/tabs";

export type DetailTab = {
  value: string;
  label: ReactNode;
  content: ReactNode;
};

export function DetailPage({
  title,
  description,
  actions,
  breadcrumbs,
  onNavigate,
  tabs,
  defaultTab,
  overview,
  related,
  history,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  onNavigate?: (to: string) => void;
  /** Explicit tabs; take precedence over the overview/related/history slots. */
  tabs?: DetailTab[];
  defaultTab?: string;
  /** Convenience tab slots. */
  overview?: ReactNode;
  related?: ReactNode;
  history?: ReactNode;
  /** Rendered when no tabs / slots are provided (single-view detail). */
  children?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();

  const resolvedTabs: DetailTab[] =
    tabs ??
    (
      [
        overview !== undefined
          ? {
              value: "overview",
              label: t("detail.tabs.overview", { defaultValue: "Overview" }),
              content: overview,
            }
          : null,
        related !== undefined
          ? {
              value: "related",
              label: t("detail.tabs.related", { defaultValue: "Related" }),
              content: related,
            }
          : null,
        history !== undefined
          ? {
              value: "history",
              label: t("detail.tabs.history", { defaultValue: "History" }),
              content: history,
            }
          : null,
      ] as Array<DetailTab | null>
    ).filter((tab): tab is DetailTab => tab !== null);

  const first = resolvedTabs[0];

  return (
    <Page className={className}>
      <div>
        {breadcrumbs ? <Breadcrumbs items={breadcrumbs} onNavigate={onNavigate} /> : null}
        <PageHeader className="mb-0" title={title} description={description} actions={actions} />
      </div>
      {first ? (
        <Tabs defaultValue={defaultTab ?? first.value}>
          <TabsList>
            {resolvedTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {resolvedTabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
      {children}
    </Page>
  );
}
