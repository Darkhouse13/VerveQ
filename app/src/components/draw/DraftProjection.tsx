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
import { LAYOUT, PROJECTION_H } from "./layout";
import { projectBestFive, projectionConfig } from "./bookValue";
import { useDrawT } from "./drawI18n";

interface DraftProjectionProps {
  /** Confirmed picks so far — the "drafted cards" the projection is over. */
  squad: Card[];
  fixtures: Fixture[];
  rules: DrawRules;
}

/**
 * VerveQ ONE P4.2: one column per fixture, on the gauntlet strip's grid (same
 * flex-1 + chip gap), so each value reads straight down from its tile and
 * every number sits at the 12px floor.
 */
export function DraftProjection({ squad, fixtures, rules }: DraftProjectionProps) {
  const t = useDrawT();
  const config = projectionConfig(rules);
  return (
    <div
      className="draw-border-quiet neo-border rounded-lg bg-card text-card-foreground shrink-0 flex flex-col justify-center px-2 py-1.5"
      style={{ height: PROJECTION_H }}
      data-testid="draw-projection"
      data-picks={squad.length}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1 px-0.5">
        <span className="font-mono text-eyebrow font-bold whitespace-nowrap shrink-0">{t("draft.onPaper")}</span>
        <span className="text-eyebrow text-muted-foreground truncate" data-testid="draw-projection-sub">
          {t("draft.onPaperSub")}
        </span>
      </div>

      <div className="flex" style={{ gap: LAYOUT.fixtureChipGap }}>
        {fixtures.map((fixture) => {
          const { label, Icon } = archetypeMeta(fixture.archetypeId);
          const value = projectBestFive(squad, fixture, config);
          const cleared = value !== null && value >= fixture.threshold;
          return (
            <div
              key={fixture.index}
              className="flex-1 min-w-0 flex flex-col items-center font-mono font-bold text-eyebrow tracking-normal leading-4"
              data-testid={`draw-projection-row-${fixture.index}`}
              data-cleared={cleared ? "true" : undefined}
              aria-label={label}
            >
              <span className="flex items-center gap-0.5">
                {cleared ? (
                  <Check
                    size={12}
                    strokeWidth={4}
                    className="text-success shrink-0"
                    data-testid={`draw-projection-cleared-${fixture.index}`}
                  />
                ) : (
                  <Icon size={12} strokeWidth={2.5} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span
                  className={cn(cleared ? "text-success" : "text-foreground")}
                  data-testid={`draw-projection-value-${fixture.index}`}
                >
                  {value === null ? "—" : Math.round(value)}
                </span>
              </span>
              <span className="text-muted-foreground">/{fixture.threshold}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

