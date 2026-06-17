/**
 * Progress ambient panel — question N of M (+ optional round label).
 * Content-blind by contract.
 */
import { useTranslation } from "react-i18next";
import type { PlayProgress } from "./types";

export function ProgressPanel({ progress }: { progress: PlayProgress }) {
  const { t } = useTranslation("play");
  const total = Math.max(1, progress.total);
  const current = Math.max(0, Math.min(progress.current, total));
  const dots = Array.from({ length: total });

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-heading font-bold text-[11px] uppercase tracking-wide text-muted-foreground">
          {t("ambient.progress")}
        </p>
        <p className="font-mono font-bold text-xs">
          {progress.roundLabel ? `${progress.roundLabel} · ` : ""}
          {current}/{total}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {dots.map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-sm neo-border ${i < current ? "bg-primary" : "bg-card"}`}
          />
        ))}
      </div>
    </section>
  );
}
