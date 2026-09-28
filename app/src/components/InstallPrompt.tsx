/**
 * Install affordance — a small, dismissible bar rendered IN FLOW by
 * ShellLayout, directly above the mobile nav, on hub screens only.
 *
 * Chromium gets a real install button (replaying the stashed
 * `beforeinstallprompt`, captured app-wide in lib/installPrompt); iOS Safari
 * gets a one-line pointer at the Share sheet, which is the only route it
 * offers. Anything already installed, or dismissed once, renders nothing
 * forever — see lib/installPrompt.
 *
 * Why in flow and not an overlay: it used to be a `fixed bottom-0 z-50` bar
 * mounted globally in App, which on iPhone Safari sat on top of every play
 * screen's bottom-docked answer buttons ("Next", "Higher"/"Lower") and of the
 * shell's own bottom nav until the player found the X. As a row in the shell
 * column it takes its own height and covers nothing, and game screens (which
 * hide the nav) never show it. Mobile only: installing is a phone pitch, and
 * the desktop Home is height-budgeted.
 */
import { useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import {
  getDeferredInstallPrompt,
  hasDismissedInstall,
  isIosSafari,
  isStandalone,
  markInstallDismissed,
  subscribeInstallPrompt,
  takeDeferredInstallPrompt,
} from "@/lib/installPrompt";

export function InstallPrompt() {
  const deferred = useSyncExternalStore(subscribeInstallPrompt, getDeferredInstallPrompt);
  const [dismissed, setDismissed] = useState(() => isStandalone() || hasDismissedInstall());
  // No event ever arrives on iOS, so its hint is decided synchronously.
  const [ios] = useState(() => isIosSafari());

  if (dismissed) return null;
  const mode = deferred ? "android" : ios ? "ios" : null;
  if (!mode) return null;

  const dismiss = () => {
    markInstallDismissed();
    setDismissed(true);
  };

  const install = async () => {
    const event = takeDeferredInstallPrompt();
    // Whatever the user chooses, the affordance is done. Dismissing on
    // "accepted" is redundant with `appinstalled` but fires sooner and covers
    // browsers that skip it.
    dismiss();
    await event?.prompt();
  };

  return (
    <div
      className="vq-install-prompt md:hidden shrink-0 w-full px-3 pt-1 pb-2"
      role="region"
      aria-label="Install VerveQ"
      data-testid="install-prompt"
    >
      <div className="neo-border neo-shadow bg-card mx-auto flex max-w-md items-center gap-3 rounded-lg p-3">
        <span className="neo-border bg-accent shrink-0 rounded-full p-1.5">
          {mode === "android" ? (
            <Download size={18} strokeWidth={2.5} />
          ) : (
            <Share size={18} strokeWidth={2.5} />
          )}
        </span>

        <p className="font-body min-w-0 flex-1 text-sm leading-tight">
          {mode === "android" ? (
            <span className="font-heading font-bold">Install VerveQ</span>
          ) : (
            <>
              <span className="font-heading font-bold">Add VerveQ to your Home Screen</span>
              <span className="text-muted-foreground block">
                Share <Share size={12} className="inline align-[-1px]" strokeWidth={2.5} /> → Add to
                Home Screen
              </span>
            </>
          )}
        </p>

        {mode === "android" && (
          <button
            type="button"
            onClick={() => void install()}
            className="neo-border font-heading bg-accent text-accent-foreground shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold"
          >
            Install
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="text-muted-foreground shrink-0 p-1"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
