import { cn } from "@/lib/utils";
import type { Card } from "@/lib/drawEngine";
import { shortTag } from "./meta";

interface DrawCardFaceProps {
  card: Card;
  /** "offer" = draft card; "mini" = result-screen board reveal tile. */
  size?: "offer" | "mini";
}

const POSITION_CLASS: Record<string, string> = {
  GK: "bg-yellow text-yellow-foreground",
  DEF: "bg-electric-blue text-electric-blue-foreground",
  MID: "bg-success text-success-foreground",
  ATT: "bg-hot-pink text-hot-pink-foreground",
};

/** A synthetic player card face (name, rating, position, synergy tags). */
export function DrawCardFace({ card, size = "offer" }: DrawCardFaceProps) {
  const mini = size === "mini";
  return (
    <div className="flex flex-col h-full w-full min-w-0 p-1.5">
      <div className="flex items-start justify-between gap-1">
        <span className={cn("font-mono font-bold leading-none", mini ? "text-sm" : "text-2xl")}>
          {card.rating}
        </span>
        <span
          className={cn(
            "neo-border rounded font-heading font-bold leading-none px-1 py-0.5",
            mini ? "text-[7px]" : "text-[9px]",
            POSITION_CLASS[card.position] ?? "bg-muted",
          )}
        >
          {card.position}
        </span>
      </div>
      <p
        className={cn(
          "font-heading font-bold flex-1 min-h-0 flex items-center leading-tight",
          mini ? "text-[8px] truncate" : "text-[11px]",
        )}
      >
        {card.name}
      </p>
      <div className="flex flex-wrap gap-0.5 items-end">
        {card.clubs.map((club) => (
          <span
            key={club}
            className={cn(
              "rounded-sm bg-electric-blue text-electric-blue-foreground font-mono font-bold leading-none",
              mini ? "text-[6px] px-0.5 py-px" : "text-[8px] px-1 py-0.5",
            )}
          >
            {shortTag(club)}
          </span>
        ))}
        <span
          className={cn(
            "rounded-sm bg-hot-pink text-hot-pink-foreground font-mono font-bold leading-none",
            mini ? "text-[6px] px-0.5 py-px" : "text-[8px] px-1 py-0.5",
          )}
        >
          {shortTag(card.nation)}
        </span>
        <span
          className={cn(
            "rounded-sm bg-yellow text-yellow-foreground font-mono font-bold leading-none",
            mini ? "text-[6px] px-0.5 py-px" : "text-[8px] px-1 py-0.5",
          )}
        >
          {shortTag(card.era)}
        </span>
      </div>
    </div>
  );
}
