/**
 * F7 — card detail sheet. Opened from a card face outside the pick flow (board
 * reveal tap, squad-strip long-press), where a tap can't be confused with a
 * pick or a bench.
 *
 * The card face only has room for CODES ("A", "90s"); this is where they get
 * their full names. Names resolve through tags.ts, so the synthetic set reads
 * "CLUB A" today and real club names appear here the moment the card-set
 * ticket populates the registry — no edit in this file.
 */

import { cn } from "@/lib/utils";
import type { Card } from "@/lib/drawEngine";
import { FAMILY_CLASS, FAMILY_LABEL, shortTag } from "./meta";
import { tagName } from "./tags";
import { DrawSheet } from "./DrawSheet";

interface CardDetailSheetProps {
  card: Card | null;
  onClose: () => void;
}

const POSITION_LABEL: Record<string, string> = {
  GK: "Keeper",
  DEF: "Defender",
  MID: "Midfielder",
  ATT: "Attacker",
};

export function CardDetailSheet({ card, onClose }: CardDetailSheetProps) {
  if (card === null) return null;
  return (
    <DrawSheet
      open
      onOpenChange={(next) => !next && onClose()}
      eyebrow={`${POSITION_LABEL[card.position] ?? card.position} · RATING ${card.rating}`}
      title={card.name}
      testId="draw-card-sheet"
      badge={
        <span className="neo-border rounded bg-card font-mono font-bold text-xl px-2 py-1 shrink-0">
          {card.rating}
        </span>
      }
    >
      <div className="flex flex-col gap-2" data-testid="draw-card-sheet-tags">
        <Row family="club" values={card.clubs.map(tagName)} />
        <Row family="nation" values={[tagName(card.nation)]} />
        <Row family="era" values={[shortTag(card.era)]} />
      </div>

      <p className="text-xs text-muted-foreground leading-snug">
        Chain 3 or more fielded cards sharing a club, nation or era for a
        multiplier.
      </p>
    </DrawSheet>
  );
}

function Row({ family, values }: { family: "club" | "nation" | "era"; values: string[] }) {
  return (
    <div className="flex items-start gap-2">
      <span className="font-heading font-bold text-[10px] w-12 shrink-0 pt-1 tracking-wide text-muted-foreground">
        {FAMILY_LABEL[family]}
      </span>
      <div className="flex flex-wrap gap-1">
        {values.map((value) => (
          <span
            key={value}
            className={cn(
              "neo-border rounded font-mono font-bold text-[11px] px-1.5 py-0.5",
              FAMILY_CLASS[family],
            )}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}
