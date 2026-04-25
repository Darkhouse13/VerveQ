export function calculateTimeScore(
  basePoints: number,
  timeTaken: number,
  maxTime = 10.0,
): number {
  if (timeTaken > maxTime) return 0;
  if (timeTaken <= 1.0) return basePoints;
  return Math.max(
    0,
    Math.floor(basePoints * ((maxTime - timeTaken) / (maxTime - 1.0))),
  );
}

export function normalizeAnswer(answer: string): string {
  return answer
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "");
}
