/**
 * GridStage — the bespoke VerveGrid in-game layout for the v2 shell.
 *
 * Unlike the shared `PlayStage` (a phone-width answering column flanked by
 * rails), the grid is its own thing: the 3×3 board is the wide centerpiece.
 *
 *  - Desktop: `fixed inset-0`, never scrolls. A 3-column frame — your-run stats +
 *    how-it-works (left), the board (center), your pick log (right).
 *  - Mobile: a compact HUD strip above the board, which takes the focus.
 *
 * The board owns the prompt (the row × column criteria). The rails are ambient
 * (status + your picks) and content-blind by contract (answer-leak guard).
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";
import { GridRunPanel, GridPickLogPanel, GridStrip } from "@/components/shell/play/ambient/grid";
import type { GridRunStats, GridPickItem } from "@/components/shell/play/ambient/grid";
import { GridBoard } from "./GridBoard";
import { GridSearchSheet } from "./GridSearchSheet";
import { GridEndOverlay } from "./GridEndOverlay";
import type { VerveGridViewModel } from "@/hooks/useVerveGrid";

interface GridStageProps {
  vm: VerveGridViewModel;
  subtitle?: string;
  onExit: () => void;
  onHome: () => void;
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

export function GridStage({ vm, subtitle, onExit, onHome }: GridStageProps) {
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

  return (
    <div className="w-full bg-background text-foreground shell-canvas-bg flex flex-col fixed inset-0 z-40 h-[100dvh] overflow-hidden">
      {/* broadcast bar */}
      <header className="shrink-0 w-full bg-foreground text-background border-b-2 border-black">
        <div className="flex items-center gap-3 px-4 py-2.5 md:px-6">
          <button
            type="button"
            onClick={onExit}
            className="neo-border rounded-lg px-2.5 py-2 bg-foreground text-background border-background/30 shrink-0 cursor-pointer inline-flex items-center gap-1.5"
          >
            <LogOut size={14} strokeWidth={3} />
            <span className="text-[10px] font-heading font-bold uppercase">{t("grid.leave")}</span>
          </button>
          <span className="neo-border rounded-full bg-electric-blue text-electric-blue-foreground border-background px-2.5 py-1 font-heading font-bold uppercase tracking-wide text-[10px] inline-flex items-center gap-1 shrink-0">
            ▦ VerveGrid
          </span>
          {subtitle && (
            <span className="hidden md:inline font-mono text-xs text-background/70 truncate">{subtitle}</span>
          )}
        </div>
      </header>

      {/* desktop: 3-col never-scroll | mobile: strip + board */}
      {/* Large desktop: bound the stage to a laptop-equivalent frame and center
          it, so the board scales like on a laptop instead of ballooning and the
          rails stay near the board on ultra-wide screens. */}
      <main className="flex-1 min-h-0 w-full md:grid md:grid-cols-[17rem_1fr_17rem] md:gap-5 md:p-5 flex flex-col xl:max-h-[50rem] xl:my-auto min-[1440px]:max-w-7xl min-[1440px]:mx-auto">
        {/* left rail (desktop only) */}
        <aside className="hidden md:block md:overflow-y-auto md:min-h-0 scrollbar-none">
          <GridRunPanel stats={stats} />
        </aside>

        {/* mobile HUD strip */}
        <div className="md:hidden px-3 pt-3">
          <GridStrip stats={stats} />
        </div>

        {/* board centerpiece */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-3 md:p-0 overflow-hidden">
          <div className="w-full min-w-0 max-w-[32rem] md:max-w-none md:h-full grid place-items-center">
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
        </div>

        {/* right rail (desktop only) */}
        <aside className="hidden md:block md:min-h-0">
          <GridPickLogPanel picks={picks} totalCells={vm.totalCells} />
        </aside>
      </main>

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

      {vm.gameOver && (
        <GridEndOverlayGate
          allSolved={vm.allSolved}
          correctCount={vm.correctCount}
          totalCells={vm.totalCells}
          points={vm.points}
          onNewGrid={vm.startGame}
          onHome={onHome}
        />
      )}
    </div>
  );
}

/**
 * Local gate so "Review board" can dismiss the overlay to inspect the final
 * board (missed cells stay hidden) without ending the dismissed state on every
 * re-render. Kept inline to avoid leaking dismiss state into the hook.
 */
function GridEndOverlayGate({
  allSolved,
  correctCount,
  totalCells,
  points,
  onNewGrid,
  onHome,
}: {
  allSolved: boolean;
  correctCount: number;
  totalCells: number;
  points: number;
  onNewGrid: () => void;
  onHome: () => void;
}) {
  const [open, setOpen] = useState(true);
  // Re-open whenever a new game-over result arrives.
  useEffect(() => {
    setOpen(true);
  }, [allSolved, correctCount, points]);

  if (!open) return null;
  return (
    <GridEndOverlay
      allSolved={allSolved}
      correctCount={correctCount}
      totalCells={totalCells}
      points={points}
      onReview={() => setOpen(false)}
      onNewGrid={onNewGrid}
      onHome={onHome}
    />
  );
}
