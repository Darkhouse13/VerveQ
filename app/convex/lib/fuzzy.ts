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
export function getMaxFuzzyDistance(normalizedTarget: string): number {
  const len = normalizedTarget.length;
  if (len < 8) return 1;
  if (len <= 14) return 2;
  return 3;
}

export function isMatch(answer: string, target: string): boolean {
  const a = normalizeAnswer(answer);
  const t = normalizeAnswer(target);
  if (a === t) return true;
  return levenshteinDistance(a, t) <= getMaxFuzzyDistance(t);
}

export interface MatchResult {
  matched: boolean;
  distance: number;
  matchedPlayer: string;
  closeCall: boolean;
  typoAccepted: boolean;
  /** Matched via an unambiguous surname (name suffix) rather than the full name. */
  surnameMatch: boolean;
  /** Guess matched the surname of 2+ valid players — the full name is needed. */
  ambiguousSurname: boolean;
}

export interface FindBestMatchOptions {
  /**
   * Accept a guess that names only the surname (any word-suffix of the full
   * name, e.g. "De Bruyne" or "Bruyne" for "Kevin De Bruyne") when exactly one
   * valid player carries it. Off by default so full-name modes (Career Path,
   * logo answers) keep their stricter contract.
   */
  acceptSurname?: boolean;
}

/**
 * Best edit distance between the guess and any proper word-suffix of the
 * player's normalized name (surnames incl. particles: "bruyne", "de bruyne").
 * Returns null when no suffix qualifies. Short suffixes (<4 chars) must match
 * exactly; longer ones get the usual length-scaled typo budget.
 */
function bestSurnameDistance(
  normalizedGuess: string,
  normalizedPlayer: string,
): number | null {
  const words = normalizedPlayer.split(" ").filter(Boolean);
  if (words.length < 2) return null; // single-word names have no surname shortcut
  let best: number | null = null;
  for (let k = 1; k < words.length; k++) {
    const suffix = words.slice(words.length - k).join(" ");
    const maxDist = suffix.length < 4 ? 0 : getMaxFuzzyDistance(suffix);
    const dist = levenshteinDistance(normalizedGuess, suffix);
    if (dist <= maxDist && (best === null || dist < best)) best = dist;
  }
  return best;
}

export function findBestMatch(
  guess: string,
  validPlayers: string[],
  options: FindBestMatchOptions = {},
): MatchResult {
  const normalizedGuess = normalizeAnswer(guess);
  if (!normalizedGuess) {
    return {
      matched: false,
      distance: Infinity,
      matchedPlayer: validPlayers[0] || guess,
      closeCall: false,
      typoAccepted: false,
      surnameMatch: false,
      ambiguousSurname: false,
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
      bestMaxDistance = getMaxFuzzyDistance(normalizedPlayer);
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
      surnameMatch: false,
      ambiguousSurname: false,
    };
  }

  if (bestDistance <= bestMaxDistance) {
    return {
      matched: true,
      distance: bestDistance,
      matchedPlayer: bestPlayer,
      closeCall: false,
      typoAccepted: true,
      surnameMatch: false,
      ambiguousSurname: false,
    };
  }

  if (options.acceptSurname && normalizedGuess.length >= 2) {
    const surnameHits: Array<{ player: string; distance: number }> = [];
    for (const player of validPlayers) {
      const dist = bestSurnameDistance(normalizedGuess, normalizeAnswer(player));
      if (dist !== null) surnameHits.push({ player, distance: dist });
    }
    if (surnameHits.length === 1) {
      const hit = surnameHits[0];
      return {
        matched: true,
        distance: hit.distance,
        matchedPlayer: hit.player,
        closeCall: false,
        typoAccepted: hit.distance > 0,
        surnameMatch: true,
        ambiguousSurname: false,
      };
    }
    if (surnameHits.length >= 2) {
      return {
        matched: false,
        distance: Math.min(...surnameHits.map((hit) => hit.distance)),
        matchedPlayer: bestPlayer,
        closeCall: true,
        typoAccepted: false,
        surnameMatch: false,
        ambiguousSurname: true,
      };
    }
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
    surnameMatch: false,
    ambiguousSurname: false,
  };
}
