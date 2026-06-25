/**
 * Difficulty preference for the curated solo modes (VerveGrid, Higher or Lower).
 *
 * The tier is a CEILING — easy ⊂ intermediate ⊂ hard — and the backend decides
 * what each tier means per mode (VerveGrid gates the board's clubs by fame;
 * Higher or Lower gates the league the stat pool is drawn from). We default new
 * players to "easy" because both modes used to surface obscure clubs/leagues and
 * felt brutally hard; the choice is then remembered per mode in localStorage.
 *
 * Persisted under the shared `verveq_` key convention (see lib/languagePref.ts).
 */
import { useCallback, useState } from "react";

export type Difficulty = "easy" | "intermediate" | "hard";

export const DIFFICULTIES: Difficulty[] = ["easy", "intermediate", "hard"];
export const DEFAULT_DIFFICULTY: Difficulty = "easy";

/** localStorage key per mode, e.g. "verveq_difficulty_vervegrid". */
function storageKey(mode: string): string {
  return `verveq_difficulty_${mode}`;
}

function isDifficulty(value: string | null): value is Difficulty {
  return value === "easy" || value === "intermediate" || value === "hard";
}

export function loadDifficulty(mode: string): Difficulty {
  try {
    const stored = localStorage.getItem(storageKey(mode));
    if (isDifficulty(stored)) return stored;
  } catch {
    // Private mode / storage disabled — fall back to the default.
  }
  return DEFAULT_DIFFICULTY;
}

export function saveDifficulty(mode: string, difficulty: Difficulty): void {
  try {
    localStorage.setItem(storageKey(mode), difficulty);
  } catch {
    // Persistence is best-effort; the in-memory choice still applies this run.
  }
}

/**
 * Remembered difficulty for a mode + a setter that persists the choice. The
 * setter returns the new value so callers can also restart the game with it
 * without waiting for a state flush.
 */
export function useDifficulty(mode: string): [Difficulty, (next: Difficulty) => void] {
  const [difficulty, setDifficultyState] = useState<Difficulty>(() => loadDifficulty(mode));
  const setDifficulty = useCallback(
    (next: Difficulty) => {
      setDifficultyState(next);
      saveDifficulty(mode, next);
    },
    [mode],
  );
  return [difficulty, setDifficulty];
}
