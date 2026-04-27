import { cn } from "@/lib/utils";

interface NeoBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: "primary" | "accent" | "blue" | "pink" | "success" | "destructive" | "muted";
  rotated?: boolean;
  size?: "sm" | "md";
}

const colorMap = {
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  blue: "bg-electric-blue text-electric-blue-foreground",
  pink: "bg-hot-pink text-hot-pink-foreground",
  success: "bg-success text-success-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  muted: "bg-muted text-muted-foreground",
};

export function NeoBadge({
  className,
  color = "primary",
  rotated = false,
  size = "sm",
  children,
  ...props
}: NeoBadgeProps) {
  return (
    <span
      className={cn(
        "neo-border neo-shadow inline-flex items-center font-heading font-bold uppercase tracking-wide",
        size === "sm" ? "rounded-full px-3 py-1 text-[10px]" : "rounded-lg px-4 py-1.5 text-xs",
        colorMap[color],
        rotated && "rotate-[-2deg]",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
