/**
 * Add-to-home-screen affordance: which hint (if any) this browser should be
 * offered, and the "never nag" bookkeeping behind it.
 *
 * Two mutually exclusive paths, because only one of them has an API:
 *  - Chromium fires `beforeinstallprompt`, which we stash and replay from a
 *    button. The event is the *only* proof the browser will accept an install,
 *    so the Android affordance is never rendered speculatively.
 *  - iOS Safari has no prompt API at all — installing is a manual trip through
 *    the Share sheet — so all we can do is say so, once.
 *
 * Dismissal is permanent (localStorage, `verveq_` key convention as in
 * lib/duel.ts and lib/languagePref.ts). Storage failures fail CLOSED: a
 * browser that can't record the dismissal is treated as already-dismissed
 * rather than being asked on every single load.
 */

const INSTALL_DISMISSED_KEY = "verveq_install_dismissed";

/** iOS in-app webviews render a Share sheet with no "Add to Home Screen". */
const IN_APP_BROWSER_MARKERS = [
  "FBAN",
  "FBAV",
  "Instagram",
  "Line/",
  "TikTok",
  "Twitter",
  "Snapchat",
  "Pinterest",
];

/** Non-Safari iOS browsers are all WebKit, and none of them can install. */
const NON_SAFARI_IOS_MARKERS = ["CriOS", "FxiOS", "EdgiOS", "OPiOS", "mercury"];

/** Already installed — every hint is noise from here on. */
export function isStandalone(nav: Navigator = navigator, win: Window = window): boolean {
  // iOS reports through a non-standard navigator flag; everyone else through
  // the display-mode media query the manifest's `display` field selects.
  if ((nav as Navigator & { standalone?: boolean }).standalone === true) return true;
  try {
    return win.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

/**
 * iOS Safari specifically — the one iOS browser whose Share sheet carries
 * "Add to Home Screen". iPadOS 13+ masquerades as Macintosh, so touch points
 * are what separate an iPad from a desktop Mac.
 */
export function isIosSafari(nav: Navigator = navigator): boolean {
  const ua = nav.userAgent;
  const isIosDevice =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  if (!isIosDevice) return false;
  if (NON_SAFARI_IOS_MARKERS.some((marker) => ua.includes(marker))) return false;
  if (IN_APP_BROWSER_MARKERS.some((marker) => ua.includes(marker))) return false;
  return true;
}

export function hasDismissedInstall(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
  } catch {
    // Storage unavailable (private mode): treat as dismissed. Re-asking every
    // load is the one failure mode this feature must not have.
    return true;
  }
}

export function markInstallDismissed(): void {
  try {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
  } catch {
    // hasDismissedInstall() already fails closed, so there is nothing to do.
  }
}

/**
 * Chromium's install event. Not in lib.dom — declared here rather than
 * globally so the cast stays visible at the one place it is used.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
