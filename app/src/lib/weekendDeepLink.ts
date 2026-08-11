/**
 * `/weekend` — the short link for off-platform WEEKEND CTAs (reel captions, the
 * Instagram/TikTok bio link). One typed-friendly URL.
 *
 * FW-GO: the mode is LIVE, so the short link lands on the WEEKEND hub
 * (`/v2/weekend`) — the mode's own front door — instead of the pre-launch
 * teaser placement on Home. The hub is behind `ShellGate` (the build flag)
 * ONLY, with no session guard, so an anonymous visitor sees the mode before
 * being asked for anything; the individual surfaces keep their own guards.
 *
 * Attribution rides along exactly as `/play` does (lib/playShortLink): incoming
 * params are preserved so a bio link can append `?utm_source=ig`, and a bare
 * /weekend gets `ref=weekend` so short-link traffic is never bucketed as
 * "direct".
 *
 * `?w=1` (the pre-launch "lead Home with the WEEKEND card" param) is still
 * honoured BY HOME for old links that carried it — `isWeekendTopRequested`
 * keeps that contract — but the short link no longer mints it.
 */
import { SHELL_ROUTES } from "@/lib/shellRoutes";

export const WEEKEND_SHORT_LINK_DEFAULT_REF = "weekend";

/** Query param that pins the WEEKEND card to the top of Home (`/v2?w=1`).
 *  Pre-FW-GO short links minted it; Home still honours it. */
export const WEEKEND_TOP_PARAM = "w";

export function weekendShortLinkTarget(search: string): string {
  const params = new URLSearchParams(search);
  if (!params.get("ref") && !params.get("utm_source")) {
    params.set("ref", WEEKEND_SHORT_LINK_DEFAULT_REF);
  }
  const query = params.toString();
  return query.length > 0 ? `${SHELL_ROUTES.weekend}?${query}` : SHELL_ROUTES.weekend;
}

/** Whether this Home visit should lead with THE WEEKEND card. */
export function isWeekendTopRequested(search: string): boolean {
  return new URLSearchParams(search).get(WEEKEND_TOP_PARAM) === "1";
}
