import { cn } from "@/lib/utils";

interface NeoAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
  xl: "w-20 h-20 text-2xl",
};

export function NeoAvatar({ name, size = "md", className }: NeoAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "neo-border neo-shadow rounded-full bg-primary text-primary-foreground font-heading font-bold flex items-center justify-center",
        sizeMap[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
