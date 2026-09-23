/**
 * Anonymous curiosity funnel for the static SEO pages (docs/ANALYTICS.md,
 * "Anonymous curiosity funnel"). Formerly public/games/funnel.js, a separate
 * posthog-js load; now that the app bundle runs on these pages the same events
 * go through lib/analytics (same token, same localStorage identity), so the
 * event names and properties are unchanged and the series continues.
 *
 * One addition: `page_type` (game / quiz_archive / grid_answers / …), because
 * the layer now has data pages as well as the six game pages.
 */
import { track, trackOnExit } from "@/lib/analytics";
import { seoModeFor, seoPageType } from "@/lib/seoPages";

type Step = "landing" | "cta_shown" | "interacted" | "start_intent";
const STEPS: Step[] = ["landing", "cta_shown", "interacted", "start_intent"];

let started = false;

export function startSeoFunnel(pathname: string, isAuthenticated: boolean): void {
  if (started) return;
  started = true;

  const mode = seoModeFor(pathname);
  const pageType = seoPageType(pathname);
  const landedAtMs = Date.now();
  let furthest: Step = "landing";
  let intentFired = false;
  let exitFired = false;
  const seenInteractions = new Set<string>();
  const secondsHere = () => Math.round((Date.now() - landedAtMs) / 1000);
  const advance = (step: Step) => {
    if (STEPS.indexOf(step) > STEPS.indexOf(furthest)) furthest = step;
  };

  let referrerDomain: string | null = null;
  try {
    referrerDomain = document.referrer ? new URL(document.referrer).hostname : null;
  } catch {
    referrerDomain = null;
  }

  track("landing_viewed", {
    entry_source: "seo",
    mode,
    page_type: pageType,
    is_authenticated: isAuthenticated,
    referrer_domain: referrerDomain,
  });

  const cta = document.querySelector<HTMLAnchorElement>("#seo a.seo-cta");

  // landing_cta_shown: genuinely visible (≥50% in view, tab foregrounded).
  if (cta && typeof IntersectionObserver !== "undefined") {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || document.visibilityState !== "visible") continue;
          io.disconnect();
          advance("cta_shown");
          track("landing_cta_shown", { mode, page_type: pageType });
          return;
        }
      },
      { threshold: 0.5 },
    );
    io.observe(cta);
  }

  const interacted = (type: string) => {
    if (seenInteractions.has(type)) return;
    seenInteractions.add(type);
    advance("interacted");
    track("landing_interacted", { interaction_type: type, mode, page_type: pageType });
  };
  window.addEventListener(
    "scroll",
    () => {
      if (window.scrollY > window.innerHeight * 0.5) interacted("scroll_past_fold");
    },
    { passive: true },
  );
  document.addEventListener(
    "click",
    (ev) => {
      const target = ev.target as Element | null;
      if (target?.closest?.("#seo a.seo-cta")) return;
      if (target?.closest?.("#seo")) interacted("tap");
    },
    { passive: true },
  );

  // game_start_intent: any launch button on the page.
  document.addEventListener("click", (ev) => {
    const target = ev.target as Element | null;
    const link = target?.closest?.("#seo a.seo-cta");
    if (!link || intentFired) return;
    intentFired = true;
    advance("start_intent");
    track("game_start_intent", {
      mode,
      page_type: pageType,
      target: link.getAttribute("href"),
      time_on_page_seconds: secondsHere(),
    });
  });

  // exit_before_play: suppressed once the CTA was pressed (a hand-off, not a bounce).
  const exit = (signal: string) => {
    if (exitFired || intentFired) return;
    exitFired = true;
    trackOnExit("exit_before_play", {
      mode,
      page_type: pageType,
      furthest_step: furthest,
      time_on_page_seconds: secondsHere(),
      exit_signal: signal,
    });
  };
  window.addEventListener("pagehide", () => exit("pagehide"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") exit("visibility_hidden");
  });
}
