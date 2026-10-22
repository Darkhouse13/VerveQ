import { cn } from "@/lib/utils";
import type { Card } from "@/lib/drawEngine";
import { shortTag } from "./meta";
import { tagCode } from "./tags";
import { useDrawT } from "./drawI18n";

interface DrawCardFaceProps {
  card: Card;
  /** "offer" = draft card; "mini" = result-screen board reveal tile. */
  size?: "offer" | "mini";
}

/** Card-face art: the position colors are THE DRAW's own palette slots. */
const POSITION_CLASS: Record<string, string> = {
  GK: "bg-yellow text-yellow-foreground",
  DEF: "bg-electric-blue text-electric-blue-foreground",
  MID: "bg-success text-success-foreground",
  ATT: "bg-hot-pink text-hot-pink-foreground",
};

const TAG = "rounded-sm font-mono font-bold text-eyebrow tracking-normal leading-none px-1 py-0.5";

/**
 * A synthetic player card face (name, rating, position, synergy tags).
 *
 * F7: clubs and nation render through tags.ts — a display CODE, not the raw
 * tag — so the real card set's short codes appear here without a change to
 * this file. The full names live in the card detail sheet, which is the only
 * place there is room for them.
 *
 * VerveQ ONE P4.2 (12px floor): the "mini" tile on the result board shows
 * rating, position and name only — its 6px tag chips were unreadable. A tap
 * opens the detail sheet with every tag.
 */
export function DrawCardFace({ card, size = "offer" }: DrawCardFaceProps) {
  const t = useDrawT();
  if (size === "mini") {
    return (
      <div className="flex flex-col justify-between h-full w-full min-w-0 px-1.5 py-1 text-left">
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono font-bold text-body-sm leading-none">{card.rating}</span>
          <span className={cn(TAG, "neo-border", POSITION_CLASS[card.position] ?? "bg-muted")}>
            {t(`positionShort.${card.position}`)}
          </span>
        </div>
        <p className="font-heading font-bold text-eyebrow tracking-normal leading-tight truncate">{card.name}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-full w-full min-w-0 p-1.5">
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono font-bold leading-none text-title">{card.rating}</span>
        <span className={cn(TAG, "neo-border", POSITION_CLASS[card.position] ?? "bg-muted")}>
          {t(`positionShort.${card.position}`)}
        </span>
      </div>
      <p className="font-heading font-bold flex-1 min-h-0 flex items-center leading-tight text-body-sm">
        {card.name}
      </p>
      <div className="flex flex-wrap gap-0.5 items-end">
        {card.clubs.map((club) => (
          <span
            key={club}
            className={cn(TAG, "bg-electric-blue text-electric-blue-foreground")}
            data-testid="draw-card-club"
          >
            {tagCode(club)}
          </span>
        ))}
        <span className={cn(TAG, "bg-hot-pink text-hot-pink-foreground")} data-testid="draw-card-nation">
          {tagCode(card.nation)}
        </span>
        <span className={cn(TAG, "bg-yellow text-yellow-foreground")}>{shortTag(card.era)}</span>
      </div>
    </div>
  );
}
