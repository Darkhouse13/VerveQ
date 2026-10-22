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
import { FAMILY_CLASS, shortTag } from "./meta";
import { tagName } from "./tags";
import { useDrawT } from "./drawI18n";
import { DrawSheet } from "./DrawSheet";

interface CardDetailSheetProps {
  card: Card | null;
  onClose: () => void;
}

export function CardDetailSheet({ card, onClose }: CardDetailSheetProps) {
  const t = useDrawT();
  if (card === null) return null;
  const positionKey = `position.${card.position}`;
  const position = t(positionKey) === positionKey ? card.position : t(positionKey);
  return (
    <DrawSheet
      open
      onOpenChange={(next) => !next && onClose()}
      eyebrow={`${position} · ${t("sheet.rating", { n: card.rating })}`}
      title={card.name}
      testId="draw-card-sheet"
      badge={
        <span className="neo-border rounded-md bg-card font-mono font-bold text-title px-2 py-1 shrink-0">
          {card.rating}
        </span>
      }
    >
      <div className="flex flex-col gap-2" data-testid="draw-card-sheet-tags">
        <Row family="club" label={t("family.club")} values={card.clubs.map(tagName)} />
        <Row family="nation" label={t("family.nation")} values={[tagName(card.nation)]} />
        <Row family="era" label={t("family.era")} values={[shortTag(card.era)]} />
      </div>

      <p className="text-meta text-muted-foreground leading-snug">{t("sheet.chainHelp")}</p>
    </DrawSheet>
  );
}

function Row({ family, label, values }: { family: "club" | "nation" | "era"; label: string; values: string[] }) {
  return (
    <div className="flex items-start gap-2">
      <span className="font-mono text-eyebrow w-16 shrink-0 pt-1 text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1">
        {values.map((value) => (
          <span
            key={value}
            className={cn("neo-border rounded-md font-mono font-bold text-meta px-1.5 py-0.5", FAMILY_CLASS[family])}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}
