import { normalizeAnswer } from "./scoring";

/**
 * Compute Levenshtein edit distance between two strings.
 * Uses single-row DP for O(min(m,n)) space.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) [a, b] = [b, a];

  const aLen = a.length;
  const bLen = b.length;
  let prev = Array.from({ length: aLen + 1 }, (_, i) => i);
  let curr = new Array<number>(aLen + 1);

  for (let j = 1; j <= bLen; j++) {
    curr[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1, // deletion
        curr[i - 1] + 1, // insertion
        prev[i - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[aLen];
}

/**
 * Dynamic max edit distance based on target name length.
 * Short names are strict; long names get more tolerance.
 */
function getMaxDistance(normalizedTarget: string): number {
  const len = normalizedTarget.length;
  if (len < 8) return 1;
  if (len <= 14) return 2;
  return 3;
}

export function isMatch(answer: string, target: string): boolean {
  const a = normalizeAnswer(answer);
  const t = normalizeAnswer(target);
  if (a === t) return true;
  return levenshteinDistance(a, t) <= getMaxDistance(t);
}

export interface MatchResult {
  matched: boolean;
  distance: number;
  matchedPlayer: string;
  closeCall: boolean;
  typoAccepted: boolean;
}

export function findBestMatch(
  guess: string,
  validPlayers: string[],
): MatchResult {
  const normalizedGuess = normalizeAnswer(guess);
  if (!normalizedGuess) {
    return {
      matched: false,
      distance: Infinity,
      matchedPlayer: validPlayers[0] || guess,
      closeCall: false,
      typoAccepted: false,
    };
  }
  let bestDistance = Infinity;
  let bestPlayer = validPlayers[0] || guess;
  let bestMaxDistance = 1;

  for (const player of validPlayers) {
    const normalizedPlayer = normalizeAnswer(player);
    const dist = levenshteinDistance(normalizedGuess, normalizedPlayer);

    if (dist < bestDistance) {
      bestDistance = dist;
      bestPlayer = player;
      bestMaxDistance = getMaxDistance(normalizedPlayer);
    }

    if (dist === 0) break;
  }

  if (bestDistance === 0) {
    return {
      matched: true,
      distance: 0,
      matchedPlayer: bestPlayer,
      closeCall: false,
      typoAccepted: false,
    };
  }

  if (bestDistance <= bestMaxDistance) {
    return {
      matched: true,
      distance: bestDistance,
      matchedPlayer: bestPlayer,
      closeCall: false,
      typoAccepted: true,
    };
  }

  // Close call: within 1-2 edits beyond the threshold
  const closeCall =
    bestDistance === bestMaxDistance + 1 ||
    bestDistance === bestMaxDistance + 2;

  return {
    matched: false,
    distance: bestDistance,
    matchedPlayer: bestPlayer,
    closeCall,
    typoAccepted: false,
  };
}
