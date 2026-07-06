const DIFFICULTY_RATINGS: Record<string, number> = {
  easy: 1000,
  intermediate: 1200,
  hard: 1400,
};

export function getKFactor(
  gamesPlayed: number,
  eloRating: number,
): { k: number; label: string } {
  if (gamesPlayed < 30) return { k: 40, label: "Placement Match" };
  if (eloRating >= 2000) return { k: 16, label: "High-Tier Protection" };
  return { k: 32, label: "Standard" };
}

export function calculateEloChange(
  playerRating: number,
  performanceScore: number,
  difficulty: string,
  kFactor: number = 32,
): number {
  const opponentRating = DIFFICULTY_RATINGS[difficulty] ?? 1200;
  const expected =
    1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(kFactor * (performanceScore - expected) * 10) / 10;
}

export function getQuizPerformance(
  correct: number,
  total: number,
  avgTime?: number,
): number {
  const accuracy = total > 0 ? correct / total : 0;
  const timeBonus =
    avgTime !== undefined && avgTime < 5 ? 0.1 * (1 - avgTime / 5) : 0;
  return Math.min(1.0, accuracy + timeBonus);
}

// ── Survival Reveal Ladder scoring (2026-07) ──
// Survival scores are POINTS banked from round pots (Easy 100 … Expert 300,
// shrinking with help usage), not a count of correct rounds. Roughly:
// ~2000 points ≈ the old "15 flawless rounds" perfect run.
export const SURVIVAL_PERFECT_POINTS = 2000;
export const SURVIVAL_WIN_POINTS = 1200;
const SURVIVAL_INTERMEDIATE_POINTS = 500;

export function getSurvivalPerformance(points: number): number {
  return Math.min(points / SURVIVAL_PERFECT_POINTS, 1.0);
}

export function getSurvivalDifficultyTier(
  points: number,
): "easy" | "intermediate" | "hard" {
  if (points >= SURVIVAL_WIN_POINTS) return "hard";
  if (points >= SURVIVAL_INTERMEDIATE_POINTS) return "intermediate";
  return "easy";
}

export function clampRating(rating: number): number {
  return Math.max(800, Math.min(2400, rating));
}

export function getTierName(
  elo: number,
): "Bronze" | "Silver" | "Gold" | "Platinum" {
  if (elo >= 2000) return "Platinum";
  if (elo >= 1500) return "Gold";
  if (elo >= 1200) return "Silver";
  return "Bronze";
}
