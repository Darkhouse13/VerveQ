/**
 * Dialog — the centred overlay (VerveQ ONE P1.4). Same API as the shadcn
 * component it replaces, so existing call sites keep their markup; the chrome
 * (backdrop, layer, motion, 44px close, carried theme) comes from ui/overlay.
 *
 * For a yes/no question use ui/confirm-dialog; for a bottom sheet, ui/sheet.
 */
import * as React from "react";

import { cn } from "@/lib/utils";
import {
  OverlayClose,
  OverlayContent,
  OverlayDescription,
  OverlayDismiss,
  OverlayRoot,
  OverlayTitle,
  OverlayTrigger,
} from "./overlay";

const Dialog = OverlayRoot;
const DialogTrigger = OverlayTrigger;
const DialogClose = OverlayDismiss;

type DialogContentProps = Omit<
  React.ComponentPropsWithoutRef<typeof OverlayContent>,
  "variant" | "mdCenter"
> & {
  /** Drop the corner close target (the dialog must offer its own way out). */
  hideClose?: boolean;
  closeLabel?: string;
};

const DialogContent = React.forwardRef<React.ElementRef<typeof OverlayContent>, DialogContentProps>(
  ({ children, hideClose = false, closeLabel, ...props }, ref) => (
    <OverlayContent ref={ref} variant="dialog" {...props}>
      {children}
      {!hideClose && <OverlayClose label={closeLabel} className="absolute right-2.5 top-2.5 m-0" />}
    </OverlayContent>
  ),
);
DialogContent.displayName = "DialogContent";

/** Title + description stack; leaves room for the corner close target. */
const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 pr-10", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = OverlayTitle;
const DialogDescription = OverlayDescription;

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
};
