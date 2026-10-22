import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import type { ShareCardData } from "./share";
import { outcomeLabel, rarityLine } from "./share";
import { useDrawT } from "./drawI18n";

/**
 * S5 — the spoiler-free share card. Its props (ShareCardData) carry board
 * number, trail, outcome, build-identity line, score, link — and STRUCTURALLY
 * nothing else: no card names, no board contents can reach this render.
 *
 * It is the screenshot people post, so it carries the brand (VerveQ ONE
 * P4.2): the VQ mark + VERVEQ wordmark head the card, THE DRAW and the board
 * number sit under it. The card itself is THE DRAW's art — paper for a bank,
 * yellow for a full clear, and for a bust (deliberately the most stylish one)
 * hazard stripes and a tilted stamp.
 */
export function ShareCard({ data }: { data: ShareCardData }) {
  const t = useDrawT();
  const busted = data.outcome === "busted";
  const fullclear = data.outcome === "fullclear";
  // F6 — same gate as buildShareText: below the population floor there is no
  // rarity line to draw at all.
  const rarity = rarityLine(data.rarity, t);
  return (
    <div
      className={cn(
        "neo-border neo-shadow-lg rounded-lg overflow-hidden select-none",
        busted ? "draw-share-bust p-2" : fullclear ? "bg-yellow text-ink on-fill" : "theme-paper bg-paper text-paper-foreground",
      )}
      data-testid="draw-share-card"
    >
      <div
        className={cn(
          "rounded-md p-4 flex flex-col gap-2",
          busted && "theme-paper neo-border bg-paper text-paper-foreground",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <BrandMark variant="mark" size="sm" />
            <span className="flex flex-col">
              <BrandMark variant="wordmark" size="sm" />
              <span className="font-mono text-eyebrow text-muted-foreground mt-0.5">THE DRAW</span>
            </span>
          </span>
          <span className="font-mono font-bold text-body-sm">#{data.boardNumber}</span>
        </div>

        <div className="flex items-center justify-center py-1">
          <span
            className={cn(
              "font-heading font-bold uppercase leading-none",
              busted
                ? "draw-share-stamp neo-border text-destructive border-destructive px-3 py-2 text-display"
                : fullclear
                  ? "text-title-lg inline-flex items-center gap-2"
                  : "text-title-lg",
            )}
          >
            {fullclear && <Crown size={28} strokeWidth={2.5} aria-hidden="true" />}
            {outcomeLabel(data.outcome, t)}
          </span>
        </div>

        <p className="text-center text-title leading-none tracking-wide" aria-label={t("result.trailLabel")}>
          {data.trail}
        </p>

        {data.identity && (
          <p className="text-center">
            <span className="neo-border rounded-md font-mono font-bold text-eyebrow tracking-normal px-2 py-1 inline-block bg-electric-blue text-ink">
              {data.identity}
            </span>
          </p>
        )}

        <p className="text-center font-mono font-bold text-display leading-none mt-1">
          {Math.round(data.score).toLocaleString("en-US")}
          <span className="text-eyebrow align-top ml-1">{t("result.pts")}</span>
        </p>

        {rarity && (
          <p className="text-center font-mono text-eyebrow text-muted-foreground" data-testid="draw-share-rarity">
            {rarity}
          </p>
        )}

        <p className="text-center font-mono text-eyebrow tracking-normal text-muted-foreground mt-1">
          {data.url.replace(/^https?:\/\//, "")}
        </p>
      </div>
    </div>
  );
}
