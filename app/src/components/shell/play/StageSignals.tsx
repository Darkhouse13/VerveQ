/**
 * The in-play signals every migrated mode shares (VerveQ ONE P3.2), next to
 * the header pieces in StageParts:
 *
 *  - StageTimer: the ONE countdown — a seconds pill and a thin bar beside it.
 *    The bar is the mode accent; the last seconds invert the pill. Red is not
 *    spent on the clock: green and red mean right and wrong only.
 *  - VerdictSlot: a fixed-height row under the question where the verdict
 *    lands (✓ / ✕ badge, plus the right answer in green). It is always
 *    rendered, so nothing jumps when a verdict appears, and it is a live
 *    region. Toasts stay for system errors.
 */
import type { ReactNode } from "react";
import { Check, Timer, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StageTimer({
  seconds,
  fraction,
  label,
  urgentAt = 5,
  className,
}: {
  seconds: number;
  /** Time left, 0–1. */
  fraction: number;
  /** Accessible name, e.g. "23 seconds left". */
  label: string;
  urgentAt?: number;
  className?: string;
}) {
  const urgent = seconds <= urgentAt;
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className={cn("flex items-center gap-3", className)} role="timer" aria-label={label} data-testid="stage-timer">
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full neo-border px-3 py-1 font-mono font-bold text-body-sm tabular-nums",
          urgent ? "bg-foreground text-background" : "bg-card text-card-foreground",
        )}
      >
        <Timer size={14} strokeWidth={3} />
        {seconds}s
      </span>
      <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-mode-accent transition-[width] duration-200 ease-linear motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}

/** ✓ / ✕ stamp in the verdict colors. */
export function VerdictBadge({ right, children, testId }: { right: boolean; children: ReactNode; testId?: string }) {
  return (
    <Badge
      tone={right ? "right" : "wrong"}
      shape="tag"
      size="md"
      stamp
      data-testid={testId}
      data-verdict={right ? "right" : "wrong"}
      className="text-body-sm animate-badge-land motion-reduce:animate-none"
    >
      {right ? <Check size={16} strokeWidth={3.5} aria-hidden="true" /> : <X size={16} strokeWidth={3.5} aria-hidden="true" />}
      {children}
    </Badge>
  );
}

/** The right answer, revealed in green on an ink chip (reads on any ground). */
export function RevealedAnswer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md bg-ink px-3 py-1 font-heading font-bold text-verdict-right animate-badge-land motion-reduce:animate-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The fixed verdict row. Empty until a verdict lands; never collapses. */
export function VerdictSlot({ children, className, testId }: { children?: ReactNode; className?: string; testId?: string }) {
  return (
    <div
      className={cn("shrink-0 min-h-11 flex flex-wrap items-center justify-center gap-2 text-center", className)}
      aria-live="polite"
      data-testid={testId}
    >
      {children}
    </div>
  );
}
