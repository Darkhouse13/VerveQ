/**
 * Metrics ambient panel — timer, score, lives, streak, combo. Each metric
 * renders only when present, so solo and multi modes share one panel.
 * Content-blind by contract.
 */
import type { ReactNode } from "react";
import { Clock, Flame, Heart, Star, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { PlayMetrics } from "./types";

function Stat({
  icon,
  label,
  value,
  tint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tint?: string;
}) {
  return (
    <div className="neo-border rounded-lg bg-card px-2.5 py-2 flex items-center gap-2">
      <span className={cn("shrink-0", tint)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] font-heading font-bold uppercase tracking-wide text-muted-foreground leading-none">
          {label}
        </p>
        <p className="font-mono font-bold text-sm leading-tight">{value}</p>
      </div>
    </div>
  );
}

export function MetricsPanel({ metrics }: { metrics: PlayMetrics }) {
  const { t } = useTranslation("play");
  // The depleting bar is for windowed (countdown) timers only; count-up timers
  // pass just `seconds` and get a plain readout, no bar.
  const hasBar = metrics.timeFraction !== undefined;
  const pct = Math.max(0, Math.min(1, metrics.timeFraction ?? 0));

  return (
    <section className="space-y-2">
      {(hasBar || metrics.seconds !== undefined) && (
        <div className="space-y-1.5">
          {hasBar && (
            <div className="neo-border rounded-lg bg-card overflow-hidden h-2.5">
              <div
                className={cn(
                  "h-full transition-[width] duration-200 ease-linear",
                  pct < 0.25 ? "bg-destructive" : pct < 0.5 ? "bg-accent" : "bg-success",
                )}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
          )}
          {metrics.seconds !== undefined && (
            <p className="font-mono font-bold text-sm inline-flex items-center gap-1">
              <Clock size={12} strokeWidth={3} />
              {t("ambient.seconds", { seconds: metrics.seconds })}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {metrics.score !== undefined && (
          <Stat icon={<Star size={14} strokeWidth={3} />} label={t("ambient.score")} value={metrics.score} tint="text-primary" />
        )}
        {metrics.lives !== undefined && (
          <Stat icon={<Heart size={14} strokeWidth={3} />} label={t("ambient.lives")} value={metrics.lives} tint="text-destructive" />
        )}
        {metrics.streak !== undefined && (
          <Stat icon={<Flame size={14} strokeWidth={3} />} label={t("ambient.streak")} value={metrics.streak} tint="text-hot-pink" />
        )}
        {metrics.combo !== undefined && (
          <Stat icon={<Zap size={14} strokeWidth={3} />} label={t("ambient.combo")} value={`${metrics.combo}×`} tint="text-accent-foreground" />
        )}
      </div>
    </section>
  );
}
