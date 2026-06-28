import { normalizeAnswer } from "./scoring";

/**
 * Player name search helpers (shared by the VerveGrid runtime search, the seed
 * path, and the backfill job).
 *
 * The roster is sourced from a sports API that stores DISPLAY names in an
 * abbreviated "X. Lastname" form ("H. Kane", "E. Haaland") — ~64% of players.
 * The full given name lives only in `firstName`, and `lastName` can be a
 * compound ("Braut Haaland", "Mbappé Lottin"). A prefix scan over `name`/
 * `lastName` therefore can't find a player by their well-known full name
 * ("Harry Kane" → nothing) or even by their common surname when it isn't the
 * first lastName token ("Haaland" → nothing). These helpers flatten every name
 * field into a normalized token bag so search can match ANY token.
 */

/**
 * The distinct, accent-folded, lowercased tokens drawn from a player's display
 * name + first name + last name. Single source of truth for both the
 * `searchText` index field and the in-memory relevance matcher, so they never
 * drift.
 */
export function playerSearchTokens(
  name?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): string[] {
  const tokens = new Set<string>();
  for (const raw of [name, firstName, lastName]) {
    if (!raw) continue;
    for (const token of normalizeAnswer(raw).split(/\s+/)) {
      if (token) tokens.add(token);
    }
  }
  return [...tokens];
}

/**
 * The denormalized value stored in the `sportsPlayers.searchText` field and fed
 * to the Convex full-text search index. A space-joined token bag so the index
 * can match on the given name, any surname token, or the abbreviated form.
 */
export function buildPlayerSearchText(
  name?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): string {
  return playerSearchTokens(name, firstName, lastName).join(" ");
}

// "H. Kane", "B. Foster", "E. O'Kane" — a single capital, an optional dot, then
// whitespace and the rest of the name. Used to decide whether to expand the
// display name from firstName + lastName.
const ABBREVIATED_DISPLAY_NAME = /^\p{Lu}\.?\s+\S/u;

/**
 * Turn an abbreviated stored display name into the recognisable full name using
 * the first given-name token + the full surname ("H. Kane" + "Harry Edward" +
 * "Kane" → "Harry Kane"). Non-abbreviated names ("Lionel Messi", "Son
 * Heung-Min") and rows missing first/last name are returned unchanged. This is
 * cosmetic only — VerveGrid validates on `externalId`, never on the name.
 */
export function expandPlayerDisplayName(
  name: string,
  firstName?: string | null,
  lastName?: string | null,
): string {
  if (!name || !ABBREVIATED_DISPLAY_NAME.test(name)) return name;
  const firstToken = (firstName ?? "").trim().split(/\s+/)[0] ?? "";
  const surname = (lastName ?? "").trim();
  if (!firstToken || !surname) return name;
  return `${firstToken} ${surname}`;
}
