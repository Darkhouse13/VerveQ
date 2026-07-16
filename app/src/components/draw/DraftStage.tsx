import { cn } from "@/lib/utils";
import type { DrawRules, DrawRunView } from "@/lib/drawApi/types";
import { DrawCardFace } from "./DrawCardFace";
import { FixtureStrip } from "./FixtureStrip";
import { SynergyMeters } from "./SynergyMeters";
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
 * S2 — draft view (LAYOUT_SPEC "Draft view", 518px of the 812px budget):
 * fixture strip pinned top, synergy meters, ONE active row of 3 offers (rip
 * reveal on row advance), row progress dots, cumulative score bar. No scroll.
 */
export function DraftStage({ view, rules, locked, onPick }: DraftStageProps) {
  const offers = view.currentRow ?? [];
  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ gap: LAYOUT.sectionGap }}
      data-testid="draw-draft-stage"
    >
      <FixtureStrip fixtures={view.fixtures} activeIndex={0} clearedCount={0} />

      <SynergyMeters cards={view.squad} synergyTable={rules.synergyTable} />

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
            onClick={() => onPick(i)}
            className={cn(
              "draw-rip neo-border neo-shadow rounded-lg bg-card text-card-foreground flex-1 min-w-0",
              "cursor-pointer active:neo-shadow-pressed text-left",
            )}
            style={
              {
                maxHeight: LAYOUT.offerCardMaxH,
                "--rip-delay": `${i * 0.07}s`,
                "--rip-rot": RIP_ROTATIONS[i % RIP_ROTATIONS.length],
              } as React.CSSProperties
            }
            data-testid={`draw-offer-${i}`}
          >
            <DrawCardFace card={card} />
          </button>
        ))}
      </div>

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

      {/* Cumulative + next threshold. */}
      <div
        className="neo-border rounded-lg bg-card flex items-center justify-between px-3 shrink-0"
        style={{ height: LAYOUT.scoreBarH }}
        data-testid="draw-score-bar"
      >
        <span className="font-heading font-bold text-[10px] tracking-wide">
          BANKED <span className="font-mono text-sm">{Math.round(view.cumulative)}</span>
        </span>
        <span className="font-heading font-bold text-[10px] tracking-wide text-muted-foreground">
          F1 CLEARS AT{" "}
          <span className="font-mono text-sm text-foreground">{view.fixtures[0]?.threshold}</span>
        </span>
      </div>
    </div>
  );
}
