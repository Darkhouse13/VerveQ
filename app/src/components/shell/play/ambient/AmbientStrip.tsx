/**
 * Mobile ambient strip — the collapsed form of the side rails. A single compact
 * row carrying the essentials (timer, score, progress, and an optional roster
 * count) so phones keep the answering column front-and-center. Content-blind by
 * contract: consumes only the sanitized ambient view-model.
 */
import { Clock, Star, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { PlayMetrics, PlayProgress } from "./types";

export function AmbientStrip({
  metrics,
  progress,
  rosterCount,
}: {
  metrics?: PlayMetrics;
  progress?: PlayProgress;
  rosterCount?: number;
}) {
  const { t } = useTranslation("play");
  const showTimerBar = metrics?.timeFraction !== undefined;
  const pct = Math.max(0, Math.min(1, metrics?.timeFraction ?? 0));

  return (
    <div className="md:hidden space-y-1.5">
      <div className="flex items-center justify-between gap-2 font-mono font-bold text-xs">
        {metrics?.seconds !== undefined ? (
          <span className="inline-flex items-center gap-1">
            <Clock size={13} strokeWidth={3} />
            {t("ambient.seconds", { seconds: metrics.seconds })}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {rosterCount !== undefined && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Users size={13} strokeWidth={3} />
              {rosterCount}
            </span>
          )}
          {progress && (
            <span>
              {progress.roundLabel ? `${progress.roundLabel} · ` : ""}
              {progress.current}/{progress.total}
            </span>
          )}
          {metrics?.score !== undefined && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Star size={13} strokeWidth={3} />
              {metrics.score}
            </span>
          )}
        </div>
      </div>
      {showTimerBar && (
        <div className="neo-border rounded-lg bg-card overflow-hidden h-2">
          <div
            className={cn(
              "h-full transition-[width] duration-200 ease-linear",
              pct < 0.25 ? "bg-destructive" : pct < 0.5 ? "bg-accent" : "bg-success",
            )}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
