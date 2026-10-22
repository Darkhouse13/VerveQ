import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useDrawT } from "./drawI18n";
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
 * S3 — round view (LAYOUT_SPEC "Round view" + Tickets F/G3/D1; budget notes
 * in layout.ts): fixture card w/ effect line + threshold, tap-to-bench squad
 * strip with form-hint chips (exactly one benched, changeable until CONFIRM),
 * synergy meters on the fielded five (while benching), the clearance meter /
 * score bar, the stake panel, then BANK / PUSH (sticky, so they stay on screen
 * if the stage scrolls). Score resolution is a STAGED LEDGER (Ticket G3 beats, D1
 * content): per-card contribution lines land one by one in engine order,
 * then YOUR FIVE, then one line per granted chain, then the total meets the
 * threshold after a deliberate tension beat, then CLEARED/BUSTED — pacing,
 * not latency theater; a tap skips it. Bust and full-clear states end here
 * with a CONTINUE out.
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
  const t = useDrawT();
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

  const coachMark = showIntroMark ? (
    <CoachMark
      id="introduced"
      seen={coach.seen}
      onDismiss={markIntroduced}
      onSkipAll={() => {
        coach.skipAll();
        markIntroduced();
      }}
    />
  ) : mode === "select" || mode === "decision" ? (
    <CoachMark
      id={mode === "select" ? selectCoachId : "decision"}
      seen={coach.seen}
      onDismiss={coach.dismiss}
      onSkipAll={coach.skipAll}
    />
  ) : null;

  return (
    <div
      className={cn("relative flex flex-col min-h-full md:grid md:grid-cols-2 md:items-start md:gap-x-6", punchClass)}
      style={{ rowGap: LAYOUT.sectionGap }}
      data-testid="draw-round-stage"
      // A tap during the staged reveal skips straight to the verdict.
      onPointerDown={pendingReveal ? finishReveal : undefined}
      data-revealing={pendingReveal ? "true" : undefined}
    >
      {/* Desktop: the fixture and its ledger on the left, the squad and the
          decision on the right. Phones: one column, same order. */}
      <div className="flex flex-col min-w-0" style={{ gap: LAYOUT.sectionGap }}>
        {/* Fixture card — archetype, effect line, modifiers, threshold. The
            resolution math is the staged ledger below. Tappable for the same
            sheet the strip opens (F1b). Wears THE DRAW's lime outline. */}
        <button
          type="button"
          onClick={() => setSheetFixture(fixture)}
          className="draw-outline-lime neo-border neo-shadow rounded-lg bg-card text-card-foreground flex flex-col justify-center gap-1.5 p-3 shrink-0 text-left w-full cursor-pointer active:neo-shadow-pressed"
          style={{ height: LAYOUT.fixtureCardH }}
          data-testid="draw-fixture-card"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-eyebrow text-muted-foreground">
              {t("round.fixture", { n: fixture.index + 1, total: rules.fixtureCount })}
            </span>
            <span className="flex items-center gap-1.5">
              {fixture.isBoss && (
                <Badge tone="yellow" shape="tag" className="shadow-none">
                  <Crown size={12} strokeWidth={3} aria-hidden="true" /> {t("round.boss")}
                </Badge>
              )}
              <Info size={14} strokeWidth={2.5} className="text-muted-foreground" aria-hidden="true" />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Icon size={22} strokeWidth={2.5} aria-hidden="true" />
            <span className="font-heading font-bold text-title leading-none truncate">{label}</span>
            <span className="ml-auto font-mono text-eyebrow text-muted-foreground shrink-0">
              {t("round.clearsAt")}
            </span>
            <span className="font-mono font-bold text-title-lg leading-none text-primary shrink-0">
              {fixture.threshold}
            </span>
          </div>

          {/* F1a — the effect in one line, above the exact multipliers. */}
          <p className="font-mono font-bold text-eyebrow tracking-normal" data-testid="draw-fixture-card-effect">
            {effectTokens(fixture).map((tk, i) => (
              <span key={i} className={cn("mr-2", tk.dir === "down" && "text-muted-foreground")}>
                {tk.label}
                {DIR_ARROW[tk.dir]}
              </span>
            ))}
          </p>

          <div className="flex flex-wrap gap-1">
            {fixture.modifiers.map((mod, i) => (
              <span
                key={i}
                className={cn(
                  "rounded-sm font-mono font-bold text-eyebrow tracking-normal leading-none px-1.5 py-1",
                  mod.mult >= 1 ? "bg-foreground text-background" : "bg-muted text-foreground",
                )}
              >
                {modifierLabel(mod)}
              </span>
            ))}
          </div>
        </button>

        {/* D1 — the staged resolution ledger. Present only for the fixture
            just played (never while benching the next one), at its full
            height from the first reveal frame so nothing below it moves as
            lines land. */}
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
      </div>

      <div className="flex flex-col min-w-0" style={{ gap: LAYOUT.sectionGap }}>
        {/* Tap-to-bench squad strip (Ticket 0.2 D2): before the reveal it is
            the bench selector — each chip carrying its form-hint glyph (G3) —
            after, the fielded five land one by one with their revealed form +
            contribution, the benched card visually on the bench. Long-press
            any chip for its detail sheet (F7). */}
        <div
          className="flex shrink-0"
          style={{ height: LAYOUT.benchStripH, gap: LAYOUT.squadChipGap }}
          data-testid="draw-bench-strip"
        >
          {view.squad.map((card, i) => {
            const benchedNow = mode === "select" ? selected === i : lastRound?.benchedCardId === card.id;
            const stat = perCard.get(card.id);
            const statShown = stat !== undefined && (!pendingReveal || revealStep > stat.order);
            const hint = hintByCard?.[card.id];
            return (
              <div key={card.id} className="relative flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
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
                    "relative neo-border rounded-lg bg-card text-card-foreground flex flex-col items-center justify-center gap-0.5 min-w-0 px-0.5 touch-none",
                    mode === "select" && "cursor-pointer neo-shadow-sm active:neo-shadow-pressed",
                    benchedNow && "draw-benched",
                  )}
                  style={{ height: 64 }}
                  data-testid={`draw-squad-chip-${i}`}
                >
                  {/* D2 — form icons withheld on the first-run bench strip
                      until the fixture-1 introduction (render-level, not CSS). */}
                  {hint !== undefined && introduced && (
                    <span
                      className="absolute top-0.5 right-0.5 text-eyebrow leading-none"
                      data-testid={`draw-hint-chip-${i}`}
                      data-hint={hint}
                      aria-label={t(`round.hint.${hint}`)}
                    >
                      {HINT_GLYPH[hint]}
                    </span>
                  )}
                  <span className="font-mono font-bold text-body leading-none">{card.rating}</span>
                  <span className="font-mono text-eyebrow tracking-normal leading-none text-muted-foreground">
                    {card.position}
                  </span>
                  {statShown && stat && (
                    <span
                      className="font-mono font-bold text-eyebrow tracking-normal leading-none draw-reveal-land"
                      data-testid={`draw-contribution-${i}`}
                    >
                      {stat.form >= 1 ? "▲" : "▼"}
                      {Math.round(stat.contribution)}
                    </span>
                  )}
                </button>
                <div className="h-5 relative">
                  {benchedNow && (
                    // Wider than its 52px column: centred and allowed to
                    // overhang, over the neighbours' always-empty badge rows.
                    <span
                      className={cn(
                        "absolute top-0 whitespace-nowrap",
                        // The end chips anchor their badge to the strip's edge.
                        i === 0 ? "left-0" : i === view.squad.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                      )}
                      data-badge="benched"
                    >
                      <span
                        className="block rounded-sm bg-foreground text-background font-mono font-bold text-eyebrow tracking-normal leading-none px-1.5 py-1"
                        data-testid={`draw-benched-badge-${i}`}
                      >
                        {t("round.benched")}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* The meters preview the five a bench choice would field. Once a
            round resolves, the ledger itemises the chains that were granted,
            so the meters give their slot to it (layout.ts). */}
        {mode === "select" && <SynergyMeters cards={meterCards} synergyTable={rules.synergyTable} />}

        {/* One 56px slot: the clearance meter while choosing (G3 — the coarse
            SAFE/TIGHT/LONGSHOT read that replaced the exact band), the
            resolved score once the staged reveal reaches the total. */}
        {mode === "select" && selected !== null ? (
          <ClearanceMeter fielded={meterCards} fixture={fixture} rules={rules} />
        ) : (
          <div
            className="draw-border-quiet neo-border rounded-lg bg-card flex flex-col justify-center px-3 shrink-0"
            style={{ height: LAYOUT.thresholdBarH }}
            data-testid="draw-threshold-bar"
          >
            <div className="flex items-center justify-between font-mono font-bold text-body-sm mb-1">
              <span data-testid="draw-round-score">{score === null ? "—" : Math.round(score)}</span>
              <span className="text-muted-foreground">/ {fixture.threshold}</span>
            </div>
            <div className="neo-border rounded-full h-3.5 bg-muted overflow-hidden">
              <div
                className={cn(
                  "draw-bar-fill h-full rounded-full",
                  score === null
                    ? "bg-muted"
                    : verdictShown
                      ? lastRound?.cleared
                        ? "bg-verdict-right"
                        : "bg-verdict-wrong"
                      : "bg-foreground",
                )}
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        )}

        {/* F3b — the stake. Reserved at a fixed height so BANK / PUSH never
            move under a thumb when the reveal lands (see layout.ts). */}
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
              label={t("round.ifYouPush")}
              testId="draw-push-meter"
            />
          )}
          <div className="flex items-center justify-between px-1 font-mono text-eyebrow">
            <span>
              {t("round.banked")}{" "}
              <span className="font-bold text-body-sm" data-testid="draw-stake-banked">
                {Math.round(view.cumulative)}
              </span>
            </span>
            <span className="text-muted-foreground">
              {t("round.bustKeeps")}{" "}
              <span className="font-bold text-body-sm text-foreground" data-testid="draw-stake-bust">
                {bustKeepValue(view.cumulative, rules)}
              </span>
            </span>
          </div>
        </div>

        {/* Decision slot: CONFIRM (bench) → resolving → BANK / PUSH, or the
            bust / full-clear exit. Sticky to the bottom of the scrolling
            stage, so it stays on screen when a long ledger runs the stack
            past a short phone's fold. */}
        <div
          className="sticky bottom-0 z-raised shrink-0 bg-background"
          style={{ height: LAYOUT.bankPushButtonsH }}
          data-testid="draw-decision-panel"
        >
          {mode === "select" && (
            <Button
              variant="primary"
              className="w-full h-full"
              disabled={selected === null || locked}
              onClick={() => selected !== null && onBench(selected)}
              data-testid="draw-confirm-bench"
            >
              {selected === null ? t("round.tapToBench") : t("round.confirm")}
            </Button>
          )}
          {mode === "reveal" && (
            <Button variant="secondary" className="w-full h-full" disabled>
              {t("round.resolving")}
            </Button>
          )}
          {mode === "decision" && (
            // Neither choice is THE action — the gamble is the player's, so
            // both are secondary; PUSH wears the mode's lime outline.
            <div className="grid grid-cols-2 gap-3 h-full">
              <Button
                variant="secondary"
                className="h-full flex-col gap-0 px-2"
                disabled={locked}
                onClick={() => {
                  // D2.1 — leaving the fixture-1 decision with the intro mark
                  // up still counts as introduced (the mark promised "live
                  // from now on"): un-hide for the next board even though
                  // BANK ends the run.
                  if (showIntroMark) markIntroduced();
                  coach.dismiss("decision");
                  onBank();
                }}
                data-testid="draw-bank"
              >
                <span>{t("round.bank")}</span>
                <span className="font-mono text-eyebrow tracking-normal font-normal truncate max-w-full">
                  {t("round.pts", { n: Math.round(view.cumulative) })}
                </span>
              </Button>
              <Button
                variant="secondary"
                className="draw-outline-lime h-full flex-col gap-0 px-2"
                disabled={locked}
                onClick={() => {
                  // D2.1 — same as BANK: seeing the intro mark and pushing on
                  // completes the introduction, so the fit strip / form icons
                  // are live from fixture 2 onward, never re-hidden nor
                  // re-taught.
                  if (showIntroMark) markIntroduced();
                  coach.dismiss("decision");
                  onPush();
                }}
                data-testid="draw-push"
              >
                <span>{t("round.push")}</span>
                <span className="font-mono text-eyebrow tracking-normal font-normal truncate max-w-full">
                  {nextFixture ? t("round.nextClearsAt", { n: nextFixture.threshold }) : ""}
                </span>
              </Button>
            </div>
          )}
          {mode === "done" && (
            <Button variant="primary" className="w-full h-full" onClick={onContinue} data-testid="draw-continue">
              {view.outcome === "busted"
                ? t("round.seeResultBusted")
                : view.outcome === "fullclear"
                  ? t("round.seeResultFullClear")
                  : t("round.seeResult")}
            </Button>
          )}
        </div>

        {/* D2 — at the fixture-1 trigger the introduction takes the slot; its
            GOT IT / SKIP ALL both complete the intro (write the sentinel),
            which un-hides the form icons and fit strip for the rest of the
            run and forever after. Otherwise the usual per-surface mark: the
            bench and bank/push marks land directly under the control they
            describe. In flow — see CoachMark. */}
        {coachMark}
      </div>

      <FixtureSheet
        fixture={sheetFixture}
        fixtureCount={rules.fixtureCount}
        onClose={() => setSheetFixture(null)}
      />
      <CardDetailSheet card={sheetCard} onClose={() => setSheetCard(null)} />
    </div>
  );
}

