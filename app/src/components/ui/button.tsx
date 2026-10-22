import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Button — the VerveQ ONE action primitive.
 *
 * - `primary` is THE action on a screen (orange on cream hubs, lime on ink).
 *   One per screen.
 * - `link` is an inline text action inside a sentence ("… · Sign in"): no
 *   box, an underline, the surrounding type. Inline links are the one place a
 *   control may sit under the 44px tap target (WCAG 2.5.8 inline exception).
 * - `secondary` is a card-filled, bordered alternative; `danger` is for
 *   destructive confirmations; `ghost` is chrome (no border, no shadow).
 * - Every size is a ≥44px tap target. Text on every fill is ink.
 * - `disabled` has a built-in look (muted fill, muted text, no shadow), so
 *   call sites no longer style it themselves.
 * - `loading` shows a spinner over the label (the label stays in layout, so
 *   the width never jumps), sets aria-busy and blocks clicks while keeping the
 *   variant's fill.
 */
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 rounded-lg font-heading font-bold transition duration-press",
  {
    variants: {
      variant: {
        primary: "neo-border bg-primary text-primary-foreground",
        secondary: "neo-border bg-card text-card-foreground",
        danger: "neo-border bg-destructive text-destructive-foreground",
        ghost: "border-2 border-transparent bg-transparent text-foreground",
        link: "bg-transparent underline underline-offset-4 hover:text-foreground",
      },
      size: {
        sm: "min-h-11 px-4 py-2 text-body-sm",
        md: "min-h-12 px-5 py-2.5 text-body-sm",
        lg: "min-h-14 px-6 py-3 text-body",
      },
      block: {
        true: "w-full",
        false: "",
      },
      inert: {
        true: "cursor-not-allowed bg-muted text-muted-foreground",
        false: "cursor-pointer",
      },
    },
    compoundVariants: [
      // The hard offset shadow and the pressed state (translate 2px, shadow
      // shrinks to 2px) belong to the bordered variants only.
      {
        variant: ["primary", "secondary", "danger"],
        inert: false,
        class: "neo-shadow enabled:active:translate-x-0.5 enabled:active:translate-y-0.5 enabled:active:neo-shadow-sm",
      },
      { variant: ["primary", "danger"], inert: false, class: "hover:brightness-105" },
      { variant: ["secondary", "ghost"], inert: false, class: "hover:bg-muted" },
      { variant: "ghost", inert: true, class: "bg-transparent" },
      // A link takes the sentence's size, weight and color; no box at all.
      { variant: "link", class: "inline min-h-0 rounded-none p-0 font-body font-normal text-[length:inherit]" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
      block: false,
      inert: false,
    },
  },
);

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "link";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  /** Spinner over the label, aria-busy, clicks blocked; keeps the fill and width. */
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, block = false, loading = false, disabled, type = "button", children, ...props },
    ref,
  ) => {
    const inert = Boolean(disabled) && !loading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={Boolean(disabled) || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size, block, inert }), loading && "cursor-progress", className)}
        {...props}
      >
        {loading ? (
          <>
            <span className="invisible inline-flex items-center justify-center gap-2">{children}</span>
            <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
export type { ButtonVariant, ButtonSize };
