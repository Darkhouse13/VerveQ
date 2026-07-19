import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { NeoButton } from "@/components/neo/NeoButton";
import type { Card, Fixture, FormHint, RoundBreakdown } from "@/lib/drawEngine";
import type { DrawRules, DrawRunView } from "@/lib/drawApi/types";
import { archetypeMeta, modifierLabel } from "./meta";
import { DIR_ARROW, effectTokens } from "./fixtureEffects";
import { bustKeepValue } from "./projection";
import { ClearanceMeter } from "./ClearanceMeter";
import { ResolutionLedger } from "./ResolutionLedger";
import { FixtureSheet } from "./FixtureSheet";
import { CardDetailSheet } from "./CardDetailSheet";
import { CoachMark } from "./CoachMark";
import { COACH_IDS, useCoachMarks, useDrawIntro } from "./coachMarks";
import { SynergyMeters } from "./SynergyMeters";
import { DECISION_INFO_H, LAYOUT } from "./layout";

type RoundMode = "select" | "reveal" | "decision" | "done";

interface RoundStageProps {
  view: DrawRunView;
  rules: DrawRules;
  locked: boolean;
  /**
   * Ticket G3 reveal staging: per-beat duration of the staged resolution
   * (contributions land one by one, multiplier stamps, total, verdict —
   * ~2.5–3.5s all in, skippable on tap). Tests pass 0 for an instant reveal.
   */
  revealMs?: number;
  onBench: (squadIndex: number) => void;
  onBank: () => void;
  onPush: () => void;
  /** Run is done (bust / bank via decision elsewhere / full clear) — leave. */
  onContinue: () => void;
}

/** Long-press opens a card's detail without firing its bench tap (F7). */
const LONG_PRESS_MS = 450;

/** Ticket G3 — hint chip glyphs (🔥 / — / ❄). */
const HINT_GLYPH: Record<FormHint, string> = {
  HOT: "🔥",
  NEUTRAL: "—",
  COLD: "❄",
};

/**
 * S3 — round view (LAYOUT_SPEC "Round view" + Tickets F/G3/D1, 628px of the
 * 812px budget + the ledger's ≤158px, 786px worst case): fixture card w/
 * effect line + threshold, tap-to-bench squad strip with form-hint chips
 * (exactly one benched, changeable until CONFIRM), synergy meters on the
 * fielded five, the clearance meter / score bar, the stake panel, then
 * BANK / PUSH. Score resolution is a STAGED LEDGER (Ticket G3 beats, D1
 * content): per-card contribution lines land one by one in engine order,
 * then YOUR FIVE, then one line per granted chain, then the total meets the
 * threshold after a deliberate tension beat, then CLEARED/BUSTED — pacing,
 * not latency theater; a tap skips it. Bust and full-clear states end here
 * with a CONTINUE out. No scroll.
 */
export function RoundStage({
  view,
  rules,
  locked,
  revealMs = 380,
  onBench,
  onBank,
  onPush,
  onContinue,
}: RoundStageProps) {
  // Rounds already shown to the player. Initialized to the mounted view so a
  // resumed run (reload mid-decision) doesn't replay the reveal animation.
  const [seenRounds, setSeenRounds] = useState(() => view.rounds.length);
  const [revealStep, setRevealStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [sheetFixture, setSheetFixture] = useState<Fixture | null>(null);
  const [sheetCard, setSheetCard] = useState<Card | null>(null);
  const coach = useCoachMarks();
  // D2 — first-run de-noising. `introduced` is false for a first-run player
  // until the intro mark lands (after fixture 1 resolves): while false the
  // bench form icons stay hidden and the intro mark is armed.
  const { introduced, markIntroduced } = useDrawIntro();

  const pendingReveal = view.rounds.length > seenRounds;
  const lastRound: RoundBreakdown | null = view.rounds[view.rounds.length - 1] ?? null;
  const fieldedCount = lastRound?.cards.length ?? 0;
  // D1 — granted chains each get their own beat between YOUR FIVE and the
  // total. synergies[] only ever carries granted families (engine contract),
  // so payload order IS display order.
  const chainCount = lastRound?.synergies.length ?? 0;
  // Beats: one per fielded card, then YOUR FIVE, then one per granted chain,
  // then the total, then the verdict. The verdict beat is deliberately longer
  // (see effect below).
  const revealSteps = fieldedCount + chainCount + 3;

  const finishReveal = useCallback(() => {
    setSeenRounds(view.rounds.length);
    setRevealStep(0);
  }, [view.rounds.length]);

  // D1 — honor the OS reduce-motion setting the same way revealMs 0 does:
  // every beat lands at once and the CSS kills the entrance animations. The
  // rendered ledger is identical, only the staging is skipped.
  const reducedMotion = useMemo(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (!pendingReveal) return;
    if (revealMs === 0 || reducedMotion) {
      finishReveal();
      return;
    }
    if (revealStep >= revealSteps) {
      // The beat after CLEARED/BUSTED lands — long enough to read the verdict.
      const timer = window.setTimeout(finishReveal, revealMs * 1.6);
      return () => window.clearTimeout(timer);
    }
    // The pause BEFORE the total meets the threshold is the tension beat.
    const beat = revealStep === fieldedCount + 1 + chainCount ? revealMs * 1.4 : revealMs;
    const timer = window.setTimeout(() => setRevealStep((s) => s + 1), beat);
    return () => window.clearTimeout(timer);
  }, [pendingReveal, revealStep, revealSteps, revealMs, fieldedCount, chainCount, finishReveal, reducedMotion]);

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

  // Reveal staging visibility gates (the ledger reads the same beats for its
  // card/base/chain lines). Outside a pending reveal everything is shown
  // (resumed runs, decision phase, done states).
  const totalShown = !pendingReveal || revealStep > fieldedCount + 1 + chainCount;
  const verdictShown = !pendingReveal || revealStep >= revealSteps;

  // D2 — the first-run introduction fires ONCE, at the trigger point: fixture 1
  // resolved (decision phase, verdict landed — the tap-skip path reaches the
  // same state). It teaches both form icons and the fit strip, which the ledger
  // has just demonstrated with real numbers.
  const skippedAllCoaching = COACH_IDS.every((id) => coach.seen.has(id));
  const atIntroTrigger = !introduced && mode === "decision" && verdictShown;
  const showIntroMark = atIntroTrigger && !skippedAllCoaching;

  // If the player already chose SKIP ALL, the mark is suppressed — but the
  // introduction still COMPLETES at the trigger: sentinel written, UI un-hidden.
  useEffect(() => {
    if (atIntroTrigger && skippedAllCoaching) markIntroduced();
  }, [atIntroTrigger, skippedAllCoaching, markIntroduced]);

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
  const score = resolved && totalShown ? lastRound!.score : null;
  const fillPct = score === null ? 0 : Math.min((score / fixture.threshold) * 100, 115);

  const perCard = useMemo(() => {
    const map = new Map<string, { contribution: number; form: number; order: number }>();
    if (resolved && lastRound) {
      lastRound.cards.forEach((c, order) =>
        map.set(c.cardId, { contribution: c.contribution, form: c.form, order }),
      );
    }
    return map;
  }, [resolved, lastRound]);

  const nextFixture = view.fixtures[view.fixtureIndex + 1] ?? null;

  /**
   * Ticket G3 — the hint chips' source: the served entry for the fixture the
   * chips describe (the one being benched for, or the next one at a
   * decision). Never derived client-side — hints are seeded server-side.
   */
  const hintByCard: Record<string, FormHint> | null = useMemo(() => {
    const wanted =
      mode === "select" ? view.fixtureIndex : mode === "decision" ? view.fixtureIndex + 1 : null;
    if (wanted === null) return null;
    return view.hints?.find((h) => h.fixtureIndex === wanted)?.byCard ?? null;
  }, [mode, view.fixtureIndex, view.hints]);

  // ── F7 long-press ────────────────────────────────────────────────────────
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const clearPress = useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const startPress = useCallback(
    (card: Card) => {
      longPressed.current = false;
      clearPress();
      pressTimer.current = window.setTimeout(() => {
        longPressed.current = true;
        setSheetCard(card);
      }, LONG_PRESS_MS);
    },
    [clearPress],
  );

  useEffect(() => clearPress, [clearPress]);

  const tapChip = (index: number) => {
    // A long-press already opened the sheet — don't also bench the card.
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (mode !== "select" || locked) return;
    coach.dismiss("bench");
    setSelected(index);
  };

  // Ticket G3 — the ONE hint coach mark, first run only: it takes the bench
  // slot once the bench mark has been dismissed and hints are on the table.
  // D2 — the "hints are rumors" mark teaches the form icons, so it can't fire
  // while they are still hidden on a first run: the intro mark introduces them.
  const hintsAvailable = hintByCard !== null;
  const selectCoachId =
    coach.seen.has("bench") && hintsAvailable && introduced
      ? ("hints" as const)
      : ("bench" as const);

  // Ticket G3 — bust / full-clear get their own punch once the verdict lands.
  const punchClass =
    mode !== "select" && verdictShown && view.phase === "done"
      ? view.outcome === "busted"
        ? "draw-punch-bust"
        : view.outcome === "fullclear"
          ? "draw-punch-clear"
          : undefined
      : undefined;

  return (
    <div
      className={cn("relative flex flex-col flex-1 min-h-0", punchClass)}
      style={{ gap: LAYOUT.sectionGap }}
      data-testid="draw-round-stage"
      // A tap during the staged reveal skips straight to the verdict.
      onPointerDown={pendingReveal ? finishReveal : undefined}
      data-revealing={pendingReveal ? "true" : undefined}
    >
      {/* Fixture card — archetype, effect line, modifiers, threshold. The
          resolution math moved OUT of this card in D1: it is the staged
          ledger below (form revealed per card in the strip as well).
          Tappable for the same sheet the strip opens (F1b). */}
      <button
        type="button"
        onClick={() => setSheetFixture(fixture)}
        className="draw-surface-dark neo-border neo-shadow rounded-lg bg-card flex flex-col p-3 shrink-0 text-left w-full cursor-pointer active:neo-shadow-pressed"
        style={{ height: LAYOUT.fixtureCardH }}
        data-testid="draw-fixture-card"
      >
        <div className="flex items-center justify-between">
          <span className="font-heading font-bold text-[10px] tracking-wide text-muted-foreground">
            FIXTURE {fixture.index + 1}/{rules.fixtureCount}
          </span>
          <span className="flex items-center gap-1">
            {fixture.isBoss && (
              <span className="neo-border rounded bg-yellow text-yellow-foreground font-heading font-bold text-[9px] px-1.5 py-0.5 inline-flex items-center gap-1">
                <Crown size={10} strokeWidth={3} /> BOSS
              </span>
            )}
            <Info size={12} strokeWidth={3} className="text-muted-foreground" />
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Icon size={22} strokeWidth={2.5} />
          <span className="font-heading font-bold text-xl leading-none">{label}</span>
          <span className="ml-auto font-heading font-bold text-[9px] text-muted-foreground">
            CLEAR AT
          </span>
          <span className="font-mono font-bold text-2xl leading-none text-accent">{fixture.threshold}</span>
        </div>

        {/* F1a — the effect in one line, above the exact multipliers. */}
        <p
          className="font-mono font-bold text-[11px] mt-1.5"
          data-testid="draw-fixture-card-effect"
        >
          {effectTokens(fixture).map((t, i) => (
            <span
              key={i}
              className={cn(
                "mr-2",
                t.dir === "up"
                  ? "text-success"
                  : t.dir === "down"
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {t.label}
              {DIR_ARROW[t.dir]}
            </span>
          ))}
        </p>

        <div className="flex flex-wrap gap-1 mt-1">
          {fixture.modifiers.map((mod, i) => (
            <span
              key={i}
              className={cn(
                "neo-border rounded font-mono font-bold text-[9px] px-1.5 py-0.5",
                mod.mult >= 1 ? "bg-accent text-accent-foreground" : "bg-muted text-foreground",
              )}
            >
              {modifierLabel(mod)}
            </span>
          ))}
        </div>
      </button>

      {/* D1 — the staged resolution ledger. Present only for the fixture just
          played (never while benching the next one), at its full height from
          the first reveal frame so nothing below it moves as lines land. */}
      {resolved && lastRound && (
        <ResolutionLedger
          round={lastRound}
          squad={view.squad}
          fixtureLabel={label}
          pendingReveal={pendingReveal}
          revealStep={revealStep}
          totalShown={totalShown}
          verdictShown={verdictShown}
        />
      )}

      {/* Tap-to-bench squad strip (Ticket 0.2 D2): before the reveal it is the
          bench selector — each chip carrying its form-hint glyph (G3) — after,
          the fielded five land one by one with their revealed form +
          contribution, the benched card visually on the bench. Long-press any
          chip for its detail sheet (F7). */}
      <div
          className="flex shrink-0"
          style={{ height: LAYOUT.benchStripH, gap: LAYOUT.squadChipGap }}
          data-testid="draw-bench-strip"
        >
          {view.squad.map((card, i) => {
            const benchedNow = mode === "select" ? selected === i : lastRound?.benchedCardId === card.id;
            const stat = perCard.get(card.id);
            const statShown =
              stat !== undefined && (!pendingReveal || revealStep > stat.order);
            const hint = hintByCard?.[card.id];
            return (
              <div key={card.id} className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => tapChip(i)}
                  onPointerDown={() => startPress(card)}
                  onPointerUp={clearPress}
                  onPointerLeave={clearPress}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-pressed={mode === "select" ? selected === i : undefined}
                  className={cn(
                    "relative neo-border rounded-lg bg-card flex flex-col items-center justify-center min-w-0 px-0.5 touch-none",
                    mode === "select" && "cursor-pointer neo-shadow-sm active:neo-shadow-pressed",
                    benchedNow && "draw-benched",
                  )}
                  style={{ height: 64 }}
                  data-testid={`draw-squad-chip-${i}`}
                >
                  {/* D2 — form icons withheld on the first-run bench strip until
                      the fixture-1 introduction (render-level, not CSS). */}
                  {hint !== undefined && introduced && (
                    <span
                      className="absolute top-0.5 right-0.5 text-[9px] leading-none"
                      data-testid={`draw-hint-chip-${i}`}
                      data-hint={hint}
                      aria-label={`form hint: ${hint.toLowerCase()}`}
                    >
                      {HINT_GLYPH[hint]}
                    </span>
                  )}
                  <span className="font-mono font-bold text-base leading-none">{card.rating}</span>
                  <span className="font-heading font-bold text-[8px] leading-tight text-muted-foreground">
                    {card.position}
                  </span>
                  {statShown && stat && (
                    <span
                      className="font-mono font-bold text-[9px] leading-none draw-reveal-land"
                      data-testid={`draw-contribution-${i}`}
                    >
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

      {/* One 56px slot: the clearance meter while choosing (G3 — the coarse
          SAFE/TIGHT/LONGSHOT read that replaced the exact band), the resolved
          score once the staged reveal reaches the total. */}
      {mode === "select" && selected !== null ? (
        <ClearanceMeter fielded={meterCards} fixture={fixture} rules={rules} label="YOUR FIVE" />
      ) : (
        <div
          className="draw-surface-dark draw-border-quiet neo-border rounded-lg bg-card flex flex-col justify-center px-3 shrink-0"
          style={{ height: LAYOUT.thresholdBarH }}
          data-testid="draw-threshold-bar"
        >
          <div className="flex items-center justify-between font-mono font-bold text-[11px] mb-1">
            <span data-testid="draw-round-score">{score === null ? "—" : Math.round(score)}</span>
            <span className="text-muted-foreground">/ {fixture.threshold}</span>
          </div>
          <div className="draw-bar-track neo-border rounded-full h-3.5 bg-muted overflow-hidden">
            <div
              className={cn(
                "draw-bar-fill h-full rounded-full",
                score === null
                  ? "bg-muted"
                  : verdictShown
                    ? lastRound?.cleared
                      ? "bg-success"
                      : "bg-destructive"
                    : "bg-accent",
              )}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      )}

      {/* F3b — the stake. Reserved at a fixed height so BANK / PUSH never move
          under a thumb when the reveal lands (see layout.ts). */}
      <div
        className="shrink-0 flex flex-col justify-center"
        style={{ height: DECISION_INFO_H, gap: 4 }}
        data-testid="draw-stake-panel"
      >
        {mode === "decision" && nextFixture !== null && (
          <ClearanceMeter
            fielded={meterCards}
            fixture={nextFixture}
            rules={rules}
            label="IF YOU PUSH"
            testId="draw-push-meter"
          />
        )}
        <div className="flex items-center justify-between px-1">
          <span className="font-heading font-bold text-[10px] tracking-wide">
            BANKED{" "}
            <span className="font-mono text-xs" data-testid="draw-stake-banked">
              {Math.round(view.cumulative)}
            </span>
          </span>
          <span className="font-heading font-bold text-[10px] tracking-wide text-muted-foreground">
            BUST KEEPS{" "}
            <span className="font-mono text-xs text-destructive" data-testid="draw-stake-bust">
              {bustKeepValue(view.cumulative, rules)}
            </span>
          </span>
        </div>
      </div>

      {/* Decision slot: CONFIRM (bench) → resolving → BANK / PUSH, or the
          bust / full-clear exit. */}
      <div
        className="relative shrink-0"
        style={{ height: LAYOUT.bankPushButtonsH }}
        data-testid="draw-decision-panel"
      >
        <div className="h-full">
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
                onClick={() => {
                  // D2.1 — leaving the fixture-1 decision with the intro mark up
                  // still counts as introduced (the mark promised "live from now
                  // on"): un-hide for the next board even though BANK ends the run.
                  if (showIntroMark) markIntroduced();
                  coach.dismiss("decision");
                  onBank();
                }}
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
                onClick={() => {
                  // D2.1 — same as BANK: seeing the intro mark and pushing on
                  // completes the introduction, so the fit strip / form icons are
                  // live from fixture 2 onward, never re-hidden nor re-taught.
                  if (showIntroMark) markIntroduced();
                  coach.dismiss("decision");
                  onPush();
                }}
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

      {/* Pinned to the stage's bottom slack — see CoachMark. The bench and
          bank/push marks land directly under the button they describe; the
          hint mark (G3, one, first-run) takes the bench slot once the bench
          mark is dismissed and hint chips are visible. */}
      {/* D2 — at the fixture-1 trigger the introduction takes the slot; its
          GOT IT / SKIP ALL both complete the intro (write the sentinel), which
          un-hides the form icons and fit strip for the rest of the run and
          forever after. Otherwise the usual per-surface mark. */}
      {showIntroMark ? (
        <CoachMark
          id="introduced"
          seen={coach.seen}
          onDismiss={markIntroduced}
          onSkipAll={() => {
            coach.skipAll();
            markIntroduced();
          }}
        />
      ) : (
        (mode === "select" || mode === "decision") && (
          <CoachMark
            id={mode === "select" ? selectCoachId : "decision"}
            seen={coach.seen}
            onDismiss={coach.dismiss}
            onSkipAll={coach.skipAll}
          />
        )
      )}

      <FixtureSheet
        fixture={sheetFixture}
        fixtureCount={rules.fixtureCount}
        onClose={() => setSheetFixture(null)}
      />
      <CardDetailSheet card={sheetCard} onClose={() => setSheetCard(null)} />
    </div>
  );
}
