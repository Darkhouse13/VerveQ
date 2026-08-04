/**
 * Install affordance — a small, dismissible bar pinned above the safe area.
 *
 * Chromium gets a real install button (replaying the stashed
 * `beforeinstallprompt`); iOS Safari gets a one-line pointer at the Share
 * sheet, which is the only route it offers. Anything already installed, or
 * dismissed once, renders nothing forever — see lib/installPrompt.
 *
 * Purely additive: mounted alongside the other root-level overlays in App and
 * styled with its own classes plus the shared neo-* utilities. It changes no
 * existing chrome component.
 */
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import {
  hasDismissedInstall,
  isIosSafari,
  isStandalone,
  markInstallDismissed,
  type BeforeInstallPromptEvent,
} from "@/lib/installPrompt";

type Mode = "hidden" | "android" | "ios";

export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Both paths share these gates, so settle them once before wiring anything.
    if (isStandalone() || hasDismissedInstall()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      // Chromium shows its own mini-infobar unless the event is cancelled;
      // preventDefault is what hands the timing to this component.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setMode("android");
    };
    // Installing from anywhere (our button, or the browser's own menu) retires
    // the affordance permanently.
    const onInstalled = () => {
      markInstallDismissed();
      setMode("hidden");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // No event will ever arrive on iOS, so its hint is decided synchronously.
    if (isIosSafari()) setMode("ios");

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    markInstallDismissed();
    setMode("hidden");
  };

  const install = async () => {
    if (!deferred) return;
    // The stashed event is single-use: whatever the user chooses, the
    // affordance is done. Dismissing on "accepted" is redundant with
    // `appinstalled` but fires sooner and covers browsers that skip it.
    setMode("hidden");
    markInstallDismissed();
    await deferred.prompt();
    setDeferred(null);
  };

  return (
    <div
      className="vq-install-prompt fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      role="region"
      aria-label="Install VerveQ"
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
