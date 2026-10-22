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
import { enDrawT, type DrawT } from "./drawI18n";

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

/**
 * The rarity claim, or null when the population is too small to make one.
 * `tr` reads the `draw` locale (English by default).
 */
export function rarityLine(rarity: DrawRarity | null, tr: DrawT = enDrawT): string | null {
  if (!showRarity(rarity)) return null;
  return tr("result.rarity", { pct: rarity.linePercent });
}

/** The outcome stamp in the active language (OUTCOME_LABEL is the English). */
export function outcomeLabel(outcome: RunOutcome, tr: DrawT = enDrawT): string {
  const key = `outcome.${outcome}`;
  const label = tr(key);
  return label === key ? OUTCOME_LABEL[outcome] : label;
}

export function buildShareText(data: ShareCardData, tr: DrawT = enDrawT): string {
  const identity = data.identity ? ` · ${data.identity}` : "";
  const rarity = rarityLine(data.rarity, tr);
  const rarityPart = rarity ? ` · ${rarity}` : "";
  return `THE DRAW #${data.boardNumber} ${data.trail} ${outcomeLabel(data.outcome, tr)}${identity}${rarityPart} · ${Math.round(data.score).toLocaleString("en-US")} ${tr("result.pts")} ${data.url}`;
}
