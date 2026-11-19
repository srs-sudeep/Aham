import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Heading, Text } from "../components/typography";

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section className={cn("space-y-3", className)}>
      {hasHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            {title ? <Heading level={2}>{title}</Heading> : null}
            {description ? <Text variant="muted">{description}</Text> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
