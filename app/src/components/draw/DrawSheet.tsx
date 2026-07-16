/**
 * Bottom sheet for THE DRAW (Ticket F) — the surface F1b's fixture detail and
 * F7's card detail both open into.
 *
 * Built on the Radix Dialog primitives rather than components/ui/dialog: that
 * one is centre-anchored and its own styling, while this is bottom-anchored,
 * neo-styled and mode-local. The primitives are still what carry the focus
 * trap, the Escape handler, the scroll lock and the aria wiring — none of which
 * is worth re-implementing for a mode.
 *
 * The sheet exists so the effect copy has somewhere to live that ISN'T the
 * screen: S2/S3 are on a fixed 812px budget (LAYOUT_SPEC) and a paragraph per
 * fixture would blow it. Tapping for detail keeps the always-on surface to the
 * compact ▲/▼ line.
 */

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "lucide-react";
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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          // Centred on the same 390px column the mode renders in, so the sheet
          // reads as part of the screen rather than the browser window.
          className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full neo-border neo-shadow-lg rounded-t-xl bg-background text-foreground p-4 pb-6 flex flex-col gap-3 draw-sheet-in"
          style={{ maxWidth: LAYOUT.viewportW }}
          data-testid={testId}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <p className="font-heading font-bold text-[10px] tracking-wide text-muted-foreground">
                  {eyebrow}
                </p>
              )}
              <DialogPrimitive.Title className="font-heading font-black text-2xl leading-none mt-0.5">
                {title}
              </DialogPrimitive.Title>
            </div>
            {badge}
            <DialogPrimitive.Close
              className="neo-border rounded bg-card p-1 shrink-0 active:neo-shadow-pressed"
              aria-label="Close"
              data-testid={`${testId}-close`}
            >
              <X size={14} strokeWidth={3} />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
