import { cn } from "@/lib/utils";

interface NeoLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-12 h-12 text-xl",
  md: "w-20 h-20 text-3xl",
  lg: "w-28 h-28 text-5xl",
};

export function NeoLogo({ size = "md", className }: NeoLogoProps) {
  return (
    <div
      className={cn(
        "neo-border neo-shadow-lg rounded-2xl bg-primary text-primary-foreground font-heading font-bold flex items-center justify-center",
        sizeMap[size],
        className
      )}
    >
      VQ
    </div>
  );
}
