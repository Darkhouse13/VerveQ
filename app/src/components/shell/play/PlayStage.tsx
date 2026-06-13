/**
 * PlayStage — the in-game "prototype layout" shared by every migrated game mode.
 *
 * The discipline (matches ShellLayout / LearnShell):
 *  - ALL devices: `fixed inset-0`, the page itself never scrolls. On mobile the
 *    side rails collapse to a single `strip` above the answering column, which
 *    is sized to fit the viewport (the question image box is dvh-scaled).
 *  - Desktop (md+): a 3-column grid frames a centered, phone-width answering
 *    column with ambient rails on each side.
 *  - Each region can scroll internally as a safety valve on very short
 *    viewports, but the page stays locked.
 *
 * The rails are for AMBIENT state only (roster status, standings, timer, score,
 * lives, streak, combo — and per-player picks on reveal). The answering column
 * (`children`) owns the question and options. Ambient panels live under
 * `./ambient` and are content-blind by contract (enforced by the answer-leak
 * ESLint guard).
 */
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayStageProps {
  /** Eyebrow/title shown in the fixed header. */
  title?: string;
  /** Secondary line under the title (e.g. mode · phase). */
  subtitle?: string;
  /** Exit affordance handler; renders a Leave/Exit button when provided. */
  onExit?: () => void;
  exitLabel?: string;
  exitDisabled?: boolean;
  /** Optional header right slot (e.g. share). */
  headerRight?: ReactNode;
  /** Left ambient rail (desktop) — roster status + standings. */
  left?: ReactNode;
  /** Right ambient rail (desktop) — metrics + progress. */
  right?: ReactNode;
  /** Mobile ambient strip — the collapsed rails. */
  strip?: ReactNode;
  /** Theme container class (e.g. `theme-learn`). */
  theme?: string;
  /**
   * Opt-in wide layout for rail-less phases (e.g. the Arena lobby): the content
   * spans a roomy centered column instead of the phone-width answering column,
   * letting a screen that owns its own desktop grid use the viewport width and
   * fit common laptop heights without scrolling. Default keeps the 3-column
   * stage byte-identical for every in-game caller.
   */
  wide?: boolean;
  /** Centered answering column. */
  children: ReactNode;
}

const RAIL = "hidden md:flex md:flex-col md:gap-4 md:overflow-y-auto md:py-2 md:w-full md:max-w-[16rem]";

export function PlayStage({
  title,
  subtitle,
  onExit,
  exitLabel = "Leave",
  exitDisabled = false,
  headerRight,
  left,
  right,
  strip,
  theme,
  wide = false,
  children,
}: PlayStageProps) {
  return (
    <div
      className={cn(
        theme,
        "bg-background text-foreground shell-canvas-bg flex flex-col",
        // Fill the viewport and never scroll — on every device.
        "fixed inset-0 z-40 h-[100dvh] overflow-hidden",
      )}
    >
      {(title || onExit || headerRight) && (
        <header className="shrink-0 w-full border-b-[3px] border-border bg-background">
          <div className="mx-auto w-full max-w-6xl flex items-center gap-3 px-4 py-3 md:px-6">
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                disabled={exitDisabled}
                className="neo-border neo-shadow rounded-lg px-3 py-2 bg-background shrink-0 cursor-pointer active:neo-shadow-pressed inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                <LogOut size={14} strokeWidth={3} />
                <span className="text-[10px] font-heading font-bold uppercase">{exitLabel}</span>
              </button>
            )}
            <div className="min-w-0 flex-1 text-center md:text-left">
              {title && (
                <p className="font-heading font-bold text-base md:text-lg leading-tight truncate">
                  {title}
                </p>
              )}
              {subtitle && (
                <p className="text-[10px] md:text-xs font-heading uppercase tracking-wide text-muted-foreground truncate">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="shrink-0">{headerRight}</div>
          </div>
        </header>
      )}

      <main
        className={cn(
          "flex-1 min-h-0 w-full mx-auto max-w-6xl px-4 md:px-6",
          "overflow-hidden flex flex-col",
          "pt-3 md:py-0",
          // Large desktop: bound the stage to a laptop-equivalent height and
          // center it under the header so tall monitors don't stretch the
          // rails/answering column. Inert on short xl viewports.
          "xl:max-h-[48rem] xl:my-auto",
        )}
      >
        {strip && <div className="md:hidden shrink-0 mb-3">{strip}</div>}

        {wide ? (
          // Rail-less wide layout: one roomy centered column. The screen owns
          // its own md grid inside `children`, so we hand it the full width
          // (capped for readability) and keep the internal scroll safety valve.
          <div className="w-full max-w-3xl mx-auto flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1.5 pb-4 md:py-3">
            {children}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[1fr_28rem_1fr] md:gap-6 md:items-stretch">
            <aside className={cn(RAIL, "md:justify-self-end md:pr-1")}>{left}</aside>

            {/* Visible scrollbar: on short viewports the controls live below the
                fold and a hidden-scroll column reads as a broken, unclickable game.
                overflow-x stays clipped so the pressed-state translate never
                spawns a horizontal scrollbar — px-1.5 keeps the 4px neo shadows
                inside the clip so cards don't look cut on the right. */}
            <div className="w-full max-w-md mx-auto flex-1 min-h-0 md:flex-none md:h-full overflow-y-auto overflow-x-hidden px-1.5 pb-4 md:py-3">
              {children}
            </div>

            <aside className={cn(RAIL, "md:pl-1")}>{right}</aside>
          </div>
        )}
      </main>
    </div>
  );
}
