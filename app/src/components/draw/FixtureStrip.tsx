import { Crown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Fixture } from "@/lib/drawEngine";
import { archetypeMeta } from "./meta";
import { effectLine } from "./fixtureEffects";
import { LAYOUT } from "./layout";

interface FixtureStripProps {
  fixtures: Fixture[];
  /** Fixture currently in play / up next; null pre-run. */
  activeIndex: number | null;
  /** Fixtures already cleared (indices < clearedCount are done). */
  clearedCount: number;
  /** Index of the fixture that busted the run, if any. */
  bustedIndex?: number | null;
  /** F1b — tap a chip for its detail sheet. Chips are inert when omitted. */
  onSelect?: (fixture: Fixture) => void;
}

/**
 * 64px gauntlet strip — the whole board (archetype + threshold per fixture)
 * is visible from board start (design contract; LAYOUT_SPEC "Fixture strip").
 *
 * F1a: each chip also carries its EFFECT LINE ("DEF▲ ATT▼"), derived from the
 * fixture's own modifiers. Before this the strip showed an archetype name and a
 * number, which told a player what the fixture was CALLED but not what it did —
 * the modifiers were the whole game and were invisible. The line fits the
 * existing 64px chip, so the strip costs the layout budget nothing new.
 */
export function FixtureStrip({
  fixtures,
  activeIndex,
  clearedCount,
  bustedIndex = null,
  onSelect,
}: FixtureStripProps) {
  return (
    <div
      className="flex shrink-0"
      style={{ height: LAYOUT.fixtureStripH, gap: LAYOUT.fixtureChipGap }}
      data-testid="draw-fixture-strip"
    >
      {fixtures.map((fixture) => {
        const { label, Icon } = archetypeMeta(fixture.archetypeId);
        const cleared = fixture.index < clearedCount;
        const busted = bustedIndex === fixture.index;
        const active = !cleared && !busted && fixture.index === activeIndex;
        return (
          <button
            key={fixture.index}
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(fixture)}
            aria-label={`Fixture ${fixture.index + 1}, ${label}, clears at ${fixture.threshold}`}
            className={cn(
              "neo-border rounded-lg flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5",
              onSelect && "cursor-pointer active:neo-shadow-pressed",
              cleared
                ? "bg-success text-success-foreground"
                : busted
                  ? "bg-destructive text-destructive-foreground"
                  : active
                    ? "bg-primary text-primary-foreground neo-shadow-sm"
                    : "bg-card text-card-foreground opacity-90",
            )}
            data-testid={`draw-fixture-chip-${fixture.index}`}
          >
            <span className="flex items-center gap-0.5">
              {cleared ? (
                <Check size={11} strokeWidth={4} />
              ) : (
                <Icon size={11} strokeWidth={2.5} />
              )}
              {fixture.isBoss && <Crown size={10} strokeWidth={2.5} />}
            </span>
            <span className="font-heading font-bold text-[7px] leading-none tracking-wide truncate max-w-full">
              {label}
            </span>
            <span
              className="font-mono font-bold text-[7px] leading-none truncate max-w-full opacity-90"
              data-testid={`draw-fixture-effect-${fixture.index}`}
            >
              {effectLine(fixture)}
            </span>
            <span className="font-mono font-bold text-[11px] leading-none">
              {fixture.threshold}
            </span>
          </button>
        );
      })}
    </div>
  );
}
