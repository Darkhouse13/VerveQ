/**
 * VerveGrid ambient view-model — content-blind by contract.
 *
 * The grid's side rails (your-run stats + how-it-works on the left, your pick
 * log on the right) and the mobile HUD strip consume ONLY these shapes. Nothing
 * here names the board's criteria, the answer pool, or a correct player — only
 * meta status (guesses/cells/points) and the player's OWN picks on lock-in.
 *
 * Enforced by the answer-leak ESLint guard for every file under `play/ambient/`.
 */

export type GridCellDifficulty = "rare" | "uncommon" | "common";

/** Meta status of the current run. No board content. */
export interface GridRunStats {
  /** Guesses remaining (server-clocked). */
  guessesLeft: number;
  /** Untouched cells still tappable. */
  cellsRemaining: number;
  /** Sum of CELL-DIFFICULTY points over the player's correct cells. */
  points: number;
  /** Cells correctly filled, of `totalCells`. */
  correctCount: number;
  totalCells: number;
}

/**
 * One of the player's OWN correct picks, surfaced on lock-in. `label` is where
 * it landed ("<col> × <row>") — those criteria are already drawn on the board;
 * the panel treats it as opaque display text and never derives an answer from it.
 */
export interface GridPickItem {
  id: string;
  name: string;
  label: string;
  rarityTier?: GridCellDifficulty;
  points?: number;
}
