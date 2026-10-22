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
 * It waits for a return visit on a later day after a finished game, shows for
 * one session, and only on Home (lib/installPrompt `isInstallBarDue`), so a
 * first-timer never meets it and it never trails across every tab.
 *
 * Why in flow and not an overlay: it used to be a `fixed bottom-0 z-50` bar
 * mounted globally in App, which on iPhone Safari sat on top of every play
 * screen's bottom-docked answer buttons ("Next", "Higher"/"Lower") and of the
 * shell's own bottom nav until the player found the X. As a row in the shell
 * column it takes its own height and covers nothing, and game screens (which
 * hide the nav) never show it. Mobile only: installing is a phone pitch, and
 * the desktop Home is height-budgeted.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/icon-button";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import {
  getDeferredInstallPrompt,
  hasDismissedInstall,
  isInstallBarDue,
  isIosSafari,
  isStandalone,
  markInstallDismissed,
  markInstallShown,
  subscribeInstallPrompt,
  takeDeferredInstallPrompt,
} from "@/lib/installPrompt";

export function InstallPrompt() {
  const { t } = useTranslation("shell");
  const deferred = useSyncExternalStore(subscribeInstallPrompt, getDeferredInstallPrompt);
  const [dismissed, setDismissed] = useState(() => isStandalone() || hasDismissedInstall());
  // No event ever arrives on iOS, so its hint is decided synchronously.
  const [ios] = useState(() => isIosSafari());
  const { pathname } = useLocation();
  const [due] = useState(() => isInstallBarDue());
  const mode = deferred ? "android" : ios ? "ios" : null;
  const visible = !dismissed && due && mode !== null && pathname === SHELL_ROUTES.home;

  // Shown once = this session is its one chance.
  useEffect(() => {
    if (visible) markInstallShown();
  }, [visible]);

  if (!visible) return null;

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
      aria-label={t("app.install.title")}
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

        <p className="font-body min-w-0 flex-1 text-body-sm leading-tight">
          {mode === "android" ? (
            <span className="font-heading font-bold">{t("app.install.title")}</span>
          ) : (
            <>
              <span className="font-heading font-bold">{t("app.install.iosTitle")}</span>
              <span className="text-muted-foreground block">
                {t("app.install.iosShare")}{" "}
                <Share size={12} className="inline align-[-1px]" strokeWidth={2.5} />{" "}
                {t("app.install.iosAdd")}
              </span>
            </>
          )}
        </p>

        {mode === "android" && (
          <Button size="sm" onClick={() => void install()} className="shrink-0 px-3">
            {t("app.install.cta")}
          </Button>
        )}

        <CloseButton
          onClick={dismiss}
          aria-label={t("app.install.dismiss")}
          className="text-muted-foreground"
        />
      </div>
    </div>
  );
}
