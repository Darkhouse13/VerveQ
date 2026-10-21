/**
 * ConfirmDialog — one yes/no question (VerveQ ONE P1.4): title, body, a
 * cancel and a confirm. `danger` paints the confirm destructive.
 *
 * The confirm handler owns what happens next, including closing (some
 * callers close first and then await, some keep it open while busy). Cancel,
 * Escape, the close target and a backdrop tap all call
 * `onOpenChange(false)`.
 *
 * `presentation="sheet"` asks from a bottom sheet instead of a centred card,
 * for surfaces whose other questions are sheets (THE WEEKEND's crew tools).
 */
import type { ReactNode } from "react";

import { NeoButton } from "@/components/neo/NeoButton";
import { cn } from "@/lib/utils";
import { OverlayContent, OverlayDescription, OverlayHeader, OverlayRoot } from "./overlay";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  onConfirm: () => void;
  /** Destructive confirm (sign out, quit, remove). */
  danger?: boolean;
  /** Disables the confirm (a request in flight). */
  busy?: boolean;
  /** Confirm above cancel, full width (long labels). Default: side by side. */
  stacked?: boolean;
  presentation?: "dialog" | "sheet";
  /** Extra content between the body and the buttons. */
  children?: ReactNode;
  className?: string;
  testId?: string;
  confirmTestId?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  danger = false,
  busy = false,
  stacked = false,
  presentation = "dialog",
  children,
  className,
  testId,
  confirmTestId,
}: ConfirmDialogProps) {
  const confirm = (
    <NeoButton
      variant={danger ? "danger" : "primary"}
      size="md"
      className="w-full"
      disabled={busy}
      onClick={onConfirm}
      data-testid={confirmTestId}
    >
      {confirmLabel}
    </NeoButton>
  );
  const cancel = (
    <NeoButton variant="secondary" size="md" className="w-full" onClick={() => onOpenChange(false)}>
      {cancelLabel}
    </NeoButton>
  );

  return (
    <OverlayRoot open={open} onOpenChange={onOpenChange}>
      <OverlayContent
        variant={presentation}
        data-testid={testId}
        className={cn(presentation === "dialog" && "max-w-sm", className)}
      >
        <div className="flex flex-col gap-2">
          <OverlayHeader title={title} titleClassName="whitespace-normal" />
          <OverlayDescription>{description}</OverlayDescription>
        </div>
        {children}
        {stacked ? (
          <div className="flex flex-col gap-2">
            {confirm}
            {cancel}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cancel}
            {confirm}
          </div>
        )}
      </OverlayContent>
    </OverlayRoot>
  );
}
