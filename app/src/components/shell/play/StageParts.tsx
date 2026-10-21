/**
 * Small pieces of the StageFrame header (PlayStage.tsx): the round-by-round
 * StepDots progress row and the StageScore slot.
 */
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * One dot per round: right/wrong once played (the verdict colors — the only
 * place green and red appear), a ringed dot for the round on screen, hollow
 * for the rest. A `null` result is a round played whose verdict this screen
 * does not know (a multiplayer round): a plain filled dot. Decorative; `label`
 * names the progress for screen readers.
 */
export function StepDots({
  total,
  results,
  current,
  label,
}: {
  total: number;
  /** Verdicts of the rounds played so far, in order (`null`: played, verdict unknown). */
  results: ReadonlyArray<boolean | null>;
  /** Index of the round on screen. */
  current: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1.5" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {Array.from({ length: total }, (_, i) => {
        const done = results[i];
        return (
          <span
            key={i}
            className={cn(
              "h-2.5 w-2.5 rounded-full border-2 transition-transform duration-ui motion-reduce:transition-none",
              done === true
                ? "bg-verdict-right border-verdict-right"
                : done === false
                  ? "bg-verdict-wrong border-verdict-wrong"
                  : done === null
                    ? "bg-foreground/60 border-foreground/60"
                    : i === current
                      ? "border-foreground bg-foreground/30 scale-125"
                      : "border-foreground/40",
            )}
          />
        );
      })}
    </div>
  );
}

/**
 * The header's score slot: an icon in the mode accent and a mono number,
 * with an optional small line under it (e.g. "best 7").
 */
export function StageScore({
  icon,
  value,
  label,
  detail,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  detail?: string;
}) {
  return (
    <span className="flex flex-col items-end pr-2" aria-label={label} role="img" data-testid="stage-score">
      <span className="inline-flex items-center gap-1 font-mono font-bold text-title-sm tabular-nums" aria-hidden="true">
        <span className="text-mode-accent">{icon}</span>
        {value}
      </span>
      {detail && (
        <span className="font-mono text-eyebrow uppercase text-muted-foreground" aria-hidden="true">
          {detail}
        </span>
      )}
    </span>
  );
}

/**
 * The round's difficulty — a neutral tag with four pips, so the ramp reads
 * without spending green/yellow/red (those mean right and wrong) on it. The
 * last level inverts the tag.
 */
export function TierBadge({ label, level, testId }: { label: string; level: 0 | 1 | 2 | 3; testId?: string }) {
  return (
    <Badge
      tone="neutral"
      shape="tag"
      size="md"
      data-testid={testId}
      className={cn("gap-2 font-mono tracking-wide", level === 3 && "bg-foreground text-background")}
    >
      {label}
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-2.5 w-1.5 rounded-sm border border-current", i <= level && "bg-current")} />
        ))}
      </span>
    </Badge>
  );
}
