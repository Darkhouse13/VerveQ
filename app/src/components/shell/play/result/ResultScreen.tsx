/**
 * ResultScreen — the one end-of-game layout (VerveQ ONE P2.2), built on the
 * two dailies first and reused by every mode in Phase 3.
 *
 * Fixed order, top to bottom:
 *   top      — anything that frames the result (a challenge's head-to-head)
 *   hero     — ResultHero: score on the mode accent, verdict squares
 *   status   — the streak line (or the next-edition countdown)
 *   actions  — ResultActions: ONE lime primary, "Next today", secondaries
 *   details  — supporting content (challenge results, the answers list)
 *   footer   — one quiet line (reminder, follow) at the very bottom
 *
 * Slots are optional except hero and actions; the order is not negotiable,
 * so screens stay alike and the primary action stays above the fold.
 *
 * Desktop (md+, VerveQ ONE P5.2): the same order in two columns — the result
 * (top, hero, status) on the left, what to do next (actions, details, footer)
 * on the right — and StageFrame widens its column for it (it looks for
 * `data-result-screen`), so a finished game is not a phone strip on an empty
 * canvas.
 */
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export interface ResultScreenProps {
  top?: ReactNode;
  hero: ReactNode;
  status?: ReactNode;
  actions: ReactNode;
  details?: ReactNode;
  footer?: ReactNode;
  testId?: string;
}

export function ResultScreen({ top, hero, status, actions, details, footer, testId }: ResultScreenProps) {
  return (
    <div
      className="flex flex-col gap-3 py-2 md:grid md:grid-cols-2 md:items-start md:gap-x-6"
      data-testid={testId}
      data-result-screen=""
    >
      <div className="flex flex-col gap-3 md:sticky md:top-0">
        {top}
        {hero}
        {status}
      </div>
      <div className="flex flex-col gap-3">
        {actions}
        {details && <div className="mt-2 flex flex-col gap-3">{details}</div>}
        {footer && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 border-t-2 border-border/20 pt-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A collapsed details block ("Your answers"): native <details>, so it is
 * keyboard-operable with no state, and its 44px summary row is the target.
 */
export function ResultDetails({ summary, children, testId }: { summary: string; children: ReactNode; testId?: string }) {
  return (
    <details className="group rounded-lg bg-card neo-border" data-testid={testId}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 font-heading font-bold text-body-sm [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown size={18} className="shrink-0 transition-transform duration-ui group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}
