/**
 * F1c — the next unplayed fixture's effect, persistently visible on the draft.
 *
 * The strip (F1a) carries every fixture's effect line at 7px, which is enough
 * to compare the gauntlet but not enough to draft AGAINST the fixture you are
 * about to face. This is that one line at a readable size, always on screen
 * while picking, and it opens the same sheet the chips do.
 */

import { ChevronRight, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Fixture } from "@/lib/drawEngine";
import { archetypeMeta } from "./meta";
import { effectLine } from "./fixtureEffects";
import { NEXT_FIXTURE_H } from "./layout";

interface NextFixtureLineProps {
  fixture: Fixture;
  onSelect: (fixture: Fixture) => void;
}

export function NextFixtureLine({ fixture, onSelect }: NextFixtureLineProps) {
  const { label, Icon } = archetypeMeta(fixture.archetypeId);
  return (
    <button
      type="button"
      onClick={() => onSelect(fixture)}
      className={cn(
        "neo-border rounded-lg bg-card text-card-foreground shrink-0",
        "flex items-center gap-1.5 px-2 w-full cursor-pointer active:neo-shadow-pressed",
      )}
      style={{ height: NEXT_FIXTURE_H }}
      data-testid="draw-next-fixture"
    >
      <span className="font-heading font-bold text-[8px] tracking-wide text-muted-foreground shrink-0">
        NEXT
      </span>
      <Icon size={13} strokeWidth={2.5} className="shrink-0" />
      <span className="font-heading font-bold text-[11px] leading-none shrink-0">{label}</span>
      {fixture.isBoss && <Crown size={11} strokeWidth={2.5} className="shrink-0" />}
      <span
        className="font-mono font-bold text-[11px] leading-none truncate"
        data-testid="draw-next-fixture-effect"
      >
        {effectLine(fixture)}
      </span>
      <span className="ml-auto font-mono font-bold text-[11px] leading-none shrink-0">
        {fixture.threshold}
      </span>
      <ChevronRight size={12} strokeWidth={3} className="shrink-0 text-muted-foreground" />
    </button>
  );
}
