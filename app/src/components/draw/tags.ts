/**
 * Tag display vocabulary for THE DRAW (Ticket F, F7).
 *
 * Card faces show a club's SHORT CODE and the detail sheet shows its full
 * name. The synthetic dev set carries neither — its clubs are bare "CLUB_A"
 * tags — and the real set (CIE card-set ticket) will. So both are resolved
 * through this one lookup, which is generic over card data:
 *
 *   code  → TAG_DISPLAY[tag].code, else the first 3 characters of the tag's
 *           distinguishing part, uppercased ("CLUB_A" → "A").
 *   name  → TAG_DISPLAY[tag].name, else the spaced tag ("CLUB_A" → "CLUB A").
 *
 * The registry is EMPTY today and that is the point: rendering must not depend
 * on the E-tickets' data landing, and when it does land, populating this map
 * (or replacing it with card-carried display fields) changes every face and
 * sheet with no component edits. Nothing here may hand-write a real club name
 * — the fallback path is what the synthetic set renders through.
 */

import { shortTag, spacedTag } from "./meta";

export interface TagDisplay {
  /** Short code for a card face, e.g. "MUN". */
  code: string;
  /** Full name for the detail sheet, e.g. "Manchester United". */
  name: string;
}

/**
 * Tag → display. Populated by the card-set ticket; empty while the set is
 * synthetic, so every lookup below takes the derived fallback.
 */
export const TAG_DISPLAY: Record<string, TagDisplay> = {};

/** Club/nation short code for a card face. Never longer than 3 characters. */
export function tagCode(tag: string): string {
  const known = TAG_DISPLAY[tag];
  if (known) return known.code;
  return shortTag(tag).slice(0, 3).toUpperCase();
}

/** Full club/nation name for the card detail sheet. */
export function tagName(tag: string): string {
  return TAG_DISPLAY[tag]?.name ?? spacedTag(tag);
}
