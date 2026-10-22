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
        // A row, not a column tile: at the 12px type floor three tiles
        // side by side clipped "GUESSES" / "remaining" in a 16rem rail.
        "neo-border rounded-lg px-3 py-2 flex items-center justify-between gap-3 min-w-0",
        // Filled tones carry .on-fill so their muted labels go dark too.
        tone === "alert"
          ? "bg-foreground text-background on-fill"
          : tone === "highlight"
            ? "bg-mode-accent text-ink on-fill"
            : "bg-card text-card-foreground",
      )}
    >
      <div className="min-w-0">
      <p className="text-eyebrow font-heading font-bold uppercase leading-none text-muted-foreground">
        {label}
      </p>
      {sub && <p className="font-mono text-meta mt-1 text-muted-foreground leading-none truncate">{sub}</p>}
      </div>
      <p className="font-heading font-bold text-title leading-none shrink-0 tabular-nums">{value}</p>
    </div>
  );
}

const LEGEND: { id: string; labelKey: string; dot: string; worth: number }[] = [
  { id: "rare", labelKey: "ambient.tierRare", dot: "bg-mode-accent", worth: 3 },
  { id: "uncommon", labelKey: "ambient.tierUncommon", dot: "bg-card", worth: 2 },
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
      <section className="neo-border neo-shadow rounded-lg bg-background p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-eyebrow font-heading font-bold uppercase text-muted-foreground">
            {t("ambient.yourRun")}
          </p>
          <span className="neo-border rounded-full bg-card text-card-foreground px-2 py-0.5 font-mono font-bold text-eyebrow tracking-normal">
            {stats.correctCount}/{stats.totalCells} ✓
          </span>
        </div>

        <div className="flex flex-col gap-2">
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
          <p className="text-eyebrow font-heading font-bold uppercase text-muted-foreground mb-2">
            {t("ambient.difficultyScale")}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {LEGEND.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1.5 font-mono text-meta font-bold">
                <span className={cn("w-2.5 h-2.5 rounded-sm border-2 border-border", l.dot)} />
                {t(l.labelKey)}
                <span className="text-muted-foreground font-normal">{t("ambient.pts", { count: l.worth })}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="neo-border neo-shadow rounded-lg bg-muted p-3.5">
        <p className="text-eyebrow font-heading font-bold uppercase text-muted-foreground mb-1.5">
          {t("ambient.howItWorks")}
        </p>
        <p className="text-meta leading-relaxed text-foreground/80">
          <Trans
            i18nKey="ambient.howItWorksBody"
            ns="play"
            values={{ totalCells: stats.totalCells }}
            components={{ strong: <b className="text-foreground" /> }}
          />
        </p>
        {timeLabel && (
          <p className="font-mono text-meta text-muted-foreground mt-2">⏱ {timeLabel}</p>
        )}
      </section>
    </div>
  );
}
