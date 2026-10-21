import { toast } from "sonner";

/**
 * The app's one way to show a toast (VerveQ ONE, P1.5). Toasts take their look
 * and position from the single themed Toaster (components/ui/sonner.tsx):
 * ink, top-center under the screen header, in the brand font. Don't pass `position`
 * or styling per call — one place decides where messages appear.
 *
 * Same API as sonner's `toast` (notify.error, notify.success, …), so tests
 * that mock "sonner" keep seeing every call.
 */
export const notify = toast;

const TAB_WARNING_KEY = "vq.tabSwitchWarned";

/**
 * The anti-cheat reminder (owner decision 9): once per browser session, on
 * the player's first tap or key inside a live game — not as the game opens,
 * where it covered the first question and the controls.
 */
export function warnTabSwitchOnce(message: string): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    if (sessionStorage.getItem(TAB_WARNING_KEY)) return () => {};
  } catch {
    // Storage blocked: fall through and warn once for this game.
  }
  const show = () => {
    cleanup();
    try {
      sessionStorage.setItem(TAB_WARNING_KEY, "1");
    } catch {
      // ignore
    }
    notify.warning(message, { duration: 4000 });
  };
  const cleanup = () => {
    window.removeEventListener("pointerup", show, true);
    window.removeEventListener("keyup", show, true);
  };
  window.addEventListener("pointerup", show, true);
  window.addEventListener("keyup", show, true);
  return cleanup;
}
