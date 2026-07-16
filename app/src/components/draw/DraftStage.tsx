import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Card, Fixture } from "@/lib/drawEngine";
import type { DrawRules, DrawRunView } from "@/lib/drawApi/types";
import { NeoButton } from "@/components/neo/NeoButton";
import { DrawCardFace } from "./DrawCardFace";
import { FixtureStrip } from "./FixtureStrip";
import { FixtureSheet } from "./FixtureSheet";
import { NextFixtureLine } from "./NextFixtureLine";
import { PickImpact } from "./PickImpact";
import { SynergyMeters } from "./SynergyMeters";
import { CoachMark } from "./CoachMark";
import { useCoachMarks } from "./coachMarks";
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
 * S2 — draft view (LAYOUT_SPEC "Draft view" + Ticket F, 618px of the 812px
 * budget): fixture strip pinned top, the next fixture's effect line, synergy
 * meters, ONE active row of 3 offers (rip reveal on row advance), the selected
 * offer's mini-gauntlet, row progress dots, cumulative score / PICK. No scroll.
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
  const coach = useCoachMarks();

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

  return (
    <div
      className="relative flex flex-col flex-1 min-h-0"
      style={{ gap: LAYOUT.sectionGap }}
      data-testid="draw-draft-stage"
    >
      <FixtureStrip
        fixtures={view.fixtures}
        activeIndex={0}
        clearedCount={0}
        onSelect={setSheetFixture}
      />

      {/* F1c — the fixture being drafted against, always legible. */}
      {nextFixture && <NextFixtureLine fixture={nextFixture} onSelect={setSheetFixture} />}

      <SynergyMeters
        cards={view.squad}
        synergyTable={rules.synergyTable}
        ghostCard={selectedCard}
      />

      {/* Active row — the rip reveal re-runs whenever rowIndex advances
          (keys include the row), staggered per slot. */}
      <div
        className="flex items-stretch shrink-0"
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
              selected === i ? "draw-offer-selected neo-shadow-lg" : "neo-shadow",
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

      {/* F2b — mini-gauntlet for the selected offer. */}
      <PickImpact card={selectedCard} fixtures={view.fixtures} />

      {/* Row progress dots + picks-remaining. */}
      <div
        className="flex items-center justify-center gap-2 shrink-0"
        style={{ height: LAYOUT.rowDotsH }}
        data-testid="draw-row-dots"
      >
        {Array.from({ length: rules.rows }, (_, i) => (
          <span
            key={i}
            className={cn(
              "neo-border rounded-full w-3 h-3",
              i < view.rowIndex ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
        <span className="font-mono font-bold text-[10px] ml-1">
          PICK {Math.min(view.rowIndex + 1, rules.rows)}/{rules.rows}
        </span>
      </div>

      {/* One 44px slot, two jobs: the score bar, or CONFIRM once an offer is
          selected. Nothing is lost by the swap — cumulative is 0 for the whole
          draft and the top bar carries it anyway, while the threshold stays on
          the next-fixture line above. */}
      <div className="shrink-0" style={{ height: LAYOUT.scoreBarH }} data-testid="draw-score-bar">
        {selectedCard !== null ? (
          <NeoButton
            variant="primary"
            className="w-full h-full"
            disabled={locked}
            onClick={() => selected !== null && commit(selected)}
            data-testid="draw-confirm-pick"
          >
            PICK {selectedCard.name.toUpperCase()}
          </NeoButton>
        ) : (
          <div className="neo-border rounded-lg bg-card flex items-center justify-between px-3 h-full">
            <span className="font-heading font-bold text-[10px] tracking-wide">
              BANKED <span className="font-mono text-sm">{Math.round(view.cumulative)}</span>
            </span>
            <span className="font-heading font-bold text-[10px] tracking-wide text-muted-foreground">
              F1 CLEARS AT{" "}
              <span className="font-mono text-sm text-foreground">
                {view.fixtures[0]?.threshold}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Pinned to the stage's bottom slack — see CoachMark for why it is not
          anchored to the offer row. */}
      <CoachMark
        id="draft"
        seen={coach.seen}
        onDismiss={coach.dismiss}
        onSkipAll={coach.skipAll}
      />

      <FixtureSheet
        fixture={sheetFixture}
        fixtureCount={rules.fixtureCount}
        onClose={() => setSheetFixture(null)}
      />
    </div>
  );
}
