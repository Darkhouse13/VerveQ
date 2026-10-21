import { cn } from "@/lib/utils";

/** Skeleton — a pulsing placeholder block; holds still under reduced motion. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
