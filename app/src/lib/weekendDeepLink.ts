/**
 * `/weekend` — the short link for off-platform WEEKEND CTAs (reel captions, the
 * Instagram/TikTok bio link for the B2.5 batch). One typed-friendly URL that
 * lands on Home with THE WEEKEND card at the TOP of the viewport, so a visitor
 * promised a fantasy mode sees the lime CTA on the first screen instead of
 * THE DRAW's board.
 *
 * Why a redirect into `/v2` rather than a screen of its own: the teaser is a
 * Home card with a server-read gate and a live waitlist count (see
 * `components/weekend/HomeWeekendTeaser`). Re-hosting it elsewhere would fork
 * that gate. This route only changes WHERE ON HOME the visitor arrives.
 *
 * It also bypasses the cold-entry landing deliberately. A signed-out visitor on
 * a bare `/` gets `ColdEntryScreen` (EntryRoutes.EntryRoute) — the taste round,
 * which carries no WEEKEND card at all. Reel traffic sent to `/` therefore
 * could never reach the waitlist without first playing a round and tapping
 * through to Home. `/v2` is behind `ShellGate` (the build flag) ONLY, with no
 * session guard, so an anonymous visitor lands on Home and gets the teaser's
 * email path — no account, no round, no taps.
 *
 * Attribution rides along exactly as `/play` does (lib/playShortLink): incoming
 * params are preserved so a bio link can append `?utm_source=ig`, and a bare
 * /weekend gets `ref=weekend` so short-link traffic is never bucketed as
 * "direct". The teaser reads `utm_source ?? ref` for its own `source` property
 * (lib/coldSession.readColdSource), so this value lands on every waitlist
 * event the visit produces.
 */
import { SHELL_ROUTES } from "@/lib/shellRoutes";

export const WEEKEND_SHORT_LINK_DEFAULT_REF = "weekend";

/** Query param that pins the teaser to the top of Home. Also usable directly
 *  as `/v2?w=1` — the ticket's alternate form — without going through
 *  `/weekend`, which is why the reorder keys on the PARAM, not the route. */
export const WEEKEND_TOP_PARAM = "w";

export function weekendShortLinkTarget(search: string): string {
  const params = new URLSearchParams(search);
  if (!params.get("ref") && !params.get("utm_source")) {
    params.set("ref", WEEKEND_SHORT_LINK_DEFAULT_REF);
  }
  params.set(WEEKEND_TOP_PARAM, "1");
  return `${SHELL_ROUTES.home}?${params.toString()}`;
}

/** Whether this Home visit should lead with THE WEEKEND card. */
export function isWeekendTopRequested(search: string): boolean {
  return new URLSearchParams(search).get(WEEKEND_TOP_PARAM) === "1";
}
