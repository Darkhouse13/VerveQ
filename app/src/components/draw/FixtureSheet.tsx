/**
 * F1b — fixture detail sheet. Opened by tapping any fixture chip (strip or
 * round card).
 *
 * Every word of the effect copy is GENERATED from the fixture's modifier data
 * (fixtureEffects.ts), never authored per archetype: a config retune rewrites
 * this sheet with no edit here. The only hand-written strings are the frame —
 * the section labels and the boss warning.
 */

import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Fixture } from "@/lib/drawEngine";
import { archetypeMeta } from "./meta";
import { DIR_ARROW, effectSentences, effectTokens } from "./fixtureEffects";
import { DrawSheet } from "./DrawSheet";

interface FixtureSheetProps {
  fixture: Fixture | null;
  fixtureCount: number;
  onClose: () => void;
}

export function FixtureSheet({ fixture, fixtureCount, onClose }: FixtureSheetProps) {
  if (fixture === null) return null;
  const { label, Icon } = archetypeMeta(fixture.archetypeId);
  const tokens = effectTokens(fixture);
  const sentences = effectSentences(fixture);

  return (
    <DrawSheet
      open
      onOpenChange={(next) => !next && onClose()}
      eyebrow={`FIXTURE ${fixture.index + 1}/${fixtureCount}`}
      title={label}
      testId="draw-fixture-sheet"
      badge={
        fixture.isBoss ? (
          <span
            className="neo-border rounded bg-yellow text-yellow-foreground font-heading font-bold text-[9px] px-1.5 py-1 inline-flex items-center gap-1 shrink-0"
            data-testid="draw-fixture-sheet-boss"
          >
            <Crown size={10} strokeWidth={3} /> BOSS
          </span>
        ) : null
      }
    >
      <div className="flex items-center gap-2">
        <Icon size={18} strokeWidth={2.5} />
        <span className="font-mono font-bold text-sm" data-testid="draw-fixture-sheet-effect">
          {tokens.map((t) => `${t.label}${DIR_ARROW[t.dir]}`).join("  ")}
        </span>
      </div>

      {/* Plain language — the whole reason the sheet exists. */}
      <div className="flex flex-col gap-1.5" data-testid="draw-fixture-sheet-copy">
        {sentences.map((sentence, i) => (
          <p key={i} className="text-sm leading-snug flex items-start gap-2">
            <span
              className={cn(
                "font-mono font-bold shrink-0",
                tokens[i].dir === "up"
                  ? "text-success"
                  : tokens[i].dir === "down"
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {DIR_ARROW[tokens[i].dir]}
            </span>
            {sentence}
          </p>
        ))}
      </div>

      <div className="neo-border rounded-lg bg-card flex items-center justify-between px-3 py-2">
        <span className="font-heading font-bold text-[10px] tracking-wide text-muted-foreground">
          CLEARS AT
        </span>
        <span className="font-mono font-bold text-2xl leading-none" data-testid="draw-fixture-sheet-threshold">
          {fixture.threshold}
        </span>
      </div>

      {fixture.isBoss && (
        <p className="text-xs text-muted-foreground leading-snug">
          The last fixture. Clear it and the whole run pays out — there is nothing
          left to push into.
        </p>
      )}
    </DrawSheet>
  );
}
