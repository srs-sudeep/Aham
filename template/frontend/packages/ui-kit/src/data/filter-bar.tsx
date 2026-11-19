import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function FilterBar({
  children,
  actions,
  className,
}: {
  /** Filter controls (inputs, selects, ...). */
  children: ReactNode;
  /** Trailing slot, e.g. a reset button. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="search"
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3",
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-end gap-3">{children}</div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
