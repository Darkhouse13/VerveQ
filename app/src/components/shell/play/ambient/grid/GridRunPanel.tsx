/**
 * GridRunPanel — left ambient rail for VerveGrid (desktop).
 *
 * Carries ONLY meta status: guesses left, cells remaining, points, a difficulty
 * legend, and the static "how it works" copy. No board criteria, no answers.
 * Content-blind by contract (answer-leak guard).
 */
import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { GridRunStats } from "./types";

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "default" | "alert" | "highlight";
}) {
  return (
    <div
      className={cn(
        "neo-border rounded-lg px-2 py-2.5 text-center flex-1 min-w-0",
        tone === "alert"
          ? "bg-destructive text-destructive-foreground"
          : tone === "highlight"
            ? "bg-accent text-accent-foreground"
            : "bg-card text-card-foreground",
      )}
    >
      <p className="text-[9px] font-heading font-bold uppercase tracking-wide leading-none opacity-80">
        {label}
      </p>
      <p className="font-heading font-bold text-2xl leading-none mt-1.5">{value}</p>
      {sub && <p className="font-mono text-[8px] mt-1.5 opacity-70 leading-none">{sub}</p>}
    </div>
  );
}

const LEGEND: { id: string; labelKey: string; dot: string; worth: number }[] = [
  { id: "rare", labelKey: "ambient.tierRare", dot: "bg-hot-pink", worth: 3 },
  { id: "uncommon", labelKey: "ambient.tierUncommon", dot: "bg-electric-blue", worth: 2 },
  { id: "common", labelKey: "ambient.tierCommon", dot: "bg-muted", worth: 1 },
];

export function GridRunPanel({
  stats,
  timeLabel,
}: {
  stats: GridRunStats;
  /** Optional run clock label (purely cosmetic; the backend is untimed). */
  timeLabel?: string;
}) {
  const { t } = useTranslation("play");
  return (
    <div className="space-y-4">
      <section className="neo-border neo-shadow rounded-xl bg-background p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-muted-foreground">
            {t("ambient.yourRun")}
          </p>
          <span className="neo-border rounded-full bg-yellow text-yellow-foreground px-2 py-0.5 font-mono font-bold text-[9px]">
            {stats.correctCount}/{stats.totalCells} ✓
          </span>
        </div>

        <div className="flex gap-2">
          <Stat
            label={t("ambient.guesses")}
            value={stats.guessesLeft}
            sub={t("ambient.guessesLeft")}
            tone={stats.guessesLeft <= 2 ? "alert" : "default"}
          />
          <Stat label={t("ambient.cells")} value={stats.cellsRemaining} sub={t("ambient.cellsRemaining")} />
          <Stat label={t("ambient.points")} value={stats.points} sub={t("ambient.rarerMore")} tone="highlight" />
        </div>

        <div className="border-t-[3px] border-border" />

        <div>
          <p className="text-[9px] font-heading font-bold uppercase tracking-wide text-muted-foreground mb-2">
            {t("ambient.difficultyScale")}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {LEGEND.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold">
                <span className={cn("w-2.5 h-2.5 rounded-sm border-2 border-border", l.dot)} />
                {t(l.labelKey)}
                <span className="text-muted-foreground font-normal">{t("ambient.pts", { count: l.worth })}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="neo-border neo-shadow rounded-xl bg-muted p-3.5">
        <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
          {t("ambient.howItWorks")}
        </p>
        <p className="text-xs leading-relaxed text-foreground/80">
          <Trans
            i18nKey="ambient.howItWorksBody"
            ns="play"
            values={{ totalCells: stats.totalCells }}
            components={{ strong: <b className="text-foreground" /> }}
          />
        </p>
        {timeLabel && (
          <p className="font-mono text-[10px] text-muted-foreground mt-2">⏱ {timeLabel}</p>
        )}
      </section>
    </div>
  );
}
