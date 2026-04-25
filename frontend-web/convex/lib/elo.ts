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

export function getSurvivalPerformance(score: number): number {
  return Math.min(score / 15, 1.0);
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
