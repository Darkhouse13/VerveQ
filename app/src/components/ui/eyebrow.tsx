import { cn } from "@/lib/utils";

export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  as?: "span" | "p" | "div";
}

/**
 * Eyebrow — the small mono label above a title ("TODAY", "ROUND 3"). The only
 * text allowed at 12px.
 */
function Eyebrow({ as: Tag = "p", className, ...props }: EyebrowProps) {
  return <Tag className={cn("font-mono text-eyebrow uppercase text-muted-foreground", className)} {...props} />;
}

export { Eyebrow };
