/**
 * F1b — fixture detail sheet. Opened by tapping any fixture chip (strip or
 * round card).
 *
 * Every word of the effect copy is GENERATED from the fixture's modifier data
 * (fixtureEffects.ts), never authored per archetype: a config retune rewrites
 * this sheet with no edit here. The only hand-written strings are the frame —
 * the section labels and the boss warning (the `draw` locale).
 */

import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Fixture } from "@/lib/drawEngine";
import { Badge } from "@/components/ui/badge";
import { archetypeMeta } from "./meta";
import { DIR_ARROW, effectSentences, effectTokens } from "./fixtureEffects";
import { useDrawT } from "./drawI18n";
import { DrawSheet } from "./DrawSheet";

interface FixtureSheetProps {
  fixture: Fixture | null;
  fixtureCount: number;
  onClose: () => void;
}

export function FixtureSheet({ fixture, fixtureCount, onClose }: FixtureSheetProps) {
  const t = useDrawT();
  if (fixture === null) return null;
  const { label, Icon } = archetypeMeta(fixture.archetypeId, t);
  const tokens = effectTokens(fixture);
  const sentences = effectSentences(fixture, t);

  return (
    <DrawSheet
      open
      onOpenChange={(next) => !next && onClose()}
      eyebrow={t("round.fixture", { n: fixture.index + 1, total: fixtureCount })}
      title={label}
      testId="draw-fixture-sheet"
      badge={
        fixture.isBoss ? (
          <Badge tone="yellow" shape="tag" className="shrink-0" data-testid="draw-fixture-sheet-boss">
            <Crown size={12} strokeWidth={3} aria-hidden="true" /> {t("round.boss")}
          </Badge>
        ) : null
      }
    >
      <div className="flex items-center gap-2">
        <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
        <span className="font-mono font-bold text-body-sm" data-testid="draw-fixture-sheet-effect">
          {tokens.map((tk) => `${tk.label}${DIR_ARROW[tk.dir]}`).join("  ")}
        </span>
      </div>

      {/* Plain language — the whole reason the sheet exists. */}
      <div className="flex flex-col gap-1.5" data-testid="draw-fixture-sheet-copy">
        {sentences.map((sentence, i) => (
          <p key={i} className="text-body-sm leading-snug flex items-start gap-2">
            <span
              className={cn("font-mono font-bold shrink-0", tokens[i].dir !== "up" && "text-muted-foreground")}
              aria-hidden="true"
            >
              {DIR_ARROW[tokens[i].dir]}
            </span>
            {sentence}
          </p>
        ))}
      </div>

      <div className="neo-border rounded-lg bg-card flex items-center justify-between px-3 py-2">
        <span className="font-mono text-eyebrow text-muted-foreground">{t("round.clearsAt")}</span>
        <span className="font-mono font-bold text-title-lg leading-none" data-testid="draw-fixture-sheet-threshold">
          {fixture.threshold}
        </span>
      </div>

      {fixture.isBoss && <p className="text-meta text-muted-foreground leading-snug">{t("sheet.bossHelp")}</p>}
    </DrawSheet>
  );
}
