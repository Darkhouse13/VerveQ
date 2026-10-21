import { BrandMark } from "@/components/ui/BrandMark";

interface NeoLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "md",
  md: "lg",
  lg: "lg",
} as const;

/**
 * @deprecated Use `<BrandMark />` from `@/components/ui/BrandMark`. Kept as a
 * thin wrapper so old call sites still compile; it renders the brand mark,
 * not the retired PNG disc.
 */
export function NeoLogo({ size = "md", className }: NeoLogoProps) {
  return <BrandMark variant="mark" size={sizeMap[size]} className={className} />;
}
