/**
 * F3a — the projected score band, rendered into the round view's existing
 * threshold-bar slot before a round resolves (so it costs no extra pixels; the
 * slot showed a placeholder "—" until now).
 *
 * The bar IS the bench decision: it recomputes on every bench toggle, so
 * sitting a card visibly moves the band relative to the threshold marker. That
 * marker inside the band is the whole read — left of the band means the round
 * clears on any form draw, right of it means it cannot clear at all, and inside
 * means it is a gamble whose odds the player can see.
 */

import { cn } from "@/lib/utils";
import { bandFraction } from "./projection";
import type { ScoreBand } from "./projection";
import { LAYOUT } from "./layout";

interface ProjectedBandProps {
  band: ScoreBand;
  threshold: number;
  /** Small label, e.g. "YOUR FIVE" or "IF YOU PUSH". */
  label?: string;
  testId?: string;
}

export function ProjectedBand({
  band,
  threshold,
  label = "YOUR FIVE",
  testId = "draw-projected-band",
}: ProjectedBandProps) {
  // Where the threshold sits across the band, and which side of it we're on.
  const markerPct = bandFraction(band, threshold) * 100;
  const certainClear = band.low >= threshold;
  const certainFail = band.high < threshold;

  return (
    <div
      className="neo-border rounded-lg bg-card flex flex-col justify-center px-3 shrink-0"
      style={{ height: LAYOUT.thresholdBarH }}
      data-testid={testId}
    >
      <div className="flex items-center justify-between font-mono font-bold text-[11px] mb-1">
        <span className="truncate">
          <span className="font-heading text-[9px] text-muted-foreground mr-1">{label}</span>
          <span data-testid={`${testId}-range`}>
            ~{Math.round(band.low)}–{Math.round(band.high)}
          </span>
        </span>
        <span className="text-muted-foreground shrink-0">
          <span className="font-heading text-[9px] mr-1">CLEARS AT</span>
          <span className="text-foreground">{threshold}</span>
        </span>
      </div>

      {/* The band fills the track; the marker is the threshold inside it. */}
      <div className="relative neo-border rounded-full h-3.5 bg-muted overflow-hidden">
        <div
          className={cn(
            "absolute inset-y-0 left-0 right-0 rounded-full",
            certainClear
              ? "bg-success"
              : certainFail
                ? "bg-destructive"
                : "draw-band-fill",
          )}
        />
        {!certainClear && !certainFail && (
          <div
            className="absolute inset-y-0 w-0.5 bg-foreground"
            style={{ left: `${markerPct}%` }}
            data-testid={`${testId}-marker`}
          />
        )}
      </div>
    </div>
  );
}
