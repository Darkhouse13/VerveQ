/**
 * Bottom sheet for THE DRAW (Ticket F) — the surface F1b's fixture detail and
 * F7's card detail both open into. A thin wrapper over ui/sheet: the chrome
 * (backdrop, focus trap, Escape, 44px close, motion) is the house sheet; what
 * stays here is THE DRAW's own column width and its translation guard.
 *
 * The sheet exists so the effect copy has somewhere to live that ISN'T the
 * screen: S2/S3 are on a fixed 812px budget (LAYOUT_SPEC) and a paragraph per
 * fixture would blow it. Tapping for detail keeps the always-on surface to the
 * compact ▲/▼ line.
 */

import type { ReactNode } from "react";
import { Sheet } from "@/components/ui/sheet";
import { LAYOUT } from "./layout";

interface DrawSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Small line above the title, e.g. "FIXTURE 3/5". */
  eyebrow?: string;
  /** Rendered to the right of the title, e.g. the BOSS badge. */
  badge?: ReactNode;
  children: ReactNode;
  testId?: string;
}

export function DrawSheet({
  open,
  onOpenChange,
  title,
  eyebrow,
  badge,
  children,
  testId = "draw-sheet",
}: DrawSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      eyebrow={eyebrow}
      badge={badge}
      testId={testId}
      closeLabel="Close"
      closeTestId={`${testId}-close`}
      titleClassName="text-title leading-none"
      // Centred on the same 390px column the mode renders in, so the sheet
      // reads as part of the screen rather than the browser window. The
      // portal is mounted under document.body, outside DrawExperience's
      // protected root, so it needs its own translation boundary.
      className="notranslate max-w-none gap-3 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      translate="no"
      style={{ maxWidth: LAYOUT.viewportW }}
    >
      {children}
    </Sheet>
  );
}
