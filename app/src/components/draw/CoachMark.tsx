/**
 * F4 — coach marks. Three of them, first run only, taught at the moment the
 * interaction happens rather than in a paragraph on the entry screen that
 * nobody reads and nobody can act on while reading.
 *
 * Each fires the first time its surface appears — the draft row, the first
 * bench, the first bank/push — and never again after dismissal. The copy (the
 * `draw` locale's `coach.*`) and the dismissal state live in coachMarks.ts.
 */

import { useEffect } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDrawT } from "./drawI18n";
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
 * PLACEMENT (VerveQ ONE P4.2): the mark sits IN FLOW at the bottom of its
 * stage, under the primary button — it never overlays the board. It used to
 * be absolutely positioned in the stage's bottom slack, which held at 390×844
 * until the resolved round's ledger filled that slack: the first-run intro
 * mark then sat on top of BANK/PUSH and the stake panel, i.e. on exactly the
 * numbers it tells the player to weigh. In flow it covers nothing; on a short
 * phone it is reached by scrolling the stage like any other row, and since it
 * is the LAST row, dismissing it never moves anything above it.
 */
export function CoachMark({ id, seen, onDismiss, onSkipAll }: CoachMarkProps) {
  const t = useDrawT();
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
      className="draw-outline-lime neo-border rounded-lg bg-card text-card-foreground p-2.5 shrink-0 draw-coach-in"
      data-testid={`draw-coach-${id}`}
      role="status"
    >
      <p className="flex items-start gap-2 text-meta font-medium">
        <Lightbulb size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <span>{t(`coach.${id}`)}</span>
      </p>
      <div className="flex items-center gap-2 mt-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={() => onDismiss(id)}
          data-testid={`draw-coach-${id}-got-it`}
        >
          {t("coach.gotIt")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkipAll} data-testid={`draw-coach-${id}-skip`}>
          {t("coach.skipAll")}
        </Button>
      </div>
    </div>
  );
}
