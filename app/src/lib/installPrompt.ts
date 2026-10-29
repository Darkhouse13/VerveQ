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
 *
 * When (onboarding walkthrough 2026-10-22): never on a first visit. The bar
 * waits for a RETURN visit on a later calendar day, after the player has
 * finished at least one game, and gets ONE session: shown and ignored counts
 * as asked. Home only (InstallPrompt checks the route).
 */

const INSTALL_DISMISSED_KEY = "verveq_install_dismissed";
/** Local calendar day (YYYY-MM-DD) of this browser's first visit. */
const FIRST_VISIT_DAY_KEY = "verveq_first_visit_day";
/** Set once any game reaches its result screen. */
const FINISHED_GAME_KEY = "verveq_finished_game";
/** The bar has had its one session (localStorage), and it is this one (sessionStorage). */
const INSTALL_SHOWN_KEY = "verveq_install_shown";

function localDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Remember the first visit's day (boot). Never overwrites. */
export function recordFirstVisitDay(now: Date = new Date()): void {
  try {
    if (!localStorage.getItem(FIRST_VISIT_DAY_KEY)) {
      localStorage.setItem(FIRST_VISIT_DAY_KEY, localDay(now));
    }
  } catch {
    // No storage: the bar stays off (eligibility fails closed).
  }
}

/** A game reached its result screen (ResultScreen). */
export function markGameFinished(): void {
  try {
    localStorage.setItem(FINISHED_GAME_KEY, "1");
  } catch {
    // Fails closed like the rest.
  }
}

/**
 * Whether the install bar may show now: a return visit on a later day, after a
 * finished game, and either never shown before or shown earlier in THIS
 * session (so it stays put while the session lasts, then never again).
 */
export function isInstallBarDue(now: Date = new Date()): boolean {
  try {
    const firstDay = localStorage.getItem(FIRST_VISIT_DAY_KEY);
    if (!firstDay || firstDay === localDay(now)) return false;
    if (localStorage.getItem(FINISHED_GAME_KEY) !== "1") return false;
    if (localStorage.getItem(INSTALL_SHOWN_KEY) !== "1") return true;
    return sessionStorage.getItem(INSTALL_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

/** The bar was shown: this session is its one chance. */
export function markInstallShown(): void {
  try {
    localStorage.setItem(INSTALL_SHOWN_KEY, "1");
    sessionStorage.setItem(INSTALL_SHOWN_KEY, "1");
  } catch {
    // Fails closed: isInstallBarDue reads false without storage.
  }
}

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

/** Android Chrome itself (not an in-app webview, not another Android browser). */
export function isAndroidChrome(nav: Navigator = navigator): boolean {
  const ua = nav.userAgent;
  if (!/Android/.test(ua) || !/Chrome\//.test(ua)) return false;
  if (/; wv\)|SamsungBrowser|EdgA|OPR\/|Firefox/.test(ua)) return false;
  return !IN_APP_BROWSER_MARKERS.some((marker) => ua.includes(marker));
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

/*
 * App-wide capture of Chromium's install event. It fires ONCE per page load,
 * often before (or while) a screen that doesn't show the bar is mounted — a
 * game, a sheet — so the banner can't own the listener: it only renders on
 * hub screens (ShellLayout) and would miss the event entirely. main.tsx arms
 * this before first render; the banner subscribes.
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();
let captureArmed = false;

function notifyPromptListeners(): void {
  for (const listener of promptListeners) listener();
}

export function armInstallPromptCapture(win: Window = window): void {
  if (captureArmed) return;
  captureArmed = true;
  win.addEventListener("beforeinstallprompt", (event) => {
    // Chromium shows its own mini-infobar unless the event is cancelled;
    // preventDefault is what hands the timing to the banner.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyPromptListeners();
  });
  // Installing from anywhere (our button, or the browser's own menu) retires
  // the affordance permanently.
  win.addEventListener("appinstalled", () => {
    markInstallDismissed();
    deferredPrompt = null;
    notifyPromptListeners();
  });
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

/** The stashed event is single-use: hand it out once and forget it. */
export function takeDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  const event = deferredPrompt;
  deferredPrompt = null;
  notifyPromptListeners();
  return event;
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  promptListeners.add(listener);
  return () => {
    promptListeners.delete(listener);
  };
}
