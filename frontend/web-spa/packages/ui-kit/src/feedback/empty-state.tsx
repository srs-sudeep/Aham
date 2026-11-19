import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "../lib/utils";
import { Text } from "../components/typography";

export function EmptyState({
  title,
  message,
  icon,
  action,
  className,
}: {
  title?: ReactNode;
  message: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center",
        className,
      )}
    >
      <div className="text-muted-foreground">{icon ?? <Inbox className="h-8 w-8" />}</div>
      {title ? <div className="font-medium">{title}</div> : null}
      <Text variant="muted">{message}</Text>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
