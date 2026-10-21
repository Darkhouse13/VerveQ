import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "neo-border neo-shadow inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-heading font-bold text-primary-foreground",
  {
    variants: {
      size: {
        sm: "h-8 w-8 text-eyebrow",
        md: "h-10 w-10 text-body-sm",
        lg: "h-14 w-14 text-title-sm",
        xl: "h-20 w-20 text-title",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/** First letters of the first two words, upper-cased. */
function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Avatar — initials on the action fill (ink text). */
function Avatar({ name, size, className }: AvatarProps) {
  return <div className={cn(avatarVariants({ size }), className)}>{initialsOf(name)}</div>;
}

export { Avatar };
