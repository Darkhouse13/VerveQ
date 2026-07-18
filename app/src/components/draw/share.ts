/**
 * Spoiler-free share content for THE DRAW (S5).
 *
 * HARD RULE: nothing produced here may contain card names or board contents.
 * Inputs are deliberately restricted to round outcomes + synergy chains (tag
 * vocabulary only) so a leak is structurally impossible — the share-card test
 * locks this in against the full card set.
 */

import type { RunOutcome } from "@/lib/drawEngine";
import type { DrawRarity } from "@/lib/drawApi/types";
import { showRarity } from "./rarity";

// Ticket I — the trail/identity builders moved to convex/lib/drawShare (the
// lib/drawMessages pattern): the share-landing server payload is built by the
// SAME functions this screen renders with, so the two can never disagree.
// The engine's RoundBreakdown satisfies the lib's structural ShareRound.
import { OUTCOME_LABEL } from "../../../convex/lib/drawShare";

export {
  OUTCOME_LABEL,
  buildIdentity,
  buildTrail,
} from "../../../convex/lib/drawShare";

export interface ShareCardData {
  boardNumber: number;
  outcome: RunOutcome;
  trail: string;
  /** Identity line or null (no chain granted all run). */
  identity: string | null;
  score: number;
  url: string;
  /**
   * F6 — the RAW rarity, not a pre-filtered string. Both this module and
   * ShareCard put it through `showRarity`, so the screen and the share text
   * cannot disagree about whether the population is big enough to quote.
   * Passing an already-decided value would put that decision in the caller and
   * let the two surfaces drift.
   */
  rarity: DrawRarity | null;
}

/** The rarity claim, or null when the population is too small to make one. */
export function rarityLine(rarity: DrawRarity | null): string | null {
  if (!showRarity(rarity)) return null;
  return `ONLY ${rarity.linePercent}% DRAFTED THIS LINE`;
}

export function buildShareText(data: ShareCardData): string {
  const identity = data.identity ? ` · ${data.identity}` : "";
  const rarity = rarityLine(data.rarity);
  const rarityPart = rarity ? ` · ${rarity}` : "";
  return `THE DRAW #${data.boardNumber} ${data.trail} ${OUTCOME_LABEL[data.outcome]}${identity}${rarityPart} · ${Math.round(data.score).toLocaleString("en-US")} PTS ${data.url}`;
}
