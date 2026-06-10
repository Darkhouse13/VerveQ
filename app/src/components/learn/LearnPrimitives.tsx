/**
 * Learn v2 — shared presentational primitives, in the WARM `.theme-learn`
 * palette. `LearnShell` scopes the palette to the Learn pillar so the rest of
 * the shell keeps the UNIFIED palette.
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-height container that applies the Learn palette and the desktop
 * never-scroll contract (mobile screens opt into vertical scroll per-region).
 */
export function LearnShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "theme-learn bg-background text-foreground shell-canvas-bg flex flex-col",
        "min-h-[100dvh] overflow-x-hidden",
        // Desktop: break out of App's max-w-md column to fill the viewport and
        // never scroll (matches ShellLayout's discipline).
        "md:fixed md:inset-0 md:z-40 md:min-h-0 md:h-[100dvh] md:overflow-hidden",
      )}
    >
      {/* Desktop canvas group (matches ShellLayout): `contents` is a no-op
          below xl; at xl+ the Learn screens lay out inside a height-bounded,
          centered column, with the width bounded from 1440px so ultra-wide
          monitors don't stretch the hero bands edge-to-edge. */}
      <div className="contents xl:flex xl:flex-col xl:w-full xl:flex-1 xl:min-h-0 xl:max-h-[50rem] xl:my-auto min-[1440px]:max-w-6xl min-[1440px]:mx-auto">
        {children}
      </div>
    </div>
  );
}

/** Mono uppercase pill. */
export function Chip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-foreground bg-card px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Mono uppercase eyebrow label. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Progress ladder (dots). */
export function LadderDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-3.5 w-3.5 rounded border-2 border-foreground",
            i < current ? "bg-primary" : "bg-transparent",
          )}
        />
      ))}
    </div>
  );
}

/** Horizontal mastery bar (0..1). */
export function MasteryBar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "success" | "accent";
}) {
  const fill =
    tone === "success" ? "bg-success" : tone === "accent" ? "bg-accent" : "bg-primary";
  return (
    <div className="h-4 overflow-hidden rounded-full border-[3px] border-foreground bg-card">
      <div
        className={cn("h-full", fill)}
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
      />
    </div>
  );
}
