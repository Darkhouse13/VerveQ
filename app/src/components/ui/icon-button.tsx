import { forwardRef, useState } from "react";
import { cva } from "class-variance-authority";
import { ArrowLeft, LogOut, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

/**
 * The shell namespace (`SHELL_NS` in @/i18n), named here rather than imported:
 * importing @/i18n initializes i18next as a side effect, and a primitive the
 * whole shell renders must not pull that into every screen's module graph.
 */
const SHELL_NS = "shell";

/**
 * IconButton — a square, icon-only control with a ≥44px hit area.
 * `aria-label` is required: an icon alone names nothing for a screen reader.
 */
const iconButtonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center rounded-lg transition duration-press disabled:cursor-not-allowed disabled:text-muted-foreground",
  {
    variants: {
      variant: {
        ghost: "border-2 border-transparent bg-transparent text-foreground enabled:hover:bg-muted",
        secondary:
          "neo-border neo-shadow bg-card text-card-foreground enabled:hover:bg-muted enabled:active:translate-x-0.5 enabled:active:translate-y-0.5 enabled:active:neo-shadow-sm disabled:shadow-none",
        primary:
          "neo-border neo-shadow bg-primary text-primary-foreground enabled:active:translate-x-0.5 enabled:active:translate-y-0.5 enabled:active:neo-shadow-sm disabled:bg-muted disabled:shadow-none",
      },
      size: {
        sm: "h-11 w-11 [&_svg]:h-[18px] [&_svg]:w-[18px]",
        md: "h-12 w-12 [&_svg]:h-[22px] [&_svg]:w-[22px]",
      },
    },
    defaultVariants: { variant: "ghost", size: "sm" },
  },
);

type IconButtonVariant = "ghost" | "secondary" | "primary";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  variant?: IconButtonVariant;
  size?: "sm" | "md";
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(iconButtonVariants({ variant, size }), className)} {...props} />
  ),
);
IconButton.displayName = "IconButton";

type WrapperProps = Omit<IconButtonProps, "aria-label" | "children"> & { "aria-label"?: string };

/** ← Back. Label defaults to the shell's translated "Back". */
const BackButton = forwardRef<HTMLButtonElement, WrapperProps>(({ "aria-label": label, ...props }, ref) => {
  const { t } = useTranslation(SHELL_NS);
  return (
    <IconButton ref={ref} aria-label={label ?? t("common.back", { defaultValue: "Back" })} {...props}>
      <ArrowLeft aria-hidden="true" />
    </IconButton>
  );
});
BackButton.displayName = "BackButton";

/** ✕ Close. Label defaults to the shell's translated "Close". */
const CloseButton = forwardRef<HTMLButtonElement, WrapperProps>(({ "aria-label": label, ...props }, ref) => {
  const { t } = useTranslation(SHELL_NS);
  return (
    <IconButton ref={ref} aria-label={label ?? t("common.close", { defaultValue: "Close" })} {...props}>
      <X aria-hidden="true" />
    </IconButton>
  );
});
CloseButton.displayName = "CloseButton";

export interface ExitConfirm {
  title: string;
  description?: string;
  /** Defaults to the button's own label. */
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ExitButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children"> {
  onExit: () => void;
  /** Visible label. Defaults to "Exit". */
  label?: string;
  /** Icon before the label. Defaults to a leave arrow. */
  icon?: React.ReactNode;
  /** When set, a confirm dialog opens first and `onExit` runs only on confirm. */
  confirm?: ExitConfirm;
}

/** Leave a game or flow: icon + label, 44px tall, optional confirm step. */
function ExitButton({ onExit, label, icon, confirm, className, ...props }: ExitButtonProps) {
  const { t } = useTranslation(SHELL_NS);
  const [open, setOpen] = useState(false);
  const text = label ?? t("common.exit", { defaultValue: "Exit" });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn("px-3", className)}
        onClick={() => (confirm ? setOpen(true) : onExit())}
        {...props}
      >
        {icon ?? <LogOut aria-hidden="true" className="h-[18px] w-[18px]" />}
        {text}
      </Button>
      {confirm && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              {confirm.description && <DialogDescription>{confirm.description}</DialogDescription>}
            </DialogHeader>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {confirm.cancelLabel ?? t("common.cancel", { defaultValue: "Cancel" })}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setOpen(false);
                  onExit();
                }}
              >
                {confirm.confirmLabel ?? text}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export { IconButton, BackButton, CloseButton, ExitButton };
