/**
 * Spoiler-free share content for THE DRAW (S5).
 *
 * HARD RULE: nothing produced here may contain card names or board contents.
 * Inputs are deliberately restricted to round outcomes + synergy chains (tag
 * vocabulary only) so a leak is structurally impossible — the share-card test
 * locks this in against the full card set.
 */

import type { RoundBreakdown, RunOutcome, SynergyFamily } from "@/lib/drawEngine";
import { formatMult, spacedTag } from "./meta";

export const OUTCOME_LABEL: Record<RunOutcome, string> = {
  banked: "BANKED",
  busted: "BUSTED",
  fullclear: "FULL CLEAR",
};

/** Rounds emoji trail: 🟩 cleared, 💥 bust; 🏦 bank / 👑 full clear cap. */
export function buildTrail(rounds: RoundBreakdown[], outcome: RunOutcome): string {
  const marks: string[] = rounds.map((r) => (r.cleared ? "🟩" : "💥"));
  if (outcome === "banked") marks.push("🏦");
  if (outcome === "fullclear") marks.push("👑");
  return marks.join("");
}

const FAMILY_WORD: Record<SynergyFamily, string> = {
  club: "SPINE",
  nation: "BLOC",
  era: "WAVE",
};

/**
 * Build identity line from the largest FIELDED chain across the run, e.g.
 * "CLUB D SPINE ×1.63". Chains come from granted round synergies (fielded
 * cards only, by engine contract) — tags, never card names.
 */
export function buildIdentity(rounds: RoundBreakdown[]): string | null {
  let best: { family: SynergyFamily; tag: string; chain: number; mult: number } | null = null;
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

export interface ShareCardData {
  boardNumber: number;
  outcome: RunOutcome;
  trail: string;
  /** Identity line or null (no chain granted all run). */
  identity: string | null;
  score: number;
  url: string;
}

export function buildShareText(data: ShareCardData): string {
  const identity = data.identity ? ` · ${data.identity}` : "";
  return `THE DRAW #${data.boardNumber} ${data.trail} ${OUTCOME_LABEL[data.outcome]}${identity} · ${Math.round(data.score).toLocaleString("en-US")} PTS ${data.url}`;
}
