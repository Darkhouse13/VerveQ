/**
 * THE DRAW — share-link primitives (Ticket I), shared server/client like
 * lib/drawMessages and lib/drawDaily: the server allocates slugs and builds
 * the spoiler-free summary strings; the client renders and re-uses the same
 * builders for the result screen, so the landing page and the share card can
 * never disagree about what a run looks like.
 *
 * HARD RULE (S5, inherited): nothing produced here may contain card names or
 * board contents. Inputs are restricted to round outcomes + synergy tags.
 */

/** The share-landing route: verveq.com/s/r/<slug> (duel /s/d/ precedent). */
export const RUN_SHARE_PATH_PREFIX = "/s/r/";

// Same scheme as duel linkCodes (duels.ts randomCode): crypto RNG over a
// Crockford-ish alphabet (no I/O/0/1). 31^10 ≈ 8×10^14 slugs — unguessable.
const SLUG_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RUN_SHARE_SLUG_PREFIX = "DR";
export const RUN_SHARE_SLUG_RANDOM_LENGTH = 10;

export function randomRunShareSlug(): string {
  const bytes = new Uint8Array(RUN_SHARE_SLUG_RANDOM_LENGTH);
  crypto.getRandomValues(bytes);
  let slug = RUN_SHARE_SLUG_PREFIX;
  for (const byte of bytes) slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
  return slug;
}

// ── spoiler-free summary builders ──
// Typed structurally (not against the engine's RoundBreakdown) so this module
// pulls in nothing: the engine's rounds satisfy these shapes, and a payload
// built from them can only ever carry outcomes and synergy tags.

export type ShareOutcome = "banked" | "busted" | "fullclear";
export type ShareSynergyFamily = "club" | "nation" | "era";

export interface ShareRound {
  cleared: boolean;
  synergies: Array<{
    family: ShareSynergyFamily;
    tag: string;
    chain: number;
    mult: number;
  }>;
}

export const OUTCOME_LABEL: Record<ShareOutcome, string> = {
  banked: "BANKED",
  busted: "BUSTED",
  fullclear: "FULL CLEAR",
};

/** "CLUB_D" → "D", "NATION_C" → "C", "ERA_1990s" → "90s". */
export function shortTag(tag: string): string {
  if (tag.startsWith("ERA_")) return tag.replace(/^ERA_..(..s)$/, "$1");
  return tag.replace(/^[A-Z]+_/, "");
}

/** "CLUB_D" → "CLUB D" (identity/share lines). */
export function spacedTag(tag: string): string {
  if (tag.startsWith("ERA_")) return `${shortTag(tag)} ERA`;
  return tag.replace("_", " ");
}

export function formatMult(mult: number): string {
  return `×${(Math.round(mult * 100) / 100).toString()}`;
}

const FAMILY_WORD: Record<ShareSynergyFamily, string> = {
  club: "SPINE",
  nation: "BLOC",
  era: "WAVE",
};

/** Rounds emoji trail: 🟩 cleared, 💥 bust; 🏦 bank / 👑 full clear cap. */
export function buildTrail(
  rounds: Array<Pick<ShareRound, "cleared">>,
  outcome: ShareOutcome,
): string {
  const marks: string[] = rounds.map((r) => (r.cleared ? "🟩" : "💥"));
  if (outcome === "banked") marks.push("🏦");
  if (outcome === "fullclear") marks.push("👑");
  return marks.join("");
}

/**
 * Build identity line from the largest FIELDED chain across the run, e.g.
 * "CLUB D SPINE ×1.63". Chains come from granted round synergies (fielded
 * cards only, by engine contract) — tags, never card names.
 */
export function buildIdentity(rounds: ShareRound[]): string | null {
  let best: ShareRound["synergies"][number] | null = null;
  for (const round of rounds) {
    for (const s of round.synergies) {
      if (!best || s.chain > best.chain || (s.chain === best.chain && s.mult > best.mult)) {
        best = s;
      }
    }
  }
  if (!best) return null;
  return `${spacedTag(best.tag)} ${FAMILY_WORD[best.family]} ${formatMult(best.mult)}`;
}
