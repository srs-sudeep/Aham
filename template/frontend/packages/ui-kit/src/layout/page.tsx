import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}
