/**
 * ResultHero — the top of every result screen (VerveQ ONE P2.2): the score in
 * the mono score size on the mode's accent, the verdict squares under it, and
 * an optional line (e.g. the standing) in an ink pill. Text on the accent fill
 * is ink.
 */
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Rounds per difficulty group (the dailies' 3 / 3 / 3 / 1 ramp). */
const DEFAULT_BREAKS = [3, 6, 9];

export interface ResultHeroProps {
  /** Mono label above the score, e.g. "Who's Older? #24" or "Run over". */
  eyebrow: string;
  score: number | string;
  /** Renders "/total" after the score. */
  total?: number;
  /** Small label under the score, e.g. "Streak". */
  caption?: string;
  /** One verdict per round, in order. */
  squares?: ReadonlyArray<boolean>;
  /** Accessible summary of the squares, e.g. "4 of 10 right". */
  squaresLabel?: string;
  /** Indices where a new group of squares starts. */
  breaks?: ReadonlyArray<number>;
  /** Extra lines inside the hero (the standing pill, "It was …"). */
  children?: ReactNode;
  className?: string;
  testId?: string;
}

export function ResultHero({
  eyebrow,
  score,
  total,
  caption,
  squares,
  squaresLabel,
  breaks = DEFAULT_BREAKS,
  children,
  className,
  testId,
}: ResultHeroProps) {
  return (
    <Card tone="mode" elevation="lifted" padding="lg" className={cn("text-center", className)} data-testid={testId}>
      <p className="font-mono text-eyebrow font-bold uppercase">{eyebrow}</p>
      <p className="mt-2 font-mono font-bold text-score tabular-nums" data-testid="result-score">
        {score}
        {total != null && <span className="text-title-lg text-ink/70">/{total}</span>}
      </p>
      {caption && <p className="mt-1 font-mono text-eyebrow font-bold uppercase">{caption}</p>}
      {squares && squares.length > 0 && (
        <div className="mt-4 flex justify-center gap-1" role="img" aria-label={squaresLabel}>
          {squares.map((right, i) => (
            <span
              key={i}
              className={cn(
                "h-5 w-5 rounded-sm border-2 border-ink",
                right ? "bg-verdict-right" : "bg-verdict-wrong",
                breaks.includes(i) && "ml-2",
              )}
            />
          ))}
        </div>
      )}
      {children}
    </Card>
  );
}

/** The ink pill a hero line sits in (standing, best streak). */
export function HeroPill({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p
      className="mt-4 inline-block rounded-full bg-ink px-3 py-1 text-body-sm font-bold text-cream"
      data-testid={testId}
    >
      {children}
    </p>
  );
}
