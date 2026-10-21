/**
 * FullscreenFlow — a full-screen step flow (VerveQ ONE P1.4): create a duel,
 * create or join an arena. Full screen on phones, a centred panel from md up.
 *
 * It used to be three hand-rolled full-screen divs (one at z-[100], which
 * still lost to the z-40 shell frame it was rendered inside, and none of them
 * trapped focus or answered Escape). Now it is a portalled Radix dialog on
 * the `overlay` layer: Escape and the leading X close it; when `onBack` is
 * given the leading control steps back instead. A tap on the md backdrop does
 * NOT close it — a half-built flow should not vanish on a stray click.
 *
 * Mounted conditionally by its callers, so `open` defaults to true.
 */
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  OverlayClose,
  OverlayContent,
  OverlayDescription,
  OverlayIconButton,
  OverlayRoot,
  OverlayTitle,
} from "./overlay";

export interface FullscreenFlowProps {
  open?: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Screen-reader description of the flow. */
  description?: ReactNode;
  /** Step back instead of closing from the leading control. */
  onBack?: () => void;
  backLabel?: string;
  closeLabel?: string;
  /** Pinned under the scrolling body (e.g. the primary CTA). */
  footer?: ReactNode;
  bodyClassName?: string;
  testId?: string;
  children: ReactNode;
}

export function FullscreenFlow({
  open = true,
  onClose,
  title,
  description,
  onBack,
  backLabel,
  closeLabel,
  footer,
  bodyClassName,
  testId,
  children,
}: FullscreenFlowProps) {
  return (
    <OverlayRoot open={open} onOpenChange={(next) => !next && onClose()}>
      <OverlayContent
        variant="fullscreen"
        data-testid={testId}
        onPointerDownOutside={(e) => e.preventDefault()}
        {...(description === undefined ? { "aria-describedby": undefined } : {})}
      >
        <div className="mx-auto flex w-full max-w-md shrink-0 items-center gap-3 px-5 pb-2 pt-4">
          {onBack ? (
            <OverlayIconButton
              onClick={onBack}
              aria-label={backLabel}
              icon={<ChevronLeft size={18} strokeWidth={3} aria-hidden />}
            />
          ) : (
            <OverlayClose label={closeLabel} />
          )}
          <OverlayTitle className="min-w-0 flex-1 truncate text-center text-body-sm uppercase">
            {title}
          </OverlayTitle>
          {/* Balances the leading control so the title stays centred. */}
          <span className="-m-1.5 h-11 w-11 shrink-0" aria-hidden />
        </div>
        {description !== undefined && (
          <OverlayDescription className="sr-only">{description}</OverlayDescription>
        )}
        <div
          className={cn(
            "mx-auto w-full max-w-md min-h-0 flex-1 overflow-y-auto overscroll-contain",
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer !== undefined && (
          <div className="mx-auto w-full max-w-md shrink-0 border-t-2 border-border bg-background px-5 py-3">
            {footer}
          </div>
        )}
      </OverlayContent>
    </OverlayRoot>
  );
}
