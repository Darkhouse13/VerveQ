import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

/**
 * Legacy variant → VerveQ ONE variant (P1.3).
 *
 *   primary, accent, success, yellow, pink → primary   (the colored fills
 *                                                         collapse into THE
 *                                                         action color)
 *   blue                                   → secondary (every blue call site
 *                                                         is the supporting
 *                                                         action beside a
 *                                                         primary: share, help,
 *                                                         "play today" next to
 *                                                         "play endless")
 *   secondary, outline                     → secondary
 *   danger                                 → danger
 *   ghost                                  → ghost
 *
 * pink stays primary because its loudest use is Higher/Lower, where "lower"
 * must weigh the same as "higher" (accent): demoting it would nudge the call.
 */
const VARIANT_MAP = {
  primary: "primary",
  accent: "primary",
  success: "primary",
  yellow: "primary",
  pink: "primary",
  blue: "secondary",
  secondary: "secondary",
  outline: "secondary",
  danger: "danger",
  ghost: "ghost",
} as const satisfies Record<string, ButtonVariant>;

/** Legacy sizes: `xl` folds into `lg`; `full` is `lg` + block. */
const SIZE_MAP = {
  sm: "sm",
  md: "md",
  lg: "lg",
  xl: "lg",
  full: "lg",
} as const satisfies Record<string, ButtonSize>;

export type NeoButtonVariant = keyof typeof VARIANT_MAP;
export type NeoButtonSize = keyof typeof SIZE_MAP;

interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NeoButtonVariant | null;
  size?: NeoButtonSize | null;
}

/**
 * @deprecated Use `Button` from `@/components/ui/button`. NeoButton is a thin
 * alias kept so existing call sites pick up the VerveQ ONE look unchanged.
 * It keeps the old all-caps labels (`uppercase tracking-wide`) until the copy
 * is rewritten to sentence case and each call site moves to Button.
 */
const NeoButton = forwardRef<HTMLButtonElement, NeoButtonProps>(({ className, variant, size, ...props }, ref) => (
  <Button
    ref={ref}
    variant={VARIANT_MAP[variant ?? "primary"]}
    size={SIZE_MAP[size ?? "md"]}
    block={size === "full"}
    className={cn("uppercase tracking-wide", className)}
    {...props}
  />
));
NeoButton.displayName = "NeoButton";

export { NeoButton };
