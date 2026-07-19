/**
 * Ticket D5 — the "ON PAPER" panel: the drafted squad's exact best-five book
 * value per fixture, updated after every confirmed pick.
 *
 * This is the DRAFT-phase consequence instrument. STOP-G's ban on exact
 * pre-decision numbers is scoped (D5 amendment) to the ROUND phase; while
 * drafting, the player sees each pick move these numbers, then gambles under
 * the coarse clearance meter once the rounds begin.
 *
 * The number is form-agnostic by construction — bandMidFor excludes form, which
 * is provably absent client-side pre-resolution (drawApi sanitization) — and
 * the "before form" sublabel keeps the number honest about what it omits.
 *
 * D2 — this SHOWS for first-run players: it is their consequence instrument in
 * place of the F1–F5 fit strip (PickImpact), which stays gated behind the intro
 * sentinel. Both coexist for veterans; the draft layout budget holds both.
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Card, Fixture } from "@/lib/drawEngine";
import type { DrawRules } from "@/lib/drawApi/types";
import { archetypeMeta } from "./meta";
import { PROJECTION_H } from "./layout";
import { projectBestFive, projectionConfig } from "./bookValue";

interface DraftProjectionProps {
  /** Confirmed picks so far — the "drafted cards" the projection is over. */
  squad: Card[];
  fixtures: Fixture[];
  rules: DrawRules;
}

export function DraftProjection({ squad, fixtures, rules }: DraftProjectionProps) {
  const config = projectionConfig(rules);
  return (
    <div
      className="neo-border rounded-lg bg-card text-card-foreground shrink-0 flex flex-col justify-center px-3 py-1"
      style={{ height: PROJECTION_H }}
      data-testid="draw-projection"
      data-picks={squad.length}
    >
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="font-heading font-bold text-[9px] tracking-wide">ON PAPER</span>
        <span
          className="font-heading text-[7px] tracking-wide text-muted-foreground"
          data-testid="draw-projection-sub"
        >
          best five · before form
        </span>
      </div>

      {/* One row per fixture: projected best-five value / threshold, with a
          cleared-on-paper marker when the squad already clears it. */}
      <div className="flex flex-col gap-0.5">
        {fixtures.map((fixture) => {
          const { label } = archetypeMeta(fixture.archetypeId);
          const value = projectBestFive(squad, fixture, config);
          const cleared = value !== null && value >= fixture.threshold;
          return (
            <div
              key={fixture.index}
              className="flex items-center justify-between gap-1 h-3.5"
              data-testid={`draw-projection-row-${fixture.index}`}
              data-cleared={cleared ? "true" : undefined}
            >
              <span className="font-heading font-bold text-[8px] tracking-wide truncate">
                {label}
              </span>
              <span className="flex items-center gap-1 shrink-0 font-mono font-bold text-[9px] leading-none">
                <span
                  className={cn(cleared ? "text-success" : "text-foreground")}
                  data-testid={`draw-projection-value-${fixture.index}`}
                >
                  {value === null ? "—" : Math.round(value)}
                </span>
                <span className="text-muted-foreground">/ {fixture.threshold}</span>
                {cleared && (
                  <Check
                    size={9}
                    strokeWidth={4}
                    className="text-success shrink-0"
                    data-testid={`draw-projection-cleared-${fixture.index}`}
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
