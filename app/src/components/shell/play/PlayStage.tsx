/**
 * PlayStage — the in-game "prototype layout" shared by every migrated game mode.
 *
 * The discipline (matches ShellLayout / LearnShell):
 *  - Mobile: normal flow inside App's `max-w-md` column. The side rails collapse
 *    to a single `strip` rendered above the answering column; the page scrolls.
 *  - Desktop (md+): breaks out to `fixed inset-0` to fill the viewport and never
 *    scroll. A 3-column grid frames a centered, phone-width answering column with
 *    ambient rails on each side. Each region can scroll internally as a safety
 *    valve, but the page itself stays locked.
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
  children,
}: PlayStageProps) {
  return (
    <div
      className={cn(
        theme,
        "relative min-h-[100dvh] w-full bg-background text-foreground flex flex-col",
        // Desktop: fill the viewport and never scroll.
        "md:fixed md:inset-0 md:z-40 md:min-h-0 md:h-[100dvh] md:overflow-hidden",
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
          "overflow-y-auto md:overflow-hidden scrollbar-none",
          "pt-4 pb-10 md:py-0",
        )}
      >
        {strip && <div className="md:hidden mb-3">{strip}</div>}

        <div className="md:h-full md:grid md:grid-cols-[1fr_28rem_1fr] md:gap-6 md:items-stretch">
          <aside className={cn(RAIL, "md:justify-self-end md:pr-1")}>{left}</aside>

          <div className="w-full max-w-md mx-auto md:overflow-y-auto scrollbar-none md:py-3">
            {children}
          </div>

          <aside className={cn(RAIL, "md:pl-1")}>{right}</aside>
        </div>
      </main>
    </div>
  );
}
