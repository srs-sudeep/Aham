import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

export function Breadcrumbs({
  items,
  onNavigate,
  className,
}: {
  items: BreadcrumbItem[];
  /** Optional SPA navigation handler; falls back to normal anchor navigation. */
  onNavigate?: (to: string) => void;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-2", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-muted text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const to = item.to;
          return (
            <Fragment key={`${index}-${item.label}`}>
              <li className="flex items-center">
                {to && !isLast ? (
                  <a
                    href={to}
                    onClick={(event) => {
                      if (!onNavigate) return;
                      event.preventDefault();
                      onNavigate(to);
                    }}
                    className="hover:text-foreground hover:underline"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={cn(isLast && "text-foreground")}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast ? (
                <li aria-hidden="true" className="flex items-center">
                  <ChevronRight className="h-3 w-3" />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
