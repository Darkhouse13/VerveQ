/**
 * Rarity suppression (Ticket F, F6).
 *
 * "ONLY 100% DRAFTED THIS LINE" is what the result screen said when one person
 * had finished the board — the player themselves. A share of a population of
 * one is not a rarity, it is arithmetic noise wearing a stat's clothes, and it
 * appears exactly when a new board is least able to survive looking silly: at
 * launch, on the first run of every day, in the screenshot people post.
 *
 * So the line is suppressed entirely below a population floor rather than
 * hedged or reworded. One definition, imported by the result screen AND the
 * share text — the pair is the whole point: a threshold that lived in only one
 * of them would let the screen hide the line while the share card broadcast it,
 * which is the same absurdity with a longer path to the timeline.
 */

import type { DrawRarity } from "@/lib/drawApi/types";

/**
 * Completed runs needed before a line share means anything. At 25 the finest
 * distinction the stat can draw is 4% — coarse, but every step it reports is
 * real, and a sole finisher can no longer be told they are a 100% outlier.
 */
export const MIN_RARITY_POPULATION = 25;

/**
 * Whether the rarity line may render. The ONLY gate — both surfaces call this
 * rather than comparing the population themselves, so "shown on screen but not
 * on the share card" is unrepresentable.
 */
export function showRarity(rarity: DrawRarity | null): rarity is DrawRarity {
  return rarity !== null && rarity.population >= MIN_RARITY_POPULATION;
}
