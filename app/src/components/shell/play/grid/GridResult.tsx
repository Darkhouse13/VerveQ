/**
 * GridResult — the VerveGrid end screen on the shared ResultScreen (VerveQ
 * ONE P3.2): cells filled as the score hero with the board as verdict
 * squares, the points in the hero pill, ONE lime Share, then a new grid and
 * a way back to the final board.
 *
 * Shows the player's OWN result only. No cross-player percentile is shown —
 * the backend does not expose a pick-share / solver-distribution metric, so it
 * is omitted rather than fabricated. Missed squares stay hidden on the board.
 */
import { Grid3x3, RotateCcw, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ResultScreen } from "@/components/shell/play/result/ResultScreen";
import { HeroPill, ResultHero } from "@/components/shell/play/result/ResultHero";
import { ResultActions } from "@/components/shell/play/result/ResultActions";

export interface GridResultProps {
  allSolved: boolean;
  correctCount: number;
  totalCells: number;
  points: number;
  /** Each cell's verdict in board order (undefined: never picked). */
  cells: ReadonlyArray<boolean | undefined>;
  onShare: () => void;
  onNewGrid: () => void;
  onReview: () => void;
}

export function GridResult({
  allSolved,
  correctCount,
  totalCells,
  points,
  cells,
  onShare,
  onNewGrid,
  onReview,
}: GridResultProps) {
  const { t } = useTranslation("play");
  return (
    <ResultScreen
      testId="grid-result"
      hero={
        <ResultHero
          eyebrow={allSolved ? t("grid.gridComplete") : t("grid.outOfGuesses")}
          score={correctCount}
          total={totalCells}
          caption={t("grid.cells")}
          squares={cells.map((c) => c === true)}
          squaresLabel={t("result.squares", { score: correctCount, total: totalCells })}
          // One group per board row.
          breaks={[3, 6]}
        >
          <HeroPill testId="grid-result-points">{t("grid.pointsTotal", { points })}</HeroPill>
        </ResultHero>
      }
      actions={
        <ResultActions
          primary={{
            label: t("dailyShare.cta"),
            icon: <Share2 size={18} aria-hidden="true" />,
            onClick: onShare,
            testId: "grid-share",
          }}
          secondary={[
            {
              label: t("grid.newGrid"),
              icon: <RotateCcw size={18} aria-hidden="true" />,
              onClick: onNewGrid,
              testId: "grid-new",
            },
            {
              label: t("grid.reviewBoard"),
              icon: <Grid3x3 size={18} aria-hidden="true" />,
              onClick: onReview,
              testId: "grid-review",
            },
          ]}
        />
      }
      footer={<p className="text-meta text-muted-foreground text-center">{t("grid.noAnswersRevealed")}</p>}
    />
  );
}
