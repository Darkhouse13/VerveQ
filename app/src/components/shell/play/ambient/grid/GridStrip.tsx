/**
 * GridStrip — mobile HUD strip for VerveGrid (the collapsed left rail).
 *
 * Three compact meta stats: guesses left, cells remaining, points. No board
 * content. Content-blind by contract (answer-leak guard).
 */
import { cn } from "@/lib/utils";
import type { GridRunStats } from "./types";

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "default" | "alert" | "highlight";
}) {
  return (
    <div
      className={cn(
        "neo-border rounded-lg px-2 py-1.5 text-center flex-1",
        tone === "alert"
          ? "bg-destructive text-destructive-foreground"
          : tone === "highlight"
            ? "bg-accent text-accent-foreground"
            : "bg-card text-card-foreground",
      )}
    >
      <p className="text-[8px] font-heading font-bold uppercase tracking-wide opacity-80 leading-none">
        {label}
      </p>
      <p className="font-heading font-bold text-lg leading-none mt-1">{value}</p>
    </div>
  );
}

export function GridStrip({ stats }: { stats: GridRunStats }) {
  return (
    <div className="md:hidden flex gap-2">
      <Cell label="Guesses" value={stats.guessesLeft} tone={stats.guessesLeft <= 2 ? "alert" : "default"} />
      <Cell label="Cells" value={stats.cellsRemaining} />
      <Cell label="Points" value={stats.points} tone="highlight" />
    </div>
  );
}
