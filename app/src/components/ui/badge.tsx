import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — a short label on a fill. Text is ink on every colored tone and never
 * smaller than 12px.
 *
 * tones: neutral · muted · action · right · wrong · mode, plus the legacy
 * color names (primary, accent, blue, pink, yellow, success, destructive) that
 * NeoBadge call sites still pass. New code should prefer the role tones.
 */
const badgeVariants = cva(
  "neo-border neo-shadow-sm inline-flex items-center gap-1 font-heading font-bold uppercase",
  {
    variants: {
      tone: {
        neutral: "bg-card text-card-foreground",
        muted: "bg-muted text-muted-foreground",
        action: "bg-action text-action-foreground",
        right: "bg-verdict-right text-ink",
        wrong: "bg-verdict-wrong text-ink",
        mode: "bg-mode-accent text-ink",
        primary: "bg-primary text-primary-foreground",
        accent: "bg-accent text-accent-foreground",
        blue: "bg-electric-blue text-electric-blue-foreground",
        pink: "bg-hot-pink text-hot-pink-foreground",
        yellow: "bg-yellow text-yellow-foreground",
        success: "bg-success text-success-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
      size: {
        sm: "px-2.5 py-0.5 text-eyebrow",
        md: "px-3 py-1 text-eyebrow",
      },
      shape: {
        pill: "rounded-full",
        tag: "rounded-md",
      },
      stamp: {
        true: "-rotate-2",
        false: "",
      },
    },
    defaultVariants: { tone: "neutral", size: "sm", shape: "pill", stamp: false },
  },
);

type BadgeTone =
  | "neutral"
  | "muted"
  | "action"
  | "right"
  | "wrong"
  | "mode"
  | "primary"
  | "accent"
  | "blue"
  | "pink"
  | "yellow"
  | "success"
  | "destructive";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: "sm" | "md";
  shape?: "pill" | "tag";
  /** A slight rotation, for result stamps. */
  stamp?: boolean;
}

function Badge({ className, tone, size, shape, stamp, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size, shape, stamp }), className)} {...props} />;
}

export { Badge };
export type { BadgeTone };
