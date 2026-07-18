/**
 * THE DRAW — outbound share links (Ticket I). Both builders read the
 * canonical share origin (lib/shareBase, the duel buildShareUrl precedent) —
 * never window.location.origin.
 */

import { RUN_SHARE_PATH_PREFIX } from "../../convex/lib/drawShare";
import { getShareBaseUrl } from "./shareBase";

/** A completed run's landing link: verveq.com/s/r/<slug>. */
export function buildRunShareUrl(slug: string): string {
  return `${getShareBaseUrl()}${RUN_SHARE_PATH_PREFIX}${slug}`;
}

/** Fallback share target while a run has no slug yet (mock/dev harness). */
export function drawModeUrl(): string {
  return `${getShareBaseUrl()}/draw`;
}
