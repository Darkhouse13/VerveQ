import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Card, Fixture } from "@/lib/drawEngine";
import type { DrawRules, DrawRunView } from "@/lib/drawApi/types";
import { Button } from "@/components/ui/button";
import { DrawCardFace } from "./DrawCardFace";
import { FixtureStrip } from "./FixtureStrip";
import { FixtureSheet } from "./FixtureSheet";
import { NextFixtureLine } from "./NextFixtureLine";
import { PickImpact } from "./PickImpact";
import { DraftProjection } from "./DraftProjection";
import { SynergyMeters } from "./SynergyMeters";
import { CoachMark } from "./CoachMark";
import { useCoachMarks, useDrawIntro } from "./coachMarks";
import { useDrawT } from "./drawI18n";
import { LAYOUT } from "./layout";

interface DraftStageProps {
  view: DrawRunView;
  rules: DrawRules;
  /** True while a choice is in flight — offers refuse taps (no double picks). */
  locked: boolean;
  onPick: (offerIndex: number) => void;
}

const RIP_ROTATIONS = ["-3deg", "2.5deg", "-2deg"];

/**
 * S2 — draft view (LAYOUT_SPEC "Draft view" + Ticket F + D5; budget in
 * layout.ts): fixture strip pinned top, the next fixture's effect line,
 * synergy meters, ONE active row of 3 offers (rip reveal on row advance), the
 * selected offer's mini-gauntlet, the ON PAPER projection, row progress dots,
 * cumulative score / PICK.
 *
 * F2a — the pick is now SELECT then CONFIRM. A single tap used to fire an
 * irreversible pick immediately, which meant every consequence of a pick (its
 * chains, its record against the gauntlet) could only be shown after it was too
 * late to use them. Selection is free and switchable; the second tap — on the
 * card again or on PICK — commits.
 */
export function DraftStage({ view, rules, locked, onPick }: DraftStageProps) {
  const offers = view.currentRow ?? [];
  const [selected, setSelected] = useState<number | null>(null);
  const [sheetFixture, setSheetFixture] = useState<Fixture | null>(null);
  const t = useDrawT();
  const coach = useCoachMarks();
  // D2 — on the player's very first board the fit strip is withheld until it is
  // introduced after fixture 1 (RoundStage owns the trigger). The sentinel is
  // never written during the draft, so this stays stable for the whole draft.
  const { introduced } = useDrawIntro();

  // A new row is a new decision — never carry a selection across it (the
  // offers behind the index have changed).
  useEffect(() => {
    setSelected(null);
  }, [view.rowIndex]);

  const selectedCard: Card | null = selected === null ? null : (offers[selected] ?? null);
  const nextFixture = view.fixtures[0] ?? null;

  const commit = (index: number) => {
    if (locked) return;
    setSelected(null);
    onPick(index);
  };

  // First tap selects, second commits. Selecting is also what dismisses the
  // draft coach mark: the player has demonstrably found the control.
  const tapOffer = (index: number) => {
    if (locked) return;
    coach.dismiss("draft");
    if (selected === index) commit(index);
    else setSelected(index);
  };

  // Phones: one column in reading order (the `order-*` below; the two column
  // wrappers are `display: contents`). Desktop (md+): what you draft AGAINST
  // on the left — the gauntlet, the next fixture, your chains, the ON PAPER
  // projection — and the pick itself on the right.
  const COL = "contents md:flex md:flex-col md:min-w-0";
  return (
    <div
      className="relative flex flex-col min-h-full md:grid md:grid-cols-2 md:items-start md:gap-x-6"
      style={{ rowGap: LAYOUT.sectionGap }}
      data-testid="draw-draft-stage"
    >
      <div className={COL} style={{ gap: LAYOUT.sectionGap }}>
        <div className="order-1 md:order-none">
          <FixtureStrip fixtures={view.fixtures} activeIndex={0} clearedCount={0} onSelect={setSheetFixture} />
        </div>

        {/* F1c — the fixture being drafted against, always legible. */}
        {nextFixture && (
          <div className="order-2 md:order-none">
            <NextFixtureLine fixture={nextFixture} onSelect={setSheetFixture} />
          </div>
        )}

        <div className="order-3 md:order-none">
          <SynergyMeters cards={view.squad} synergyTable={rules.synergyTable} ghostCard={selectedCard} />
        </div>

        {/* D5 — ON PAPER: the drafted squad's exact best-five book value per
            fixture, updated per confirmed pick. STOP-G's exact-number ban is
            scoped to the round phase; this draft-phase projection is the D5
            amendment. Shows for first-run players too (their consequence
            instrument in place of the still-gated fit strip). */}
        <div className="order-6 md:order-none">
          <DraftProjection squad={view.squad} fixtures={view.fixtures} rules={rules} />
        </div>
      </div>

      <div className={COL} style={{ gap: LAYOUT.sectionGap }}>
        {/* Active row — the rip reveal re-runs whenever rowIndex advances
            (keys include the row), staggered per slot. */}
        <div
          className="order-4 md:order-none flex items-stretch shrink-0"
          style={{ height: LAYOUT.offerCardMaxH, gap: LAYOUT.offerCardGap }}
          data-testid="draw-offer-row"
        >
          {offers.map((card, i) => (
            <button
              key={`${view.rowIndex}-${card.id}`}
              type="button"
              disabled={locked}
              onClick={() => tapOffer(i)}
              aria-pressed={selected === i}
              className={cn(
                "draw-rip neo-border rounded-lg bg-card text-card-foreground flex-1 min-w-0",
                "cursor-pointer active:neo-shadow-pressed text-left",
                selected === i ? "draw-offer-selected draw-outline-lime neo-shadow-lg" : "neo-shadow",
              )}
              style={
                {
                  maxHeight: LAYOUT.offerCardMaxH,
                  "--rip-delay": `${i * 0.07}s`,
                  "--rip-rot": RIP_ROTATIONS[i % RIP_ROTATIONS.length],
                } as React.CSSProperties
              }
              data-testid={`draw-offer-${i}`}
              data-selected={selected === i ? "true" : undefined}
            >
              <DrawCardFace card={card} />
            </button>
          ))}
        </div>

        {/* F2b — mini-gauntlet for the selected offer. D2 — withheld (slot
            reserved) until the first-run introduction. */}
        <div className="order-5 md:order-none">
          <PickImpact card={selectedCard} fixtures={view.fixtures} hidden={!introduced} />
        </div>

        {/* Row progress dots + picks-remaining. */}
        <div
          className="order-7 md:order-none flex items-center justify-center gap-2 shrink-0"
          style={{ height: LAYOUT.rowDotsH }}
          data-testid="draw-row-dots"
        >
          {Array.from({ length: rules.rows }, (_, i) => (
            <span
              key={i}
              className={cn("neo-border rounded-full w-3 h-3", i < view.rowIndex ? "bg-foreground" : "bg-muted")}
            />
          ))}
          <span className="font-mono font-bold text-eyebrow ml-1">
            {t("draft.pickCount", { n: Math.min(view.rowIndex + 1, rules.rows), total: rules.rows })}
          </span>
        </div>

        {/* One 44px slot, two jobs: the score bar, or PICK once an offer is
            selected. Nothing is lost by the swap — cumulative is 0 for the
            whole draft, while the threshold stays on the next-fixture line. */}
        <div
          className="order-8 md:order-none sticky bottom-0 z-raised bg-background md:static shrink-0"
          style={{ height: LAYOUT.scoreBarH }}
          data-testid="draw-score-bar"
        >
          {selectedCard !== null ? (
            <Button
              variant="primary"
              className="w-full h-full min-h-0"
              disabled={locked}
              onClick={() => selected !== null && commit(selected)}
              data-testid="draw-confirm-pick"
            >
              <span className="truncate">{t("draft.pick", { name: selectedCard.name })}</span>
            </Button>
          ) : (
            <div className="draw-border-quiet neo-border rounded-lg bg-card flex items-center justify-between px-3 h-full font-mono text-eyebrow">
              <span>
                {t("draft.banked")} <span className="font-bold text-body-sm">{Math.round(view.cumulative)}</span>
              </span>
              <span className="text-muted-foreground">
                {t("draft.firstClearsAt")}{" "}
                <span className="font-bold text-body-sm text-foreground">{view.fixtures[0]?.threshold}</span>
              </span>
            </div>
          )}
        </div>

        {/* In flow, last — see CoachMark. */}
        <div className="order-9 md:order-none empty:hidden">
          <CoachMark id="draft" seen={coach.seen} onDismiss={coach.dismiss} onSkipAll={coach.skipAll} />
        </div>
      </div>

      <FixtureSheet
        fixture={sheetFixture}
        fixtureCount={rules.fixtureCount}
        onClose={() => setSheetFixture(null)}
      />
    </div>
  );
}

