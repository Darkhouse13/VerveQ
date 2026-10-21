/**
 * Run `fn` once the page has painted and gone idle, or on the visitor's first
 * tap or key — whichever comes first. Third-party SDKs (Sentry, PostHog, GA4)
 * load through this so they stay off the critical path of the entry routes:
 * on a mid-range phone they cost about 1.5s before the first game frame.
 */
export function afterFirstPaint(fn: () => void, maxWaitMs = 3000): void {
  if (typeof window === "undefined") return;
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.removeEventListener("pointerdown", run, true);
    window.removeEventListener("keydown", run, true);
    fn();
  };
  window.addEventListener("pointerdown", run, { capture: true, once: true });
  window.addEventListener("keydown", run, { capture: true, once: true });

  const idle = () => {
    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) ric(run, { timeout: maxWaitMs });
    else window.setTimeout(run, 1500);
  };
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}
