/**
 * Ticket G3 — the clearance meter, replacing the exact numeric band (F3)
 * everywhere pre-decision.
 *
 * WHY THE BAND DIED (STOP-G/G2 rulings, drawEngine/DECISIONS.md): the exact
 * band made the informed player push near-optimally, which collapsed the
 * game's tension criteria onto one unreachable dial. c13-2 was accepted with
 * a COARSE read: three buckets — SAFE / TIGHT / LONGSHOT — cut at published
 * ratios of the threshold. The player is told which zone the five they'd
 * field are in, never the number.
 *
 * ONE DEFINITION: the bucket comes from the engine's `clearanceFor`
 * (clearance.ts) — the same function the acceptance bots were measured with —
 * fed by the served bucket cutoffs (DrawRules.clearance). No client
 * arithmetic beyond assembling the narrow config, exactly the squadSynergies
 * pattern the meters already use. Exact numbers (scores, contributions,
 * forms) remain post-resolution only.
 */

import { cn } from "@/lib/utils";
import { clearanceFor, DEFAULT_CLEARANCE } from "@/lib/drawEngine";
import type { Card, ClearanceSignal, EngineConfig, Fixture } from "@/lib/drawEngine";
import type { DrawRules } from "@/lib/drawApi/types";
import { LAYOUT } from "./layout";

interface ClearanceMeterProps {
  /** The five that would take the pitch under the current bench selection. */
  fielded: Card[];
  fixture: Fixture;
  rules: DrawRules;
  /** Small label, e.g. "YOUR FIVE" or "IF YOU PUSH". */
  label?: string;
  testId?: string;
}

const ZONES: ClearanceSignal[] = ["LONGSHOT", "TIGHT", "SAFE"];

const ZONE_COPY: Record<ClearanceSignal, string> = {
  SAFE: "SAFE",
  TIGHT: "TIGHT",
  LONGSHOT: "LONGSHOT",
};

const ZONE_ACTIVE_CLASS: Record<ClearanceSignal, string> = {
  SAFE: "bg-success text-success-foreground",
  TIGHT: "bg-yellow text-yellow-foreground",
  LONGSHOT: "bg-destructive text-destructive-foreground",
};

/**
 * The engine call: clearanceFor reads exactly these knobs (chain → multiplier
 * via squadSynergies, plus the bucket cutoffs). Narrowing to them — rather
 * than threading a whole EngineConfig into the UI, which the client is never
 * sent — keeps the ENGINE as the single implementation of the signal.
 */
function clearanceConfig(rules: DrawRules): EngineConfig {
  return {
    synergyTable: rules.synergyTable,
    maxSynergyFamilies: rules.maxSynergyFamilies,
    clearance: rules.clearance ?? DEFAULT_CLEARANCE,
  } as EngineConfig;
}

/** The signal for a fielded five — exported for tests (same call the meter renders). */
export function meterSignal(fielded: Card[], fixture: Fixture, rules: DrawRules): ClearanceSignal {
  return clearanceFor(fielded, fixture, clearanceConfig(rules));
}

export function ClearanceMeter({
  fielded,
  fixture,
  rules,
  label = "YOUR FIVE",
  testId = "draw-clearance-meter",
}: ClearanceMeterProps) {
  const signal = meterSignal(fielded, fixture, rules);

  return (
    <div
      className="neo-border rounded-lg bg-card flex flex-col justify-center px-3 shrink-0"
      style={{ height: LAYOUT.thresholdBarH }}
      data-testid={testId}
      data-signal={signal}
    >
      <div className="flex items-center justify-between font-mono font-bold text-[11px] mb-1">
        <span className="truncate">
          <span className="font-heading text-[9px] text-muted-foreground mr-1">{label}</span>
          <span data-testid={`${testId}-signal`}>{ZONE_COPY[signal]}</span>
        </span>
        <span className="text-muted-foreground shrink-0">
          <span className="font-heading text-[9px] mr-1">CLEARS AT</span>
          <span className="text-foreground">{fixture.threshold}</span>
        </span>
      </div>

      {/* Three fixed zones; the active one is lit. No numbers, no marker. */}
      <div className="flex gap-1 h-3.5">
        {ZONES.map((zone) => (
          <div
            key={zone}
            className={cn(
              "neo-border rounded-full flex-1 flex items-center justify-center",
              zone === signal ? ZONE_ACTIVE_CLASS[zone] : "bg-muted",
            )}
            data-testid={`${testId}-zone-${zone}`}
            data-active={zone === signal ? "true" : undefined}
          >
            <span
              className={cn(
                "font-heading font-bold text-[7px] tracking-wide leading-none",
                zone === signal ? "" : "text-muted-foreground/60",
              )}
            >
              {ZONE_COPY[zone]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
