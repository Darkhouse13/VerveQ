import { v } from "convex/values";

/**
 * Difficulty tiers for the curated solo modes (VerveGrid, Higher or Lower).
 *
 * Tiers nest as a CEILING — a higher tier also serves the easier content:
 *   easy ⊂ intermediate ⊂ hard
 * so an "intermediate" run can surface easy material, and "hard" surfaces
 * everything (its original, unrestricted behaviour). Each mode decides what an
 * individual tier means (VerveGrid gates the board's team axes by club fame;
 * Higher or Lower gates the league/competition the pool is drawn from).
 *
 * Added because players reported both modes only ever felt brutally hard — the
 * randomness kept surfacing clubs/leagues nobody recognises. Easy keeps it to
 * household-name football; hard preserves the connoisseur experience.
 */
export type DifficultyLevel = "easy" | "intermediate" | "hard";

/** Convex validator for an optional difficulty argument. */
export const difficultyArg = v.optional(
  v.union(v.literal("easy"), v.literal("intermediate"), v.literal("hard")),
);

export const DEFAULT_DIFFICULTY: DifficultyLevel = "easy";

/**
 * Fallback chain when a requested tier has no playable content yet (e.g. before
 * the easy/intermediate boards have been seeded). Always widens toward "hard"
 * so a session can ALWAYS start rather than hard-failing on an empty pool.
 */
export function difficultyFallbackChain(level: DifficultyLevel): DifficultyLevel[] {
  switch (level) {
    case "easy":
      return ["easy", "intermediate", "hard"];
    case "intermediate":
      return ["intermediate", "hard"];
    case "hard":
      return ["hard"];
  }
}

/**
 * The board tiers a given difficulty accepts (the nesting ceiling). A legacy
 * board with no difficulty tag counts as "hard".
 */
export function acceptedTiersFor(level: DifficultyLevel): Set<DifficultyLevel> {
  switch (level) {
    case "easy":
      return new Set<DifficultyLevel>(["easy"]);
    case "intermediate":
      return new Set<DifficultyLevel>(["easy", "intermediate"]);
    case "hard":
      return new Set<DifficultyLevel>(["easy", "intermediate", "hard"]);
  }
}
