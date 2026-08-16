/**
 * The weekend's bottom sheet, stated once (FW-SCOUT).
 *
 * The FormationChooser / picker-filter / crew-delete sheets each hand-roll
 * this markup on the raw Radix primitives (centre-anchored ui/dialog cannot
 * be bottom-anchored; Radix still carries the focus trap, Escape, scroll
 * lock and aria wiring). This is that markup as a component; existing sheets
 * migrate opportunistically, new sheets start here.
 *
 * `theme-weekend` rides on the PORTALLED content deliberately: Radix portals
 * to document.body, outside the themed shell, and without the class the
 * sheet renders in the light palette. `weekend-sheet-in` carries the
 * slide-up and is reduced-motion safe via the global media block
 * (index.css §reduced motion).
 */
import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function WeekendSheet({
  open,
  onOpenChange,
  title,
  eyebrow,
  badge,
  testId,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Mono uppercase line above the title (house eyebrow). */
  eyebrow?: ReactNode;
  /** Right-aligned chip next to the close button (e.g. a price). */
  badge?: ReactNode;
  testId?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("shell");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          data-testid={testId}
          className="theme-weekend weekend-sheet-in fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm neo-border neo-shadow-lg rounded-t-xl border-b-0 bg-background text-foreground p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4 max-h-[80dvh] overflow-y-auto"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {eyebrow !== undefined && (
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground truncate">
                  {eyebrow}
                </p>
              )}
              <DialogPrimitive.Title className="font-heading font-bold text-lg truncate">
                {title}
              </DialogPrimitive.Title>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {badge}
              <DialogPrimitive.Close
                className="neo-border rounded bg-card p-1 shrink-0 active:neo-shadow-pressed"
                aria-label={t("common.close", { defaultValue: "Close" })}
              >
                <X size={14} strokeWidth={3} />
              </DialogPrimitive.Close>
            </div>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
