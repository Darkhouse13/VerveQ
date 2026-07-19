/**
 * F2b — the mini-gauntlet: how the SELECTED offer fares against each of the
 * five fixtures, before the pick is committed.
 *
 * Layout note: this sits under the offer ROW rather than under the selected
 * card itself, and its five slots are laid out on the same flex-1 + 8px-gap
 * grid as FixtureStrip. So slot i sits directly beneath chip i of the gauntlet
 * at the top of the screen, and the row reads as a column against it. A
 * per-card strip would have been ~111px wide for five slots — arrows too small
 * to read and aligned with nothing — which trades the whole point of the
 * feature for a literal reading of "under the card".
 *
 * The verdicts come from the engine's `fixtureMultFor` (via cardEffect), never
 * from re-reading modifier kinds here.
 */

import { cn } from "@/lib/utils";
import type { Card, Fixture } from "@/lib/drawEngine";
import { DIR_ARROW, cardEffect } from "./fixtureEffects";
import { LAYOUT, PICK_IMPACT_H } from "./layout";

interface PickImpactProps {
  /** The selected offer; null renders the reserved slot with its prompt. */
  card: Card | null;
  fixtures: Fixture[];
  /**
   * Ticket D2 — first-run de-noising. When true, the strip's CONTENT (the
   * "{NAME} VS THE GAUNTLET" label + the F1–F5 cells) is not rendered, but the
   * reserved PICK_IMPACT_H slot is held open so the draft stack keeps its
   * budgeted height and nothing below shifts when the strip is introduced.
   */
  hidden?: boolean;
}

const DIR_CLASS = {
  up: "bg-success text-success-foreground",
  down: "bg-destructive text-destructive-foreground",
  flat: "bg-muted text-muted-foreground",
} as const;

export function PickImpact({ card, fixtures, hidden = false }: PickImpactProps) {
  return (
    <div
      className="shrink-0 flex flex-col justify-center"
      style={{ height: PICK_IMPACT_H }}
      data-testid="draw-pick-impact"
      data-hidden={hidden ? "true" : undefined}
    >
      {hidden ? null : card === null ? (
        <p className="font-heading font-bold text-[10px] text-center text-muted-foreground tracking-wide">
          TAP A CARD TO SEE WHAT IT DOES
        </p>
      ) : (
        <>
          <p className="font-heading font-bold text-[8px] tracking-wide text-muted-foreground mb-1 truncate">
            {card.name.toUpperCase()} VS THE GAUNTLET
          </p>
          <div className="flex" style={{ gap: LAYOUT.fixtureChipGap }}>
            {fixtures.map((fixture) => {
              const { dir } = cardEffect(card, fixture);
              return (
                <div
                  key={fixture.index}
                  className={cn(
                    "neo-border rounded flex-1 min-w-0 flex items-center justify-center gap-0.5 h-5",
                    DIR_CLASS[dir],
                  )}
                  data-testid={`draw-pick-impact-${fixture.index}`}
                  data-dir={dir}
                >
                  <span className="font-heading font-bold text-[7px] opacity-80">
                    F{fixture.index + 1}
                  </span>
                  <span className="font-mono font-bold text-[9px] leading-none">
                    {DIR_ARROW[dir]}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
