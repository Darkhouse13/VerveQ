/**
 * GridStage — VerveGrid in play, on the shared StageFrame (VerveQ ONE P3.2).
 *
 * The 3×3 board is the answering centerpiece and owns the prompt (the row ×
 * column criteria). The frame carries the canonical pieces: Quit (confirm
 * once a pick would be lost), the points as ☆ score top right, and ONE
 * progress row — the nine guesses, a verdict dot per pick. Under the board a
 * fixed verdict row says whether the last pick counts; a wrong pick is a game
 * event, not a toast. On desktop the rails stay ambient (your-run stats left,
 * your picks right) and content-blind by contract (answer-leak guard).
 *
 * At game over the board gives way to the shared ResultScreen; "Review board"
 * brings the final board back (missed cells stay hidden).
 */
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Star, Trophy } from "lucide-react";
import { notify } from "@/lib/notify";
import { buildGridSharePayload, gridEmojiBoard, shareResult } from "@/lib/gameShare";
import { Button } from "@/components/ui/button";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { StageScore, StepDots } from "@/components/shell/play/StageParts";
import { RevealedAnswer, VerdictBadge, VerdictSlot } from "@/components/shell/play/StageSignals";
import { GridRunPanel, GridPickLogPanel } from "@/components/shell/play/ambient/grid";
import type { GridRunStats, GridPickItem } from "@/components/shell/play/ambient/grid";
import { GridBoard } from "./GridBoard";
import { GridSearchSheet } from "./GridSearchSheet";
import { GridResult } from "./GridResult";
import type { VerveGridViewModel } from "@/hooks/useVerveGrid";

interface GridStageProps {
  vm: VerveGridViewModel;
  subtitle?: string;
  onExit: () => void;
  /**
   * Optional pre-board slot above the board. Used for the pre-run tier picker;
   * the stage stays presentation-only and does not know what the node means.
   */
  header?: ReactNode;
}

/** True below the md breakpoint — drives the board's compact sizing, live on resize. */
function useIsCompact(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setCompact(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return compact;
}

export function GridStage({ vm, subtitle, onExit, header }: GridStageProps) {
  const { t } = useTranslation("play");
  const isCompact = useIsCompact();
  const stats: GridRunStats = {
    guessesLeft: vm.remainingGuesses,
    cellsRemaining: vm.emptyCount,
    points: vm.points,
    correctCount: vm.correctCount,
    totalCells: vm.totalCells,
  };
  const picks: GridPickItem[] = vm.picks;

  // "Review board" hides the result to show the final board; a new result
  // (a new grid finished) brings it back.
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => {
    setReviewing(false);
  }, [vm.gameOver, vm.allSolved, vm.correctCount, vm.points]);

  const cellVerdicts = vm.cells.map((c) => c.correct);
  const totalGuesses = vm.guessResults.length + vm.remainingGuesses;

  const handleShare = async () => {
    const text = t("grid.shareText", {
      correct: vm.correctCount,
      total: vm.totalCells,
      points: vm.points,
      board: gridEmojiBoard(cellVerdicts),
    });
    const outcome = await shareResult(buildGridSharePayload(text));
    if (outcome === "copied") notify.success(t("result.shareCopied"));
    if (outcome === "failed") notify.error(t("result.shareFailed"));
  };

  // A locked-in pick is progress a quit throws away.
  const exitConfirm =
    !vm.gameOver && vm.guessResults.length > 0
      ? {
          title: t("grid.quitConfirm.title"),
          description: t("grid.quitConfirm.body"),
          confirmLabel: t("grid.quitConfirm.confirm"),
          cancelLabel: t("grid.quitConfirm.cancel"),
        }
      : undefined;

  const showResult = vm.gameOver && !reviewing;
  const verdict = vm.lastVerdict;

  return (
    <PlayStage
      mode="grid"
      title="VerveGrid"
      subtitle={subtitle}
      onExit={onExit}
      exitLabel={t("grid.quit")}
      exitConfirm={exitConfirm}
      score={
        <StageScore
          icon={<Star size={16} strokeWidth={3} />}
          value={vm.points}
          label={t("stage.scoreLabel", { value: vm.points })}
        />
      }
      progress={
        showResult ? undefined : (
          <StepDots
            total={Math.max(totalGuesses, vm.guessResults.length)}
            results={vm.guessResults}
            current={vm.guessResults.length}
            label={t("grid.guessesLabel", { count: vm.remainingGuesses })}
          />
        )
      }
      left={<GridRunPanel stats={stats} />}
      right={<GridPickLogPanel picks={picks} totalCells={vm.totalCells} />}
    >
      {showResult ? (
        <GridResult
          allSolved={vm.allSolved}
          correctCount={vm.correctCount}
          totalCells={vm.totalCells}
          points={vm.points}
          cells={cellVerdicts}
          onShare={() => void handleShare()}
          onNewGrid={vm.startGame}
          onReview={() => setReviewing(true)}
        />
      ) : (
        <div className="flex flex-col">
          {header && <div className="shrink-0">{header}</div>}
          <div className="w-full grid place-items-center">
            <GridBoard
              rows={vm.rows}
              cols={vm.cols}
              cells={vm.cells}
              gameOver={vm.gameOver}
              shakeCellIndex={vm.shakeCellIndex}
              onPick={vm.openCell}
              compact={isCompact}
            />
          </div>

          {/* The verdict row: did the last pick count? The answer pool never
              reaches the client, so a wrong pick reveals nothing more. */}
          <VerdictSlot className="mt-3" testId="grid-verdict">
            {vm.gameOver ? (
              <Button variant="secondary" size="md" onClick={() => setReviewing(false)} data-testid="grid-see-result">
                <Trophy size={18} aria-hidden="true" />
                {t("grid.seeResult")}
              </Button>
            ) : verdict ? (
              <>
                <VerdictBadge right={verdict.correct}>
                  {verdict.correct
                    ? t("grid.verdictRight", { name: verdict.name })
                    : t("grid.verdictWrong", { name: verdict.name })}
                </VerdictBadge>
                {verdict.correct && verdict.points != null && (
                  <RevealedAnswer className="font-mono text-body-sm">+{verdict.points}</RevealedAnswer>
                )}
              </>
            ) : null}
          </VerdictSlot>
        </div>
      )}

      <GridSearchSheet
        open={vm.searchOpen}
        criteria={vm.activeCriteria}
        query={vm.searchQuery}
        setQuery={vm.setSearchQuery}
        results={vm.searchResults}
        minChars={vm.minChars}
        guessesLeft={vm.remainingGuesses}
        submitting={vm.submitting}
        onSelect={vm.selectPlayer}
        onClose={vm.closeSheet}
      />
    </PlayStage>
  );
}
