/**
 * Difficulty tier for the curated solo modes (VerveGrid, Higher or Lower).
 *
 * The tier is a CEILING — easy ⊂ intermediate ⊂ hard — and the backend decides
 * what each tier means per mode (VerveGrid gates the board's clubs by fame;
 * Higher or Lower gates the league the stat pool is drawn from). The tier is
 * chosen up front on the shared difficulty picker (see pages/DifficultyScreen)
 * and carried into the play screen as the `?difficulty=` query param — there is
 * no in-game tier changer, so the choice holds for the run. We default to "easy"
 * (both modes used to surface obscure clubs/leagues and felt brutally hard).
 */
export type Difficulty = "easy" | "intermediate" | "hard";

export const DIFFICULTIES: Difficulty[] = ["easy", "intermediate", "hard"];
export const DEFAULT_DIFFICULTY: Difficulty = "easy";

function isDifficulty(value: string | null): value is Difficulty {
  return value === "easy" || value === "intermediate" || value === "hard";
}

/** Coerce a `?difficulty=` query param to a valid tier, defaulting to easy. */
export function parseDifficulty(value: string | null): Difficulty {
  return isDifficulty(value) ? value : DEFAULT_DIFFICULTY;
}
