import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type NeoCardCommonProps = {
  active?: boolean;
  color?: "default" | "primary" | "accent" | "blue" | "pink" | "success" | "destructive";
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

const colorMap = {
  default: "bg-card text-card-foreground",
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  blue: "bg-electric-blue text-electric-blue-foreground",
  pink: "bg-hot-pink text-hot-pink-foreground",
  success: "bg-success text-success-foreground",
  destructive: "bg-destructive text-destructive-foreground",
};

const shadowMap = {
  default: "neo-shadow",
  lg: "neo-shadow-lg",
  none: "",
};

const baseClasses = "neo-border rounded-lg p-4 transition-all";

const NeoCard = forwardRef<HTMLDivElement | HTMLButtonElement, NeoCardProps>(
  ({ className, active, color = "default", shadow = "default", children, ...props }, ref) => {
    const computed = cn(
      baseClasses,
      colorMap[color],
      shadowMap[shadow],
      active && "ring-2 ring-primary scale-[1.02]",
      className,
    );

    if ("onClick" in props && props.onClick !== undefined) {
      const { type = "button", ...rest } = props as NeoCardButtonProps;
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          type={type}
          className={cn(
            computed,
            "text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
          {...rest}
        >
          {children}
        </button>
      );
    }

    return (
      <div ref={ref as React.Ref<HTMLDivElement>} className={computed} {...(props as NeoCardDivProps)}>
        {children}
      </div>
    );
  },
);
NeoCard.displayName = "NeoCard";

export { NeoCard };
