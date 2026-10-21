import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { StageTimer } from "@/components/shell/play/StageSignals";

/** The Blitz window; the server's `endTimeMs` is the authority on what is left. */
const BLITZ_WINDOW_SECONDS = 60;

interface BlitzClockProps {
  endTimeMs: number;
  onExpired: () => void;
  penaltyFlash: boolean;
  /**
   * Optional, additive: fires every tick with the whole seconds remaining so a
   * caller can mirror the countdown without running a second timer.
   */
  onTick?: (remaining: number) => void;
}

/**
 * Blitz's countdown — the run's one clock, drawn with the shared StageTimer
 * (VerveQ ONE P3.1/P3.2: one countdown component across modes). This keeps
 * only the timing: it counts down to the server's `endTimeMs` and fires
 * `onExpired` at zero. The last ten seconds invert the pill; red stays
 * reserved for the -3s penalty, which is a wrong answer.
 */
export function BlitzClock({ endTimeMs, onExpired, penaltyFlash, onTick }: BlitzClockProps) {
  const { t } = useTranslation("play");
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000)),
  );
  const lastTicked = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
      setRemaining(r);
      // The 100ms interval keeps the displayed second accurate, but the parent
      // only needs to hear about WHOLE-second changes — calling onTick on every
      // interval re-rendered the entire play screen at 10Hz for nothing.
      if (lastTicked.current !== r) {
        lastTicked.current = r;
        onTick?.(r);
      }
      if (r <= 0) {
        clearInterval(id);
        onExpired();
      }
    }, 100);
    return () => clearInterval(id);
  }, [endTimeMs, onExpired, onTick]);

  return (
    <div className="relative">
      <StageTimer
        seconds={remaining}
        fraction={remaining / BLITZ_WINDOW_SECONDS}
        label={t("ambient.seconds", { seconds: remaining })}
        urgentAt={10}
      />
      {penaltyFlash && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-md bg-verdict-wrong px-2 font-mono font-bold text-body-sm text-ink animate-flash-red"
        >
          -3s
        </span>
      )}
    </div>
  );
}
