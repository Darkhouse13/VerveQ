/**
 * The one overlay core (VerveQ ONE P1.4). Every dialog, sheet and full-screen
 * flow in the app is this file's `OverlayContent` in one of three shapes:
 *
 *  - `dialog`     centred card (ui/dialog, ui/confirm-dialog);
 *  - `sheet`      bottom sheet, optionally a centred panel from md up
 *                 (ui/sheet);
 *  - `fullscreen` a full-screen step flow on phones, a centred panel from md
 *                 up (ui/fullscreen-flow).
 *
 * What every shape shares, stated once:
 *  - Radix Dialog underneath: focus trap, Escape, scroll lock, focus return,
 *    labelled title/description. This is the ONLY file that imports Radix
 *    Dialog (the design ratchet counts the others down).
 *  - One backdrop: ink at 70%.
 *  - Named layers: sheets and dialogs on `z-sheet`, full-screen flows on
 *    `z-overlay` so a dialog opened from inside a flow lands above it.
 *  - Enter and exit on `duration-ui`; the global reduced-motion rule
 *    (index.css) collapses both to an instant fade.
 *  - The theme of the surface it was opened from (ui/theme-scope), so no
 *    portal hand-adds `theme-weekend` any more.
 *
 * The content sits INSIDE the overlay element (Radix's scrollable-overlay
 * pattern), so the backdrop is also the layout box that centres or
 * bottom-anchors it. No transforms are used for placement, which leaves
 * `transform` free for the enter/exit animation.
 */
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { ThemeScope, themeFromFocus, useThemeScope } from "./theme-scope";

/**
 * Radix Root, plus the theme hand-off: when no frame provided a ThemeScope,
 * the theme is read from where focus was at the moment the overlay opened
 * (the trigger, on desktop) and scoped to everything inside it.
 */
export function OverlayRoot({
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  const scoped = useThemeScope();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const open = openProp ?? uncontrolledOpen;
  // Capture on the closed -> open edge, during render (React's "state from
  // the previous render" pattern), so it happens before the focus trap
  // moves focus inside.
  const [wasOpen, setWasOpen] = React.useState(false);
  const [captured, setCaptured] = React.useState<string | null>(null);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setCaptured(scoped ? null : themeFromFocus());
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (openProp === undefined) setUncontrolledOpen(next);
        onOpenChange?.(next);
      }}
      {...props}
    >
      <ThemeScope theme={scoped ?? captured}>{children}</ThemeScope>
    </DialogPrimitive.Root>
  );
}

export const OverlayTrigger = DialogPrimitive.Trigger;

/** Radix Close, for wiring a custom control (e.g. a "Got it" button). */
export const OverlayDismiss = DialogPrimitive.Close;

export type OverlayVariant = "dialog" | "sheet" | "fullscreen";

const BACKDROP =
  "fixed inset-0 flex bg-ink/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-ui";

const MOTION =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-ui ease-out";

/** Placement on the backdrop, per shape. */
function backdropLayout(variant: OverlayVariant, mdCenter: boolean) {
  switch (variant) {
    case "dialog":
      return "z-sheet items-center justify-center overflow-y-auto p-4";
    case "sheet":
      return cn("z-sheet items-end justify-center", mdCenter && "md:items-center md:p-6");
    case "fullscreen":
      return "z-overlay items-stretch justify-center md:items-center md:p-6";
  }
}

/** The card itself, per shape. */
function contentLayout(variant: OverlayVariant, mdCenter: boolean) {
  switch (variant) {
    case "dialog":
      return cn(
        "grid w-full max-w-lg max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto p-5",
        "neo-border neo-shadow-lg rounded-lg",
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
      );
    case "sheet":
      return cn(
        "flex w-full max-w-sm max-h-[80dvh] flex-col gap-4 overflow-y-auto p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        "neo-border neo-shadow-lg rounded-t-lg border-b-0",
        "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
        mdCenter &&
          "md:max-w-md md:rounded-lg md:border-b-2 md:pb-5 md:data-[state=open]:slide-in-from-bottom-4 md:data-[state=closed]:slide-out-to-bottom-4",
      );
    case "fullscreen":
      return cn(
        "flex h-[100dvh] w-full flex-col overflow-hidden safe-pt safe-pb",
        "md:h-auto md:max-h-[88dvh] md:max-w-md md:neo-border md:neo-shadow-lg md:rounded-lg",
        "data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4",
      );
  }
}

export interface OverlayContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  variant?: OverlayVariant;
  /** Sheets only: a centred panel from md up instead of a bottom sheet. */
  mdCenter?: boolean;
  /** Extra classes on the backdrop (rarely needed). */
  overlayClassName?: string;
}

export const OverlayContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  OverlayContentProps
>(({ variant = "dialog", mdCenter = false, overlayClassName, className, children, ...props }, ref) => {
  const theme = useThemeScope();

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={cn(BACKDROP, backdropLayout(variant, mdCenter), overlayClassName)}>
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            theme,
            "relative bg-background text-foreground outline-none",
            contentLayout(variant, mdCenter),
            MOTION,
            className,
          )}
          {...props}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  );
});
OverlayContent.displayName = "OverlayContent";

export const OverlayTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-heading font-bold text-title-sm", className)}
    {...props}
  />
));
OverlayTitle.displayName = "OverlayTitle";

export const OverlayDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-body-sm text-muted-foreground", className)}
    {...props}
  />
));
OverlayDescription.displayName = "OverlayDescription";

/**
 * The 44px close/back target: a 32px neo square inside a 44px hit area, with
 * a negative margin so it lays out like the 32px square. Local on purpose —
 * swap for the shared CloseButton when it lands.
 */
export const OverlayIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }
>(({ className, icon, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      "group -m-1.5 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg",
      className,
    )}
    {...props}
  >
    <span className="grid h-8 w-8 place-items-center rounded-md neo-border bg-card text-card-foreground group-active:neo-shadow-pressed">
      {icon ?? <X size={16} strokeWidth={3} aria-hidden />}
    </span>
  </button>
));
OverlayIconButton.displayName = "OverlayIconButton";

/** `OverlayIconButton` that closes the enclosing overlay. */
export const OverlayClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string; icon?: React.ReactNode }
>(({ label, ...props }, ref) => {
  const { t } = useTranslation("shell");
  return (
    <DialogPrimitive.Close asChild>
      <OverlayIconButton
        ref={ref}
        aria-label={label ?? t("common.close", { defaultValue: "Close" })}
        {...props}
      />
    </DialogPrimitive.Close>
  );
});
OverlayClose.displayName = "OverlayClose";

/**
 * The house header: optional mono eyebrow, the title, an optional badge, and
 * the close target.
 */
export function OverlayHeader({
  title,
  eyebrow,
  badge,
  hideClose = false,
  closeLabel,
  closeTestId,
  titleClassName,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  badge?: React.ReactNode;
  hideClose?: boolean;
  closeLabel?: string;
  closeTestId?: string;
  titleClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow !== undefined && eyebrow !== null && eyebrow !== "" && (
          <p className="truncate font-mono text-eyebrow font-bold uppercase text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <OverlayTitle className={cn("truncate", titleClassName)}>{title}</OverlayTitle>
      </div>
      {(badge || !hideClose) && (
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {!hideClose && <OverlayClose label={closeLabel} data-testid={closeTestId} />}
        </div>
      )}
    </div>
  );
}
