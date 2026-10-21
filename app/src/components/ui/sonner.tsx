import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * The one Toaster (VerveQ ONE, P1.5). Toasts mount outside every theme scope,
 * so they used to render cream with a soft shadow even on the ink game
 * screens. They are now ink with cream text everywhere — the brand ground —
 * in the brand font, in one place: top-center, just under the screen header.
 * At the bottom they covered the game controls (Missing Letters' keyboard,
 * Check and Give up) and on hubs the nav; under the header they cover
 * neither QUIT nor the main action. Call sites use `notify` (lib/notify.ts)
 * and never pass position or styling.
 */
const brandToast = {
  "--normal-bg": "hsl(var(--ink))",
  "--normal-text": "hsl(var(--cream))",
  "--normal-border": "hsl(var(--ink))",
  "--border-radius": "8px",
} as CSSProperties;

/** Clears the 56–64px screen header (and the notch) on every frame. */
const UNDER_HEADER = "calc(68px + env(safe-area-inset-top))";

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    position="top-center"
    offset={{ top: UNDER_HEADER }}
    mobileOffset={{ top: UNDER_HEADER, left: 16, right: 16 }}
    className="toaster group"
    style={brandToast}
    toastOptions={{
      classNames: {
        toast: "group toast font-body text-body-sm neo-shadow",
        description: "group-[.toast]:text-muted-foreground",
        actionButton: "group-[.toast]:bg-action group-[.toast]:text-action-foreground",
        cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
      },
    }}
    {...props}
  />
);

export { Toaster };
