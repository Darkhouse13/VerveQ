/**
 * Shared pieces of the Duels surfaces (VerveQ ONE P3.3): the hub, history,
 * rivals and the duel result all speak the same small vocabulary — a section
 * label with a count, a tappable duel row, the W/L/D record strip, and the
 * head-to-head hero on the Duels accent (hot pink, the compete tile's color).
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DUEL_ACCENT, duelBadgeTone } from "./duelTheme";
import { cn } from "@/lib/utils";
import { StageFrame } from "@/components/shell/play/PlayStage";

/** Mono section label with an optional count / action on the right. */
export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
      <h2 className="font-mono text-eyebrow font-bold uppercase text-muted-foreground">{children}</h2>
      {aside}
    </div>
  );
}

/** Small text link styled as a quiet action (44px tall hit area). */
export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="-my-3 inline-flex min-h-11 items-center gap-0.5 font-heading text-body-sm font-bold text-foreground underline underline-offset-4 hover:text-primary"
    >
      {children}
    </Link>
  );
}

/** Empty / loading line for a section, in a flat card. */
export function SectionEmpty({ children }: { children: ReactNode }) {
  return (
    <Card elevation="flat" padding="md" className="text-center">
      <p className="text-body-sm text-muted-foreground">{children}</p>
    </Card>
  );
}

const ROW =
  "flex w-full min-h-14 items-center gap-3 rounded-lg bg-card p-3 text-left text-card-foreground neo-border neo-shadow transition duration-press hover:bg-muted active:translate-x-0.5 active:translate-y-0.5 active:neo-shadow-sm";

/**
 * A tappable duel/rival row: title + meta line on the left, a badge or score
 * on the right, a chevron. Renders a router Link so it is a real link.
 */
export function DuelRow({
  to,
  title,
  meta,
  aside,
  footer,
  testId,
}: {
  to: string;
  title: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  testId?: string;
}) {
  return (
    <Link to={to} className={ROW} data-testid={testId}>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-heading text-body-sm font-bold">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-meta text-muted-foreground">{meta}</span>}
        {footer && <span className="mt-1 block text-meta text-muted-foreground">{footer}</span>}
      </span>
      {aside && <span className="flex shrink-0 items-center gap-2">{aside}</span>}
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

/** Wins / losses / draws in one flat card, numbers in mono. */
export function RecordStrip({
  wins,
  losses,
  draws,
  labels,
  testId,
}: {
  wins: number;
  losses: number;
  draws: number;
  labels: { wins: string; losses: string; draws: string };
  testId?: string;
}) {
  const cells = [
    { n: wins, label: labels.wins },
    { n: losses, label: labels.losses },
    { n: draws, label: labels.draws },
  ];
  return (
    <Card elevation="flat" padding="none" className="grid grid-cols-3 divide-x-2 divide-border/20" data-testid={testId}>
      {cells.map((c) => (
        <div key={c.label} className="px-2 py-2.5 text-center">
          <p className="font-mono text-title font-bold tabular-nums">{c.n}</p>
          <p className="font-mono text-eyebrow uppercase text-muted-foreground">{c.label}</p>
        </div>
      ))}
    </Card>
  );
}

/** A status badge for a duel row (W / L / draw / open …). */
export function DuelBadge({ label, color }: { label: string; color: "blue" | "muted" | "success" | "destructive" }) {
  return <Badge tone={duelBadgeTone(color)}>{label}</Badge>;
}

/**
 * The head-to-head hero of a finished (or waiting) duel, on the Duels accent:
 * a mono eyebrow, the headline, then "you – them" in the display size. Text on
 * the accent fill is ink.
 */
export function DuelHero({
  eyebrow,
  headline,
  myScore,
  opponentScore,
  youLabel,
  opponentLabel,
  children,
  testId,
}: {
  eyebrow?: string;
  headline: string;
  myScore: number;
  /** Omit when there is no opponent score yet (a solo first round). */
  opponentScore?: number;
  youLabel: string;
  opponentLabel?: string;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <Card tone="mode" elevation="lifted" padding="lg" className="text-center" data-testid={testId}>
      {eyebrow && <p className="font-mono text-eyebrow font-bold uppercase">{eyebrow}</p>}
      <p className="mt-1 font-heading text-title-lg font-bold" data-testid="duel-headline">
        {headline}
      </p>
      <p className="mt-3 font-mono text-display font-bold tabular-nums" data-testid="result-score">
        {myScore}
        {opponentScore != null && (
          <>
            <span className="mx-2 text-ink/70" aria-hidden="true">–</span>
            {opponentScore}
          </>
        )}
      </p>
      <p className="mt-1 font-mono text-eyebrow font-bold uppercase">
        {youLabel}
        {opponentLabel ? ` · ${opponentLabel}` : ""}
      </p>
      {children}
    </Card>
  );
}

/** Centered pulse line for loading states. */
export function LoadingLine({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="status"
      className={cn(
        "py-12 text-center font-heading text-title-sm font-bold animate-pulse motion-reduce:animate-none",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** StageFrame on the Duels accent. Every duel state renders inside it. */
export function DuelFrame({
  title,
  subtitle,
  onExit,
  score,
  progress,
  children,
}: {
  title?: string;
  subtitle?: string;
  onExit: () => void;
  score?: ReactNode;
  progress?: ReactNode;
  children: ReactNode;
}) {
  return (
    // The wrapper only carries `--mode-accent` (a CSS variable inherits
    // through the DOM, so the fixed frame inside picks it up).
    <div style={DUEL_ACCENT}>
      <StageFrame title={title} subtitle={subtitle} onExit={onExit} score={score} progress={progress}>
        {children}
      </StageFrame>
    </div>
  );
}

