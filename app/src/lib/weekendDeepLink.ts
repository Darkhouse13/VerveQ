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
 *
 * WKND-ENTRY: `?start=budget` is the PAID-CAMPAIGN variant — it lands
 * directly in the budget-squad builder instead of the hub. The `start` param
 * is consumed by the redirect and replaced with `entry=builder`, which
 * survives into the builder's URL (and its $pageview — analytics.ts keeps
 * `entry`) so PostHog can split builder-entry from hub-entry funnels. Any
 * other `start` value falls back to the hub, so a mistyped campaign link
 * degrades to the organic experience rather than a broken one. Organic links
 * carry no `start` and behave exactly as before.
 */
import { SHELL_ROUTES } from "@/lib/shellRoutes";

export const WEEKEND_SHORT_LINK_DEFAULT_REF = "weekend";

/** `/weekend?start=…` — where the short link should land (paid links only). */
export const WEEKEND_START_PARAM = "start";
export const WEEKEND_START_BUILDER = "budget";

/** Entry tag minted onto the redirect target so funnels can split on it. */
export const WEEKEND_ENTRY_PARAM = "entry";
export const WEEKEND_ENTRY_BUILDER = "builder";

/** Query param that pins the WEEKEND card to the top of Home (`/v2?w=1`).
 *  Pre-FW-GO short links minted it; Home still honours it. */
export const WEEKEND_TOP_PARAM = "w";

export function weekendShortLinkTarget(search: string): string {
  const params = new URLSearchParams(search);
  const toBuilder = params.get(WEEKEND_START_PARAM) === WEEKEND_START_BUILDER;
  params.delete(WEEKEND_START_PARAM);
  if (toBuilder) params.set(WEEKEND_ENTRY_PARAM, WEEKEND_ENTRY_BUILDER);
  if (!params.get("ref") && !params.get("utm_source")) {
    params.set("ref", WEEKEND_SHORT_LINK_DEFAULT_REF);
  }
  const target = toBuilder ? SHELL_ROUTES.weekendSquad : SHELL_ROUTES.weekend;
  const query = params.toString();
  return query.length > 0 ? `${target}?${query}` : target;
}

/** The builder-entry tag, read from the CURRENT location's search — the
 *  redirect leaves `entry=builder` on the squad URL and the screen never
 *  rewrites it, so this stays readable for the life of the visit. */
export function isBuilderEntry(search: string): boolean {
  return (
    new URLSearchParams(search).get(WEEKEND_ENTRY_PARAM) === WEEKEND_ENTRY_BUILDER
  );
}

/** Whether this Home visit should lead with THE WEEKEND card. */
export function isWeekendTopRequested(search: string): boolean {
  return new URLSearchParams(search).get(WEEKEND_TOP_PARAM) === "1";
}
