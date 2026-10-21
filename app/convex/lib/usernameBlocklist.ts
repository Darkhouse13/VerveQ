/**
 * Slur filter for public names (usernames, display names). Every public name
 * shows on leaderboards, duel cards and crew tables to strangers, so a name
 * built from a slur is a moderation problem, not a matter of taste.
 *
 * Two lists, chosen to avoid the Scunthorpe problem:
 *  - SUBSTRINGS are long and unambiguous enough to block anywhere in a name
 *    ("xx_nigga_99", "n1gg3r").
 *  - TOKENS are short words that also occur inside innocent names ("spice",
 *    "raccoon", "pakistan"), so they block only as a whole name or as one
 *    underscore/digit-separated part of it.
 *
 * Matching runs on a folded form: lowercase, common digit/letter swaps undone
 * (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, 9→g), separators dropped.
 */
const SUBSTRINGS = [
  "nigg",
  "nigga",
  "niglet",
  "faggot",
  "fagot",
  "wetback",
  "beaner",
  "tranny",
  "retard",
  "raghead",
  "towelhead",
  "sandnig",
  "hitler",
  "kkk",
  "whitepower",
  "gaschamber",
];

const TOKENS = new Set([
  "nig",
  "nigs",
  "niga",
  "kike",
  "kikes",
  "chink",
  "chinks",
  "spic",
  "spics",
  "coon",
  "coons",
  "gook",
  "gooks",
  "nazi",
  "paki",
  "pakis",
  "dyke",
  "fag",
  "fags",
]);

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
};

function unleet(value: string): string {
  return value
    .toLowerCase()
    .split("")
    .map((ch) => LEET[ch] ?? ch)
    .join("");
}

/** True when a public name contains a slur. */
export function isBlockedName(raw: string): boolean {
  if (!raw) return false;
  const lower = raw.toLowerCase();
  // Folded with leet undone, separators and anything non-letter dropped.
  const folded = unleet(lower).replace(/[^a-z]/g, "");
  if (SUBSTRINGS.some((s) => folded.includes(s))) return true;
  if (TOKENS.has(folded)) return true;
  // Parts split on separators and digits as typed ("spic_99" → "spic").
  const parts = lower.split(/[^a-z]+/).filter(Boolean);
  if (parts.some((p) => TOKENS.has(p))) return true;
  // Parts with leet undone ("c00n" → "coon").
  const leetParts = unleet(lower).split(/[^a-z]+/).filter(Boolean);
  return leetParts.some((p) => TOKENS.has(p));
}

/** A user-supplied display name, or undefined when it is empty or blocked. */
export function cleanDisplayName(raw: string | undefined | null): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return isBlockedName(trimmed) ? undefined : trimmed;
}
