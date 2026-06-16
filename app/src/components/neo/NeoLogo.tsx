import { cn } from "@/lib/utils";

interface NeoLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-12 h-12",
  md: "w-20 h-20",
  lg: "w-28 h-28",
};

export function NeoLogo({ size = "md", className }: NeoLogoProps) {
  return (
    <img
      src="/vq-logo.png"
      alt="VerveQ"
      className={cn(
        "neo-border neo-shadow-lg rounded-full object-cover",
        sizeMap[size],
        className
      )}
    />
  );
}
