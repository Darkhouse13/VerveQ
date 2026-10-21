import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Card, type CardElevation } from "@/components/ui/card";

type NeoCardCommonProps = {
  active?: boolean;
  color?: "default" | "primary" | "accent" | "blue" | "pink" | "yellow" | "success" | "destructive";
  shadow?: "default" | "lg" | "none";
};

type NeoCardDivProps = NeoCardCommonProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> & { onClick?: undefined };

type NeoCardButtonProps = NeoCardCommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
    onClick: React.MouseEventHandler<HTMLButtonElement>;
    type?: "button" | "submit" | "reset";
  };

type NeoCardProps = NeoCardDivProps | NeoCardButtonProps;

/*
 * Legacy colored fills. Card's tones are roles (default/paper/inverse/mode);
 * these fills carry meaning at their call sites (a red warning, a green
 * result), so they ride on top of the default tone until each call site picks
 * a role. Ink text on every fill.
 */
const LEGACY_FILL = {
  default: "",
  // On the ink ground `primary` is lime, the action color, and a lime card
  // is a large lime fill (R4). This fill was orange on the cream hubs, so it
  // stays orange: a mode accent with ink text.
  primary: "bg-orange text-orange-foreground on-fill",
  accent: "bg-accent text-accent-foreground on-fill",
  blue: "bg-electric-blue text-electric-blue-foreground on-fill",
  pink: "bg-hot-pink text-hot-pink-foreground on-fill",
  yellow: "bg-yellow text-yellow-foreground on-fill",
  success: "bg-success text-success-foreground on-fill",
  destructive: "bg-destructive text-destructive-foreground on-fill",
} as const;

const ELEVATION: Record<NonNullable<NeoCardCommonProps["shadow"]>, CardElevation> = {
  default: "raised",
  lg: "lifted",
  none: "flat",
};

/**
 * @deprecated Use `Card` from `@/components/ui/card` (`tone`, `elevation`,
 * `padding`, `interactive`). NeoCard is a thin alias: `shadow` → elevation,
 * `color` → a legacy fill, `onClick` → an interactive (button-element) card.
 */
const NeoCard = forwardRef<HTMLDivElement | HTMLButtonElement, NeoCardProps>(
  ({ className, active, color = "default", shadow = "default", ...props }, ref) => {
    const classes = cn(LEGACY_FILL[color], active && "ring-2 ring-primary scale-[1.02]", className);
    const elevation = ELEVATION[shadow];

    if ("onClick" in props && props.onClick !== undefined) {
      return (
        <Card
          ref={ref}
          interactive
          elevation={elevation}
          className={classes}
          {...(props as Omit<NeoCardButtonProps, keyof NeoCardCommonProps>)}
        />
      );
    }

    const { onClick: _onClick, ...divProps } = props as NeoCardDivProps;
    return <Card ref={ref} elevation={elevation} className={classes} {...divProps} />;
  },
);
NeoCard.displayName = "NeoCard";

export { NeoCard };
