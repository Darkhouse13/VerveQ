/**
 * F4 — coach marks. Three of them, first run only, taught at the moment the
 * interaction happens rather than in a paragraph on the entry screen that
 * nobody reads and nobody can act on while reading.
 *
 * Each fires the first time its surface appears — the draft row, the first
 * bench, the first bank/push — and never again after dismissal. The copy and
 * the dismissal state live in coachMarks.ts.
 */

import { useEffect } from "react";
import { NeoButton } from "@/components/neo/NeoButton";
import { COACH_COPY } from "./coachMarks";
import type { CoachId } from "./coachMarks";

interface CoachMarkProps {
  id: CoachId;
  seen: Set<CoachId>;
  onDismiss: (id: CoachId) => void;
  onSkipAll: () => void;
}

/**
 * Renders nothing once dismissed.
 *
 * PLACEMENT (learned from driving the real screens at 390×844, which jsdom
 * cannot show): the mark pins to the BOTTOM of its stage, in the slack the
 * views leave under the primary button — the draft stacks to 618px and the
 * round to 628px of the 812px budget, so ~190px sits empty there.
 *
 * Anchoring it to the control it describes was tried first and was wrong every
 * time: over the draft row it collided with the pick prompt and the row dots,
 * and above BANK/PUSH it covered the stake panel — hiding the projected band
 * and BUST KEEPS, i.e. exactly the numbers the tip is telling the player to
 * weigh. A tip that obscures the decision it explains is worse than no tip.
 * Down here it covers nothing, still shares the screen with its control (and
 * sits directly under it for the bench and bank/push marks), and the copy names
 * the control anyway.
 *
 * Absolute either way, so it costs the layout budget NOTHING — a coach mark
 * must not be able to push S2/S3 into a scroll.
 */
export function CoachMark({ id, seen, onDismiss, onSkipAll }: CoachMarkProps) {
  const show = !seen.has(id);

  // Escape dismisses, like any transient overlay.
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, id, onDismiss]);

  if (!show) return null;
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-30 flex justify-center pointer-events-none"
      data-testid={`draw-coach-${id}`}
      role="status"
    >
      <div className="draw-coach-card neo-border neo-shadow rounded-lg bg-foreground text-background p-2.5 mx-1 pointer-events-auto max-w-full draw-coach-in">
        <p className="text-[11px] leading-snug font-medium">{COACH_COPY[id]}</p>
        <div className="flex items-center gap-2 mt-2">
          <NeoButton
            variant="primary"
            className="h-7 px-3 text-[10px] flex-1"
            onClick={() => onDismiss(id)}
            data-testid={`draw-coach-${id}-got-it`}
          >
            GOT IT
          </NeoButton>
          <button
            type="button"
            className="font-heading font-bold text-[10px] underline opacity-70 px-1"
            onClick={onSkipAll}
            data-testid={`draw-coach-${id}-skip`}
          >
            SKIP ALL
          </button>
        </div>
      </div>
    </div>
  );
}
