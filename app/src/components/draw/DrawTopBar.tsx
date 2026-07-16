import type { ReactNode } from "react";
import { X } from "lucide-react";
import { LAYOUT } from "./layout";

interface DrawTopBarProps {
  boardNumber: number | null;
  /** Right slot — cumulative score in-run, streak chip elsewhere. */
  right?: ReactNode;
  onExit: () => void;
}

/** 48px top bar: mode name, exit, cumulative score (LAYOUT_SPEC "Global"). */
export function DrawTopBar({ boardNumber, right, onExit }: DrawTopBarProps) {
  return (
    <div
      className="flex items-center justify-between gap-2 shrink-0"
      style={{ height: LAYOUT.topBarH }}
      data-testid="draw-top-bar"
    >
      <button
        type="button"
        aria-label="Exit"
        onClick={onExit}
        className="neo-border neo-shadow-sm rounded-lg bg-background p-2 cursor-pointer active:neo-shadow-pressed"
      >
        <X size={14} strokeWidth={3} />
      </button>
      <div className="min-w-0 text-center">
        <p className="font-heading font-bold text-sm leading-tight tracking-wide">THE DRAW</p>
        {boardNumber !== null && (
          <p className="font-mono text-[10px] leading-tight text-muted-foreground">
            BOARD #{boardNumber}
          </p>
        )}
      </div>
      <div className="shrink-0 min-w-[44px] flex justify-end">{right}</div>
    </div>
  );
}
