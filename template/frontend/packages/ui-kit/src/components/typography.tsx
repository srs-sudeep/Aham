import { cn } from "../lib/utils";

const headingSizes = {
  1: "text-h1 font-semibold tracking-tight",
  2: "text-h2 font-semibold tracking-tight",
  3: "text-h3 font-semibold tracking-tight",
} as const;

export function Heading({
  level = 1,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { level?: 1 | 2 | 3 }) {
  const Tag = (`h${level}` as const);
  return <Tag className={cn(headingSizes[level], className)} {...props} />;
}

const textVariants = {
  body: "text-body text-foreground",
  muted: "text-muted text-muted-foreground",
  label: "text-label font-medium text-foreground",
} as const;

export function Text({
  variant = "body",
  className,
  as: Comp = "p",
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  variant?: keyof typeof textVariants;
  as?: "p" | "span" | "div";
}) {
  return <Comp className={cn(textVariants[variant], className)} {...props} />;
}
