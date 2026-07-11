/**
 * `/play` — the short link for off-platform CTAs (promo video endcards, the
 * TikTok/Instagram bio link). One typed-friendly URL that lands directly in
 * Career Path — the guest-playable mode the videos advertise — instead of the
 * generic landing, so the game a visitor was promised is the game they get.
 *
 * Attribution rides along: incoming query params are preserved (a bio link
 * can append ?ref=tiktok), and a bare /play gets ref=play so short-link
 * traffic is never bucketed as "direct" — funnel.careerPathMetrics groups
 * starters by this value, and PostHog pageviews keep ref/utm_* too
 * (lib/analytics.ts scrubSearch).
 */
import { SHELL_ROUTES } from "@/lib/shellRoutes";

export const PLAY_SHORT_LINK_DEFAULT_REF = "play";

export function playShortLinkTarget(search: string): string {
  const params = new URLSearchParams(search);
  if (!params.get("ref") && !params.get("utm_source")) {
    params.set("ref", PLAY_SHORT_LINK_DEFAULT_REF);
  }
  return `${SHELL_ROUTES.careerPathPlay}?${params.toString()}`;
}
