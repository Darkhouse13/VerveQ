import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface NeoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  color?: "default" | "primary" | "accent" | "blue" | "pink" | "success" | "destructive";
  shadow?: "default" | "lg" | "none";
}

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

const NeoCard = forwardRef<HTMLDivElement, NeoCardProps>(
  ({ className, active, color = "default", shadow = "default", children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "neo-border rounded-lg p-4 transition-all",
        colorMap[color],
        shadowMap[shadow],
        active && "ring-2 ring-primary scale-[1.02]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
NeoCard.displayName = "NeoCard";

export { NeoCard };
