import { Badge } from "@/components/ui/badge";

interface NeoBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: "primary" | "accent" | "blue" | "pink" | "yellow" | "success" | "destructive" | "muted";
  rotated?: boolean;
  size?: "sm" | "md";
}

/**
 * @deprecated Use `Badge` from `@/components/ui/badge`. NeoBadge is a thin
 * alias: `color` → tone (same names), `rotated` → `stamp`, size `sm` → a
 * small pill, size `md` → a tag. Text is 12px minimum (was 10px).
 */
export function NeoBadge({ color = "primary", rotated = false, size = "sm", ...props }: NeoBadgeProps) {
  return <Badge tone={color} stamp={rotated} size={size} shape={size === "sm" ? "pill" : "tag"} {...props} />;
}
