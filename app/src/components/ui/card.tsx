import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Card — the VerveQ ONE surface.
 *
 * tone:      default (card fill) · paper (cream reading card on any ground) ·
 *            inverse (flips the ground) · mode (the mode's accent; ink text).
 * elevation: flat (border only) · raised (4px hard shadow) · lifted (6px).
 * padding:   none · sm 12 · md 16 · lg 24.
 *
 * `interactive` renders a real <button> (full width, left-aligned, pressable)
 * so tappable cards are keyboard- and screen-reader-reachable.
 */
const cardVariants = cva("neo-border rounded-lg", {
  variants: {
    tone: {
      default: "bg-card text-card-foreground",
      paper: "bg-paper text-paper-foreground",
      inverse: "bg-foreground text-background",
      mode: "bg-mode-accent text-ink on-fill",
    },
    elevation: {
      flat: "",
      raised: "neo-shadow",
      lifted: "neo-shadow-lg",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      md: "p-4",
      lg: "p-6",
    },
  },
  defaultVariants: { tone: "default", elevation: "raised", padding: "md" },
});

type CardTone = "default" | "paper" | "inverse" | "mode";
type CardElevation = "flat" | "raised" | "lifted";
type CardPadding = "none" | "sm" | "md" | "lg";

type CardCommonProps = {
  tone?: CardTone;
  elevation?: CardElevation;
  padding?: CardPadding;
};

export type CardDivProps = CardCommonProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> & { interactive?: false };

export type CardButtonProps = CardCommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
    interactive: true;
    type?: "button" | "submit" | "reset";
  };

export type CardProps = CardDivProps | CardButtonProps;

const interactiveClasses =
  "block w-full text-left cursor-pointer transition duration-press enabled:active:translate-x-0.5 enabled:active:translate-y-0.5 enabled:active:neo-shadow-sm disabled:cursor-not-allowed";

const Card = forwardRef<HTMLDivElement | HTMLButtonElement, CardProps>((props, ref) => {
  if (props.interactive) {
    const { tone, elevation, padding, interactive: _interactive, type = "button", className, ...rest } =
      props as CardButtonProps;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type}
        className={cn(cardVariants({ tone, elevation, padding }), interactiveClasses, className)}
        {...rest}
      />
    );
  }
  const { tone, elevation, padding, interactive: _interactive, className, ...rest } = props as CardDivProps;
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={cn(cardVariants({ tone, elevation, padding }), className)}
      {...rest}
    />
  );
});
Card.displayName = "Card";

export { Card };
export type { CardTone, CardElevation, CardPadding };
