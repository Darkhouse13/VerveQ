/**
 * F1c — the next unplayed fixture's effect, persistently visible on the draft.
 *
 * The strip (F1a) carries every fixture's effect line in a compact tile, which
 * is enough to compare the gauntlet but not to draft AGAINST the fixture you
 * are about to face. This is that one line with its name, always on screen
 * while picking, and it opens the same sheet the tiles do.
 */

import { ChevronRight, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { Fixture } from "@/lib/drawEngine";
import { archetypeMeta } from "./meta";
import { effectLine } from "./fixtureEffects";
import { useDrawT } from "./drawI18n";
import { NEXT_FIXTURE_H } from "./layout";

interface NextFixtureLineProps {
  fixture: Fixture;
  onSelect: (fixture: Fixture) => void;
}

export function NextFixtureLine({ fixture, onSelect }: NextFixtureLineProps) {
  const t = useDrawT();
  const { label, Icon } = archetypeMeta(fixture.archetypeId);
  return (
    <Card
      interactive
      elevation="flat"
      padding="none"
      onClick={() => onSelect(fixture)}
      className={cn(
        "shrink-0",
        "flex items-center gap-2 px-2.5 w-full cursor-pointer",
      )}
      style={{ height: NEXT_FIXTURE_H }}
      data-testid="draw-next-fixture"
    >
      <span className="font-mono text-eyebrow text-muted-foreground shrink-0">{t("draft.next")}</span>
      <Icon size={14} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
      <span className="font-heading font-bold text-body-sm leading-none shrink-0">{label}</span>
      {fixture.isBoss && <Crown size={12} strokeWidth={2.5} className="shrink-0 text-yellow" aria-hidden="true" />}
      <span
        className="font-mono font-bold text-eyebrow leading-none truncate text-muted-foreground"
        data-testid="draw-next-fixture-effect"
      >
        {effectLine(fixture)}
      </span>
      <span className="ml-auto font-mono font-bold text-body-sm leading-none shrink-0">{fixture.threshold}</span>
      <ChevronRight size={14} strokeWidth={3} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </Card>
  );
}
