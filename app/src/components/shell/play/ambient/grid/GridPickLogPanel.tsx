/**
 * GridPickLogPanel — right ambient rail for VerveGrid (desktop).
 *
 * Lists the player's OWN correct picks (name + where it landed + difficulty),
 * surfaced only on lock-in. Never lists answers for unfilled cells. Content-blind
 * by contract (answer-leak guard).
 */
import { difficultyStyle, monogram } from "../../grid/difficulty";
import type { GridPickItem } from "./types";

export function GridPickLogPanel({
  picks,
  totalCells,
}: {
  picks: GridPickItem[];
  totalCells: number;
}) {
  return (
    <div className="neo-border neo-shadow rounded-xl bg-background p-3.5 flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-muted-foreground">
          Your pick log
        </p>
        <span className="neo-border rounded-full bg-card px-2 py-0.5 font-mono font-bold text-[9px]">
          {picks.length}/{totalCells}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none mt-3 space-y-2">
        {picks.length === 0 ? (
          <p className="font-mono text-[11px] leading-relaxed text-muted-foreground px-0.5 py-1">
            No picks yet — tap any square to search for a player who fits both its row &amp; column.
          </p>
        ) : (
          picks.map((pick) => {
            const style = difficultyStyle(pick.rarityTier);
            return (
              <div
                key={pick.id}
                className="neo-border rounded-lg bg-card p-2 flex items-center gap-2.5"
              >
                <div className="neo-border rounded-md bg-background w-7 h-7 shrink-0 grid place-items-center font-heading font-bold text-[10px]">
                  {monogram(pick.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold text-xs truncate">{pick.name}</p>
                  <p className="font-mono text-[9px] text-muted-foreground truncate">{pick.label}</p>
                </div>
                {style && (
                  <span className={`font-mono text-[10px] font-bold ${style.textClass}`}>
                    {pick.points ?? 0}p
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
