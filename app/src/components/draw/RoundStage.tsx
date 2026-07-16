import { useEffect, useMemo, useState } from "react";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NeoButton } from "@/components/neo/NeoButton";
import type { Card, RoundBreakdown } from "@/lib/drawEngine";
import type { DrawRules, DrawRunView } from "@/lib/drawApi/types";
import { archetypeMeta, modifierLabel, formatMult } from "./meta";
import { SynergyMeters } from "./SynergyMeters";
import { LAYOUT } from "./layout";

type RoundMode = "select" | "reveal" | "decision" | "done";

interface RoundStageProps {
  view: DrawRunView;
  rules: DrawRules;
  locked: boolean;
  /** Reveal beat before the decision panel appears; tests pass 0. */
  revealMs?: number;
  onBench: (squadIndex: number) => void;
  onBank: () => void;
  onPush: () => void;
  /** Run is done (bust / bank via decision elsewhere / full clear) — leave. */
  onContinue: () => void;
}

/**
 * S3 — round view (LAYOUT_SPEC "Round view", 540px of the 812px budget):
 * fixture card w/ modifiers + threshold, tap-to-bench squad strip (exactly
 * one benched, changeable until CONFIRM), synergy meters on the fielded five,
 * score-vs-threshold bar, then BANK / PUSH. Bust and full-clear states end
 * here with a CONTINUE out. No scroll.
 */
export function RoundStage({
  view,
  rules,
  locked,
  revealMs = 900,
  onBench,
  onBank,
  onPush,
  onContinue,
}: RoundStageProps) {
  // Rounds already shown to the player. Initialized to the mounted view so a
  // resumed run (reload mid-decision) doesn't replay the reveal animation.
  const [seenRounds, setSeenRounds] = useState(() => view.rounds.length);
  const [selected, setSelected] = useState<number | null>(null);

  const pendingReveal = view.rounds.length > seenRounds;
  useEffect(() => {
    if (!pendingReveal) return;
    const timer = window.setTimeout(() => setSeenRounds(view.rounds.length), revealMs);
    return () => window.clearTimeout(timer);
  }, [pendingReveal, view.rounds.length, revealMs]);

  // A new fixture (after PUSH) starts with a clean bench choice.
  useEffect(() => {
    setSelected(null);
  }, [view.fixtureIndex]);

  const mode: RoundMode = pendingReveal
    ? "reveal"
    : view.phase === "bench"
      ? "select"
      : view.phase === "decision"
        ? "decision"
        : "done";

  const lastRound: RoundBreakdown | null = view.rounds[view.rounds.length - 1] ?? null;
  // In select mode the strip/bar frame the UPCOMING fixture; once a round has
  // resolved they show the fixture just played.
  const shownFixtureIndex =
    mode === "select" || lastRound === null ? view.fixtureIndex : lastRound.fixtureIndex;
  const fixture = view.fixtures[shownFixtureIndex];
  const { label, Icon } = archetypeMeta(fixture.archetypeId);

  // Synergy meters run on the FIELDED five (engine contract A2). While
  // choosing, they preview the field implied by the current bench selection.
  const meterCards: Card[] = useMemo(() => {
    if (mode === "select") {
      return selected === null ? view.squad : view.squad.filter((_, i) => i !== selected);
    }
    if (lastRound === null) return view.squad;
    return view.squad.filter((card) => card.id !== lastRound.benchedCardId);
  }, [mode, selected, view.squad, lastRound]);

  const resolved = mode !== "select" && lastRound !== null;
  const score = resolved ? lastRound.score : null;
  const fillPct =
    score === null ? 0 : Math.min((score / fixture.threshold) * 100, 115);

  const perCard = useMemo(() => {
    const map = new Map<string, { contribution: number; form: number }>();
    if (resolved && lastRound) {
      for (const c of lastRound.cards) map.set(c.cardId, { contribution: c.contribution, form: c.form });
    }
    return map;
  }, [resolved, lastRound]);

  const nextFixture = view.fixtures[view.fixtureIndex + 1] ?? null;

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ gap: LAYOUT.sectionGap }}
      data-testid="draw-round-stage"
    >
      {/* Fixture card — archetype, modifiers, threshold; resolution math once
          the round has played (form revealed per card in the strip below). */}
      <div
        className="neo-border neo-shadow rounded-lg bg-card flex flex-col p-3 shrink-0"
        style={{ height: LAYOUT.fixtureCardH }}
        data-testid="draw-fixture-card"
      >
        <div className="flex items-center justify-between">
          <span className="font-heading font-bold text-[10px] tracking-wide text-muted-foreground">
            FIXTURE {fixture.index + 1}/{rules.fixtureCount}
          </span>
          {fixture.isBoss && (
            <span className="neo-border rounded bg-yellow text-yellow-foreground font-heading font-bold text-[9px] px-1.5 py-0.5 inline-flex items-center gap-1">
              <Crown size={10} strokeWidth={3} /> BOSS
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Icon size={22} strokeWidth={2.5} />
          <span className="font-heading font-bold text-xl leading-none">{label}</span>
          <span className="ml-auto font-heading font-bold text-[9px] text-muted-foreground">
            CLEAR AT
          </span>
          <span className="font-mono font-bold text-2xl leading-none">{fixture.threshold}</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {fixture.modifiers.map((mod, i) => (
            <span
              key={i}
              className={cn(
                "neo-border rounded font-mono font-bold text-[9px] px-1.5 py-0.5",
                mod.mult >= 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {modifierLabel(mod)}
            </span>
          ))}
        </div>
        {resolved && lastRound && (
          <p className="font-mono font-bold text-[11px] mt-auto" data-testid="draw-round-math">
            {Math.round(lastRound.baseSum)} {formatMult(lastRound.synergyMult)} ={" "}
            <span className={lastRound.cleared ? "text-success" : "text-destructive"}>
              {Math.round(lastRound.score)}
            </span>{" "}
            {lastRound.cleared ? "CLEARED" : "FAILED"}
          </p>
        )}
      </div>

      {/* Tap-to-bench squad strip (Ticket 0.2 D2): before the reveal it is the
          bench selector; after, it shows the fielded five with their revealed
          form + contribution, the benched card visually on the bench. */}
      <div
        className="flex shrink-0"
        style={{ height: LAYOUT.benchStripH, gap: LAYOUT.squadChipGap }}
        data-testid="draw-bench-strip"
      >
        {view.squad.map((card, i) => {
          const benchedNow = mode === "select" ? selected === i : lastRound?.benchedCardId === card.id;
          const stat = perCard.get(card.id);
          return (
            <div key={card.id} className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
              <button
                type="button"
                disabled={mode !== "select" || locked}
                onClick={() => setSelected(i)}
                aria-pressed={mode === "select" ? selected === i : undefined}
                className={cn(
                  "neo-border rounded-lg bg-card flex flex-col items-center justify-center min-w-0 px-0.5",
                  mode === "select" && "cursor-pointer neo-shadow-sm active:neo-shadow-pressed",
                  benchedNow && "draw-benched",
                )}
                style={{ height: 64 }}
                data-testid={`draw-squad-chip-${i}`}
              >
                <span className="font-mono font-bold text-base leading-none">{card.rating}</span>
                <span className="font-heading font-bold text-[8px] leading-tight text-muted-foreground">
                  {card.position}
                </span>
                {stat && (
                  <span className="font-mono font-bold text-[9px] leading-none">
                    {stat.form >= 1 ? "▲" : "▼"}
                    {Math.round(stat.contribution)}
                  </span>
                )}
              </button>
              <div className="h-5 flex items-start justify-center">
                {benchedNow && (
                  <span
                    className="neo-border rounded bg-foreground text-background font-heading font-bold text-[7px] px-1 py-0.5 tracking-wide"
                    data-testid={`draw-benched-badge-${i}`}
                  >
                    BENCHED
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <SynergyMeters cards={meterCards} synergyTable={rules.synergyTable} />

      {/* Score-vs-threshold bar (animated fill). */}
      <div
        className="neo-border rounded-lg bg-card flex flex-col justify-center px-3 shrink-0"
        style={{ height: LAYOUT.thresholdBarH }}
        data-testid="draw-threshold-bar"
      >
        <div className="flex items-center justify-between font-mono font-bold text-[11px] mb-1">
          <span data-testid="draw-round-score">{score === null ? "—" : Math.round(score)}</span>
          <span className="text-muted-foreground">/ {fixture.threshold}</span>
        </div>
        <div className="neo-border rounded-full h-3.5 bg-muted overflow-hidden">
          <div
            className={cn(
              "draw-bar-fill h-full rounded-full",
              score === null
                ? "bg-muted"
                : lastRound?.cleared
                  ? "bg-success"
                  : "bg-destructive",
            )}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {/* Decision slot: CONFIRM (bench) → resolving → BANK / PUSH, or the
          bust / full-clear exit. */}
      <div className="shrink-0" style={{ height: LAYOUT.bankPushButtonsH }} data-testid="draw-decision-panel">
        {mode === "select" && (
          <NeoButton
            variant="primary"
            className="w-full h-full"
            disabled={selected === null || locked}
            onClick={() => selected !== null && onBench(selected)}
            data-testid="draw-confirm-bench"
          >
            {selected === null ? "TAP A CARD TO BENCH" : "CONFIRM XI"}
          </NeoButton>
        )}
        {mode === "reveal" && (
          <NeoButton variant="secondary" className="w-full h-full" disabled>
            RESOLVING…
          </NeoButton>
        )}
        {mode === "decision" && (
          <div className="grid grid-cols-2 gap-3 h-full">
            <NeoButton
              variant="success"
              className="h-full flex-col gap-0"
              disabled={locked}
              onClick={onBank}
              data-testid="draw-bank"
            >
              <span>BANK</span>
              <span className="font-mono text-[10px] normal-case">
                {Math.round(view.cumulative)} pts
              </span>
            </NeoButton>
            <NeoButton
              variant="accent"
              className="h-full flex-col gap-0"
              disabled={locked}
              onClick={onPush}
              data-testid="draw-push"
            >
              <span>PUSH</span>
              <span className="font-mono text-[10px] normal-case">
                {nextFixture ? `next clears at ${nextFixture.threshold}` : ""}
              </span>
            </NeoButton>
          </div>
        )}
        {mode === "done" && (
          <NeoButton
            variant={view.outcome === "busted" ? "danger" : view.outcome === "fullclear" ? "yellow" : "success"}
            className="w-full h-full"
            onClick={onContinue}
            data-testid="draw-continue"
          >
            {view.outcome === "busted"
              ? "BUSTED — SEE RESULT"
              : view.outcome === "fullclear"
                ? "FULL CLEAR — SEE RESULT"
                : "SEE RESULT"}
          </NeoButton>
        )}
      </div>
    </div>
  );
}
