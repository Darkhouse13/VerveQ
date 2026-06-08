/**
 * Standings ambient panel — rank, name, score. Content-blind by contract.
 */
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StandingEntry } from "./types";

export function StandingsPanel({
  title = "Standings",
  entries,
}: {
  title?: string;
  entries: StandingEntry[];
}) {
  return (
    <section className="space-y-2">
      <p className="font-heading font-bold text-[11px] uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ol className="space-y-1.5">
        {entries.map((s) => (
          <li
            key={s.id}
            className={cn(
              "neo-border rounded-lg px-2.5 py-1.5 flex items-center gap-2",
              s.isMe ? "bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            <span className="font-mono font-bold text-xs w-5 shrink-0 inline-flex items-center gap-0.5">
              {s.rank === 1 ? <Crown size={12} strokeWidth={3} /> : s.rank}
            </span>
            <span className="font-heading font-bold text-xs truncate min-w-0 flex-1">
              {s.name}
              {s.isMe && " (you)"}
            </span>
            <span className="font-mono font-bold text-xs shrink-0">{s.score}</span>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="text-[11px] text-muted-foreground">No scores yet</li>
        )}
      </ol>
    </section>
  );
}
