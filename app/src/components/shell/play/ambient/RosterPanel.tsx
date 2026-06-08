/**
 * Roster ambient panel. While a question is open it shows player STATUS only
 * (answering / answered / left) — never who picked what. On reveal the screen
 * may pass sanitized per-player `picks`, which is the one moment picks are shown.
 *
 * Content-blind by contract: consumes only the sanitized ambient view-model.
 */
import { Check, Hourglass, LogOut, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RosterEntry, RevealPick } from "./types";

const STATE_META: Record<
  RosterEntry["state"],
  { Icon: typeof Check; tint: string; label: string }
> = {
  answered: { Icon: Check, tint: "text-success", label: "Answered" },
  answering: { Icon: Hourglass, tint: "text-accent-foreground", label: "Thinking" },
  left: { Icon: LogOut, tint: "text-muted-foreground", label: "Left" },
  idle: { Icon: Minus, tint: "text-muted-foreground", label: "Idle" },
};

function PanelTitle({ children }: { children: string }) {
  return (
    <p className="font-heading font-bold text-[11px] uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export function RosterPanel({
  title = "Roster",
  entries,
  picks,
}: {
  title?: string;
  entries: RosterEntry[];
  /** Sanitized per-player picks — pass ONLY on reveal. */
  picks?: RevealPick[];
}) {
  if (picks && picks.length > 0) {
    return (
      <section className="space-y-2">
        <PanelTitle>Picks</PanelTitle>
        <ul className="space-y-1.5">
          {picks.map((p) => (
            <li
              key={p.id}
              className={cn(
                "neo-border rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2",
                p.isMe ? "bg-primary text-primary-foreground" : "bg-card",
              )}
            >
              <div className="min-w-0">
                <p className="font-heading font-bold text-xs truncate">
                  {p.name}
                  {p.isMe && " (you)"}
                </p>
                <p className="text-[10px] font-mono truncate opacity-80">{p.label || "—"}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[10px] font-heading font-bold uppercase",
                  p.outcome === "correct"
                    ? "text-success"
                    : p.outcome === "wrong"
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {p.outcome === "correct"
                  ? `+${p.points ?? 0}`
                  : p.outcome === "wrong"
                    ? "Wrong"
                    : "Missed"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <PanelTitle>{title}</PanelTitle>
      <ul className="space-y-1.5">
        {entries.map((e) => {
          const meta = STATE_META[e.state];
          return (
            <li
              key={e.id}
              className={cn(
                "neo-border rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2",
                e.isMe ? "bg-primary text-primary-foreground" : "bg-card",
              )}
            >
              <span className="font-heading font-bold text-xs truncate min-w-0">
                {e.name}
                {e.isMe && " (you)"}
              </span>
              <span
                className={cn("shrink-0 inline-flex items-center gap-1", meta.tint)}
                title={meta.label}
              >
                <meta.Icon size={13} strokeWidth={3} />
              </span>
            </li>
          );
        })}
        {entries.length === 0 && (
          <li className="text-[11px] text-muted-foreground">No players yet</li>
        )}
      </ul>
    </section>
  );
}
