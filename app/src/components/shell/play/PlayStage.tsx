/**
 * StageFrame (exported as `PlayStage` too) — the in-game frame shared by every
 * migrated game mode (VerveQ ONE P2.1).
 *
 * The header is the brand line: the VERVEQ wordmark eyebrow (plus the
 * subtitle) above the game title, a 44px Exit on the left — with a confirm
 * step only when leaving would lose progress — and an optional score slot on
 * the right. An optional progress row (StepDots) sits under it. The header
 * carries the reel's subtle lime diagonal stripe, and the frame sets
 * `--mode-accent` from `mode` so everything inside can identify the mode.
 *
 * The layout discipline (matches ShellLayout / LearnShell):
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
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ThemeScope } from "@/components/ui/theme-scope";
import { BrandMark } from "@/components/ui/BrandMark";
import { ExitButton, type ExitConfirm } from "@/components/ui/icon-button";

/** Modes whose frame carries a mode accent (`--mode-accent`). */
export type StageMode =
  | "whos-older"
  | "missing-letters"
  | "career-path"
  | "grid"
  | "higher-lower"
  | "arena"
  | "quiz"
  | "survival"
  | "daily-quiz"
  | "daily-survival"
  | "blitz"
  | "draw";

/** The color token each mode is identified by. */
const MODE_ACCENT: Record<StageMode, string> = {
  "whos-older": "var(--electric-blue)",
  "missing-letters": "var(--hot-pink)",
  "career-path": "var(--orange)",
  grid: "var(--orange)",
  "higher-lower": "var(--electric-blue)",
  arena: "var(--hot-pink)",
  // The open-ended solo modes wear orange; the once-a-day and against-the-
  // clock ones wear yellow (the Today tiles' color).
  quiz: "var(--orange)",
  survival: "var(--orange)",
  "daily-quiz": "var(--yellow)",
  "daily-survival": "var(--yellow)",
  blitz: "var(--yellow)",
  // THE DRAW wears lime as an OUTLINE only (its card faces are the identity);
  // the accent reaches small marks, never a fill.
  draw: "var(--lime)",
};

/** The reel's 6% lime diagonal hatch, scaled from its 1080px frame to a phone. */
const HEADER_TEXTURE: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(45deg, hsl(var(--lime) / 0.06) 0 2px, transparent 2px 22px)",
};

export interface StageFrameProps {
  /** Game title shown in the fixed header. */
  title?: string;
  /** Secondary line beside the wordmark (e.g. "Daily #24"). */
  subtitle?: string;
  /** Exit affordance handler; renders the Exit button when provided. */
  onExit?: () => void;
  exitLabel?: string;
  exitDisabled?: boolean;
  /** Ask before leaving — pass only when leaving would lose progress. */
  exitConfirm?: ExitConfirm;
  /** Optional header right slot (e.g. share). */
  headerRight?: ReactNode;
  /** Score slot, right of the title (see StageScore). */
  score?: ReactNode;
  /** Progress row under the header (see StepDots). */
  progress?: ReactNode;
  /** Sets `--mode-accent` for everything in the frame. */
  mode?: StageMode;
  /** A one-beat full-frame wash marking a verdict. */
  flash?: "right" | "wrong" | null;
  /** Left ambient rail (desktop) — roster status + standings. */
  left?: ReactNode;
  /** Right ambient rail (desktop) — metrics + progress. */
  right?: ReactNode;
  /** Mobile ambient strip — the collapsed rails. */
  strip?: ReactNode;
  /** Theme container class (e.g. `theme-weekend`). */
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

export function StageFrame({
  title,
  subtitle,
  onExit,
  exitLabel,
  exitDisabled = false,
  exitConfirm,
  headerRight,
  score,
  progress,
  mode,
  flash = null,
  left,
  right,
  strip,
  theme,
  wide = false,
  children,
}: StageFrameProps) {
  const { t } = useTranslation("play");
  const resolvedExitLabel = exitLabel ?? t("stage.exit");
  const accent = mode ? ({ "--mode-accent": MODE_ACCENT[mode] } as CSSProperties) : undefined;
  return (
    <ThemeScope theme={theme}>
    <div
      data-mode={mode}
      style={accent}
      className={cn(
        theme,
        "bg-background text-foreground shell-canvas-bg flex flex-col",
        // Fill the viewport and never scroll — on every device.
        "fixed inset-0 z-frame h-[100dvh] overflow-hidden",
        // iOS standalone insets: keeps the round pill / score header clear of
        // the status bar and the answer CTAs clear of the home indicator.
        "safe-pt safe-pb",
      )}
    >
      {(title || onExit || headerRight || score) && (
        <header className="shrink-0 w-full border-b-2 border-border bg-background" style={HEADER_TEXTURE}>
          <div className="mx-auto w-full max-w-6xl grid grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 px-2 py-1.5 md:px-6">
            <div className="justify-self-start min-w-0">
              {onExit && (
                <ExitButton
                  onExit={onExit}
                  label={resolvedExitLabel}
                  disabled={exitDisabled}
                  confirm={exitConfirm}
                  data-testid="stage-exit"
                />
              )}
            </div>
            <div className="min-w-0 text-center">
              <p className="flex items-center justify-center gap-1.5 text-muted-foreground">
                <BrandMark variant="wordmark" size="sm" />
                {subtitle && (
                  <>
                    <span aria-hidden="true" className="font-mono text-eyebrow">·</span>
                    <span className="font-mono text-eyebrow uppercase truncate">{subtitle}</span>
                  </>
                )}
              </p>
              {title && (
                <p className="mt-0.5 font-heading font-bold text-title-sm md:text-title truncate">{title}</p>
              )}
            </div>
            <div className="justify-self-end flex items-center gap-2 min-w-0">
              {score}
              {headerRight}
            </div>
          </div>
          {progress && <div className="mx-auto w-full max-w-md flex justify-center px-4 pb-2">{progress}</div>}
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

      {flash && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 z-overlay pointer-events-none opacity-0 animate-older-flash",
            flash === "right" ? "bg-verdict-right" : "bg-verdict-wrong",
          )}
        />
      )}
    </div>
    </ThemeScope>
  );
}

/** The frame every play screen uses; kept under its original name. */
export const PlayStage = StageFrame;
