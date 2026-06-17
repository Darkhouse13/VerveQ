/**
 * GridBoard — the 3×3 VerveGrid board (the answering centerpiece, NOT ambient).
 *
 * It owns the PROMPT: the row × column criteria headers. Empty cells are
 * tappable and open the search sheet; filled cells show the player's OWN pick
 * (correct → name + difficulty + points; wrong → muted name). At game over,
 * untouched cells render as hidden "MISSED" tiles — the correct answer is never
 * revealed (the client never receives the answer pool).
 */
import { Check, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { difficultyStyle, monogram } from "./difficulty";
import type { GridAxis, GridCellState } from "@/hooks/useVerveGrid";

interface GridBoardProps {
  rows: GridAxis[];
  cols: GridAxis[];
  cells: GridCellState[];
  gameOver: boolean;
  shakeCellIndex: number | null;
  onPick: (cellIndex: number) => void;
  compact?: boolean;
}

function Cell({
  cell,
  gameOver,
  shaking,
  compact,
  onPick,
}: {
  cell: GridCellState | undefined;
  gameOver: boolean;
  shaking: boolean;
  compact?: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation("play");
  const isCorrect = cell?.correct === true;
  const isWrong = cell?.correct === false;
  const isEmpty = !cell || cell.correct === undefined;
  const style = difficultyStyle(cell?.rarityTier);

  // Game over + untouched → MISSED. Never reveals the answer.
  if (isEmpty && gameOver) {
    return (
      <div
        className="bg-card flex flex-col items-center justify-center gap-1 min-h-0 overflow-hidden"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, hsl(var(--muted)) 0 8px, transparent 8px 16px)",
        }}
      >
        <span className={cn("font-heading text-muted-foreground", compact ? "text-xl" : "text-2xl")}>
          —
        </span>
        <span className="font-mono font-bold tracking-wider text-destructive" style={{ fontSize: compact ? 7 : 9 }}>
          {t("grid.missed")}
        </span>
      </div>
    );
  }

  if (isCorrect) {
    return (
      <div className={cn("bg-background text-foreground flex flex-col min-h-0 overflow-hidden", compact ? "p-1.5 gap-1" : "p-2.5 gap-2")}>
        <div className="flex items-center gap-2 min-h-0">
          <div
            className={cn(
              "neo-border rounded-md bg-success text-success-foreground grid place-items-center shrink-0",
              compact ? "w-7 h-7" : "w-9 h-9",
            )}
          >
            <Check size={compact ? 13 : 16} strokeWidth={3} />
          </div>
          <div className="min-w-0">
            <p className={cn("font-heading font-bold leading-tight truncate", compact ? "text-[11px]" : "text-sm")}>
              {cell.guessedPlayerName}
            </p>
            <p className="font-mono text-muted-foreground" style={{ fontSize: compact ? 8 : 10 }}>
              {t("grid.lockedIn")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-auto">
          {style && (
            <span
              className={cn("neo-border rounded-full font-mono font-bold tracking-wide", style.badgeClass)}
              style={{ fontSize: compact ? 7.5 : 9, padding: compact ? "1px 5px" : "2px 7px" }}
            >
              {style.label}
            </span>
          )}
          <span className="font-mono font-bold" style={{ fontSize: compact ? 9 : 11 }}>
            {cell.points ?? 0}p
          </span>
        </div>
      </div>
    );
  }

  if (isWrong) {
    return (
      <div
        className={cn(
          "bg-muted flex flex-col items-center justify-center gap-1 min-h-0 text-center overflow-hidden",
          shaking && "animate-shake-horizontal",
        )}
      >
        <X size={compact ? 14 : 18} strokeWidth={3} className="text-destructive" />
        <p className="font-body text-muted-foreground leading-tight px-1 truncate max-w-full" style={{ fontSize: compact ? 8 : 9.5 }}>
          {cell?.guessedPlayerName}
        </p>
      </div>
    );
  }

  // Empty + tappable
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "bg-card hover:bg-muted/60 active:bg-muted flex flex-col items-center justify-center w-full h-full min-h-0 overflow-hidden transition-colors cursor-pointer",
        compact ? "gap-1" : "gap-1.5",
        shaking && "animate-shake-horizontal",
      )}
    >
      <span
        className={cn(
          "rounded-lg border-[2.5px] border-dashed border-muted-foreground/60 grid place-items-center text-muted-foreground",
          compact ? "w-7 h-7" : "w-9 h-9",
        )}
      >
        <Plus size={compact ? 16 : 20} strokeWidth={3} />
      </span>
      <span className="font-mono uppercase tracking-wider text-muted-foreground" style={{ fontSize: compact ? 7.5 : 9 }}>
        {t("grid.tapToPick")}
      </span>
    </button>
  );
}

export function GridBoard({ rows, cols, cells, gameOver, shakeCellIndex, onPick, compact }: GridBoardProps) {
  const headerCol = compact ? "minmax(52px, 0.6fr)" : "minmax(68px, 0.62fr)";
  const headerRow = compact ? "minmax(42px, 0.5fr)" : "minmax(52px, 0.55fr)";

  return (
    <div
      className="neo-border neo-shadow-lg rounded-xl overflow-hidden w-full"
      style={{
        display: "grid",
        // minmax(0,1fr) lets columns shrink below their content's min width so the
        // board always fits its container (badges/names clip rather than overflow).
        gridTemplateColumns: `${headerCol} minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)`,
        gridTemplateRows: `${headerRow} minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)`,
        gap: 3,
        background: "hsl(var(--border))",
        aspectRatio: compact ? undefined : "1.04 / 1",
        maxHeight: "100%",
        maxWidth: "100%",
      }}
    >
      {/* corner mark */}
      <div className="bg-foreground text-background flex flex-col items-center justify-center gap-0.5">
        <span className="font-heading text-yellow" style={{ fontSize: compact ? 16 : 22 }}>
          ▦
        </span>
        <span className="font-mono tracking-wider opacity-60" style={{ fontSize: compact ? 6 : 7.5 }}>
          3×3
        </span>
      </div>

      {/* column headers */}
      {cols.map((col, ci) => (
        <div
          key={`col-${ci}`}
          className="bg-background flex flex-col items-center justify-center text-center gap-1 px-1 overflow-hidden"
        >
          <span
            className="neo-border rounded-md bg-electric-blue text-electric-blue-foreground grid place-items-center font-heading font-bold shrink-0 -rotate-3"
            style={{ width: compact ? 24 : 30, height: compact ? 24 : 30, fontSize: compact ? 8 : 10 }}
          >
            {monogram(col.label)}
          </span>
          <p className="font-heading font-bold leading-none" style={{ fontSize: compact ? 9.5 : 12 }}>
            {col.label}
          </p>
        </div>
      ))}

      {/* rows */}
      {rows.map((row, ri) => (
        <div key={`row-${ri}`} style={{ display: "contents" }}>
          <div className="bg-background flex flex-col items-center justify-center text-center gap-1 px-1 overflow-hidden">
            <span
              className="neo-border rounded-md bg-hot-pink text-hot-pink-foreground grid place-items-center font-heading font-bold shrink-0 rotate-3"
              style={{ width: compact ? 24 : 30, height: compact ? 24 : 30, fontSize: compact ? 8 : 10 }}
            >
              {monogram(row.label)}
            </span>
            <p className="font-heading font-bold leading-tight" style={{ fontSize: compact ? 9 : 11 }}>
              {row.label}
            </p>
          </div>
          {cols.map((_, ci) => {
            const cellIndex = ri * 3 + ci;
            return (
              <Cell
                key={`cell-${cellIndex}`}
                cell={cells[cellIndex]}
                gameOver={gameOver}
                shaking={shakeCellIndex === cellIndex}
                compact={compact}
                onPick={() => onPick(cellIndex)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
