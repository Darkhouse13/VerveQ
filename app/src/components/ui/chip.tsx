import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  /** On / off. Rendered as aria-pressed. */
  selected: boolean;
}

/**
 * Chip — a selectable pill in a row of filters (subjects, modes, seasons).
 * A toggle, not an action: `aria-pressed`, a 44px tap target, and the picked
 * chip is a cream fill, never lime (lime is the screen's one action).
 * For switching between views use Segmented; for an action use Button.
 */
const Chip = forwardRef<HTMLButtonElement, ChipProps>(({ selected, className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-pressed={selected}
    className={cn(
      "neo-border inline-flex min-h-11 shrink-0 cursor-pointer select-none items-center justify-center gap-1.5 rounded-full px-4",
      "font-heading text-body-sm font-bold transition-colors duration-ui disabled:cursor-not-allowed disabled:is-dimmed",
      selected ? "bg-foreground text-background neo-shadow-sm" : "bg-card text-card-foreground enabled:hover:bg-muted",
      className,
    )}
    {...props}
  />
));
Chip.displayName = "Chip";

export { Chip };
