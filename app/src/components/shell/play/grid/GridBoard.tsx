/**
 * GridBoard — the 3×3 VerveGrid board (the answering centerpiece, NOT ambient).
 *
 * It owns the PROMPT: the row × column criteria headers. Each header is a
 * neutral monogram tile plus the criterion's name (initials only — never a
 * club crest). Empty cells are tappable and open the search sheet; filled
 * cells show the player's OWN pick (right → ✓, name, rarity, points; wrong →
 * ✕ and the muted name). At game over, untouched cells render as hidden
 * "missed" tiles — the correct answer is never revealed (the client never
 * receives the answer pool).
 *
 * Green and red appear only as the verdict marks; the Grid accent (orange)
 * marks the corner and the rare-pick tier. No text under 12px.
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

  // Game over + untouched → missed. Never reveals the answer.
  if (isEmpty && gameOver) {
    return (
      <div className="bg-muted flex flex-col items-center justify-center gap-1 min-h-0 overflow-hidden text-muted-foreground" data-cell="missed">
        <span className="font-heading text-title-sm leading-none" aria-hidden="true">
          —
        </span>
        <span className="font-mono text-eyebrow uppercase">{t("grid.missed")}</span>
      </div>
    );
  }

  if (isCorrect) {
    return (
      <div
        className={cn("relative bg-background text-foreground flex flex-col min-h-0 overflow-hidden", compact ? "p-1.5" : "p-2")}
        data-cell="right"
      >
        {/* The verdict mark — a small corner check so the name owns the width. */}
        <span
          className={cn(
            "absolute top-1 right-1 z-raised grid place-items-center rounded-md neo-border bg-verdict-right text-ink",
            compact ? "w-5 h-5" : "w-6 h-6",
          )}
          aria-hidden="true"
        >
          <Check size={compact ? 12 : 14} strokeWidth={3.5} />
        </span>
        {/* The name: full width, up to 2 lines, whitespace-only wrap. */}
        <div className="flex-1 flex flex-col justify-center min-h-0">
          <p className={cn("font-heading font-bold leading-tight line-clamp-2", compact ? "text-meta pr-5" : "text-body-sm pr-6")}>
            {cell.guessedPlayerName}
          </p>
        </div>
        {/* rarity + points, pinned low */}
        <div className="flex items-center gap-1 pt-1 flex-wrap">
          {style && (
            <span className={cn("neo-border rounded-full px-1.5 font-mono font-bold text-eyebrow tracking-normal leading-tight", style.badgeClass)}>
              {t(style.labelKey)}
            </span>
          )}
          <span className="font-mono font-bold text-eyebrow tracking-normal">{cell.points ?? 0}p</span>
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
        data-cell="wrong"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-verdict-wrong text-ink" aria-hidden="true">
          <X size={14} strokeWidth={3.5} />
        </span>
        <p className="font-body text-eyebrow tracking-normal text-muted-foreground leading-tight px-1 line-clamp-2 max-w-full">
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
        "bg-card hover:bg-muted active:bg-muted flex flex-col items-center justify-center w-full h-full min-h-0 overflow-hidden transition-colors duration-ui cursor-pointer",
        compact ? "gap-1" : "gap-1.5",
        shaking && "animate-shake-horizontal",
      )}
      data-cell="empty"
    >
      <span
        className={cn(
          "rounded-lg border-2 border-dashed border-muted-foreground grid place-items-center text-muted-foreground",
          compact ? "w-7 h-7" : "w-9 h-9",
        )}
        aria-hidden="true"
      >
        <Plus size={compact ? 16 : 20} strokeWidth={3} />
      </span>
      <span className="font-mono text-eyebrow tracking-normal text-muted-foreground">{t("grid.tapToPick")}</span>
    </button>
  );
}

/** A criterion header: a neutral monogram tile and the name, readable. */
function AxisHeader({ label, compact, axis }: { label: string; compact?: boolean; axis: "row" | "col" }) {
  return (
    <div className="bg-background flex flex-col items-center justify-center text-center gap-1 px-1 overflow-hidden" data-axis={axis}>
      <span
        className={cn(
          "grid place-items-center rounded-md neo-border bg-muted text-foreground font-mono font-bold text-eyebrow tracking-normal shrink-0",
          compact ? "w-6 h-6" : "w-8 h-8",
        )}
        aria-hidden="true"
      >
        {monogram(label)}
      </span>
      <p className={cn("font-heading font-bold leading-tight line-clamp-2 break-words hyphens-auto max-w-full", compact ? "text-eyebrow tracking-normal" : "text-meta")}>
        {label}
      </p>
    </div>
  );
}

export function GridBoard({ rows, cols, cells, gameOver, shakeCellIndex, onPick, compact }: GridBoardProps) {
  // Header tracks wide enough for a 12px club name on two lines.
  const headerCol = compact ? "minmax(72px, 0.85fr)" : "minmax(88px, 0.75fr)";
  const headerRow = compact ? "minmax(58px, 0.65fr)" : "minmax(68px, 0.6fr)";

  return (
    <div
      className="neo-border neo-shadow-lg rounded-lg overflow-hidden w-full"
      data-testid="grid-board"
      style={{
        display: "grid",
        // minmax(0,1fr) lets columns shrink below their content's min width so the
        // board always fits its container (badges/names clip rather than overflow).
        gridTemplateColumns: `${headerCol} minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)`,
        gridTemplateRows: `${headerRow} minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)`,
        gap: 3,
        background: "hsl(var(--border))",
        // Square-ish board on every breakpoint: height tracks the (full) width
        // so mobile cells stay roughly square instead of collapsing to short,
        // wide rectangles. maxHeight:100% still clamps it on very short screens.
        aspectRatio: "1.04 / 1",
        maxHeight: "100%",
        maxWidth: "100%",
      }}
    >
      {/* corner mark */}
      <div className="bg-card text-mode-accent grid place-items-center" aria-hidden="true">
        <span className={cn("font-heading leading-none", compact ? "text-title-sm" : "text-title")}>▦</span>
      </div>

      {cols.map((col, ci) => (
        <AxisHeader key={`col-${ci}`} label={col.label} compact={compact} axis="col" />
      ))}

      {rows.map((row, ri) => (
        <div key={`row-${ri}`} style={{ display: "contents" }}>
          <AxisHeader label={row.label} compact={compact} axis="row" />
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
