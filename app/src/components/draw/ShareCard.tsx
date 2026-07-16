import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";
import type { ShareCardData } from "./share";
import { OUTCOME_LABEL } from "./share";

/**
 * S5 — the spoiler-free share card. Its props (ShareCardData) carry board
 * number, trail, outcome, build-identity line, score, link — and STRUCTURALLY
 * nothing else: no card names, no board contents can reach this render.
 *
 * Design intent: busting produces the best-looking share — the bust variant
 * is deliberately the most stylish one (hazard stripes + tilt stamp).
 */
export function ShareCard({ data }: { data: ShareCardData }) {
  const busted = data.outcome === "busted";
  const fullclear = data.outcome === "fullclear";
  return (
    <div
      className={cn(
        "neo-border neo-shadow-lg rounded-xl overflow-hidden select-none",
        busted ? "draw-share-bust p-2" : fullclear ? "bg-yellow" : "bg-card",
      )}
      data-testid="draw-share-card"
    >
      <div
        className={cn(
          "rounded-lg p-4 flex flex-col gap-2",
          busted ? "neo-border bg-foreground text-background" : "",
        )}
      >
        <div className="flex items-center justify-between">
          <span className="font-heading font-bold text-xs tracking-widest">THE DRAW</span>
          <span className="font-mono font-bold text-xs">#{data.boardNumber}</span>
        </div>

        <div className="flex items-center justify-center py-1">
          <span
            className={cn(
              "font-heading font-black uppercase leading-none",
              busted
                ? "draw-share-stamp neo-border text-destructive border-destructive px-3 py-2 text-4xl"
                : fullclear
                  ? "text-3xl inline-flex items-center gap-2"
                  : "text-3xl",
            )}
          >
            {fullclear && <Crown size={28} strokeWidth={2.5} />}
            {OUTCOME_LABEL[data.outcome]}
          </span>
        </div>

        <p className="text-center text-2xl leading-none tracking-wide" aria-label="rounds trail">
          {data.trail}
        </p>

        {data.identity && (
          <p className="text-center">
            <span
              className={cn(
                "neo-border rounded font-mono font-bold text-[11px] px-2 py-1 inline-block",
                busted ? "bg-background text-foreground" : "bg-electric-blue text-electric-blue-foreground",
              )}
            >
              {data.identity}
            </span>
          </p>
        )}

        <p className="text-center font-mono font-bold text-4xl leading-none mt-1">
          {Math.round(data.score).toLocaleString("en-US")}
          <span className="text-xs align-top ml-1">PTS</span>
        </p>

        <p
          className={cn(
            "text-center font-heading font-bold text-[10px] tracking-wide mt-1",
            busted ? "opacity-80" : "text-muted-foreground",
          )}
        >
          {data.url.replace(/^https?:\/\//, "")}
        </p>
      </div>
    </div>
  );
}
