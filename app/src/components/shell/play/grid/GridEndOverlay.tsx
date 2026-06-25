/**
 * GridEndOverlay — solved / failed summary for VerveGrid.
 *
 * Shows the player's OWN result only: cells filled and points earned. No
 * cross-player percentile is shown — the existing backend does not expose a
 * pick-share / solver-distribution metric, so it is omitted rather than
 * fabricated. Missed squares stay hidden on the board behind this overlay.
 */
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { DifficultySelector } from "@/components/shell/play/DifficultySelector";
import type { Difficulty } from "@/lib/difficulty";

interface GridEndOverlayProps {
  allSolved: boolean;
  correctCount: number;
  totalCells: number;
  points: number;
  difficulty: Difficulty;
  onDifficultyChange: (next: Difficulty) => void;
  onReview: () => void;
  onNewGrid: () => void;
  onHome: () => void;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "highlight" | "default";
}) {
  return (
    <div
      className={cn(
        "neo-border rounded-lg px-3 py-3 text-center flex-1",
        tone === "highlight" ? "bg-accent text-accent-foreground" : "bg-card text-card-foreground",
      )}
    >
      <p className="text-[9px] font-heading font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="font-heading font-bold text-3xl leading-none mt-1.5">{value}</p>
    </div>
  );
}

export function GridEndOverlay({
  allSolved,
  correctCount,
  totalCells,
  points,
  difficulty,
  onDifficultyChange,
  onReview,
  onNewGrid,
  onHome,
}: GridEndOverlayProps) {
  const { t } = useTranslation("play");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-5">
      <div className="w-full max-w-sm bg-background neo-border neo-shadow-lg rounded-xl overflow-hidden animate-slide-up">
        <div
          className={cn(
            "px-5 py-4 border-b-[3px] border-border",
            allSolved ? "bg-success text-success-foreground" : "bg-foreground text-background",
          )}
        >
          <p className="text-[10px] font-heading font-bold uppercase tracking-wide opacity-85">
            {allSolved ? t("grid.gridComplete") : t("grid.outOfGuesses")}
          </p>
          <p className="font-heading font-bold text-3xl leading-none mt-1.5">
            {allSolved
              ? t("grid.perfectScore", { total: totalCells })
              : t("grid.filledScore", { correct: correctCount, total: totalCells })}
          </p>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex gap-2.5">
            <Stat label={t("grid.points")} value={String(points)} tone="highlight" />
            <Stat label={t("grid.cells")} value={`${correctCount}/${totalCells}`} />
          </div>

          {/* Step the difficulty before replaying — losing should never be a
              dead end. The next grid honours the new tier. */}
          <div className="flex justify-center pt-0.5">
            <DifficultySelector value={difficulty} onChange={onDifficultyChange} size="md" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onNewGrid}
              className="neo-border neo-shadow rounded-lg bg-primary text-primary-foreground font-heading font-bold uppercase tracking-wide text-sm py-3 cursor-pointer active:neo-shadow-pressed"
            >
              {t("grid.newGrid")}
            </button>
            <button
              type="button"
              onClick={onHome}
              className="neo-border neo-shadow rounded-lg bg-background text-foreground font-heading font-bold uppercase tracking-wide text-sm py-3 cursor-pointer active:neo-shadow-pressed"
            >
              {t("grid.home")}
            </button>
          </div>

          <button
            type="button"
            onClick={onReview}
            className="w-full font-mono text-[11px] text-muted-foreground hover:text-foreground py-1 cursor-pointer"
          >
            {t("grid.reviewBoard")}
          </button>
          <p className="font-mono text-[9.5px] text-center text-muted-foreground">
            {t("grid.noAnswersRevealed")}
          </p>
        </div>
      </div>
    </div>
  );
}
