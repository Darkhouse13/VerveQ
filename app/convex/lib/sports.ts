// The single source of truth for the sports/subjects a client is allowed to
// name when it opens or matchmakes a game (quiz, blitz, daily, duel, challenge).
//
// This is an allowlist: anything not listed is rejected, fail-closed. In
// particular the arena-only CIE subject ("arena_knowledge", seeded by
// challengeArenaCieContent.ts) is deliberately absent — those rows must stay
// reachable ONLY through challenge-arena round-locking, never a quiz/blitz/
// daily/duel/challenge a client opens for itself. Keeping the literal out of
// this allowlist is what enforces that boundary.
//
// Football-only modes (Higher/Lower, VerveGrid, Who Am I) keep their own
// stricter `sport === "football"` checks; this set is the broad gate for the
// modes that span every client-facing subject.
export const CLIENT_SPORTS = [
  "football",
  "basketball",
  "tennis",
  "knowledge",
] as const;

export type ClientSport = (typeof CLIENT_SPORTS)[number];

const CLIENT_SPORT_SET: ReadonlySet<string> = new Set(CLIENT_SPORTS);

export function isClientSport(sport: string): sport is ClientSport {
  return CLIENT_SPORT_SET.has(sport);
}

// Throws a clean error for any sport outside the allowlist. Call this at every
// public entry point that accepts a client-supplied sport before it is used to
// read content or persist game state.
export function assertClientSport(sport: string): asserts sport is ClientSport {
  if (!isClientSport(sport)) {
    throw new Error("Unsupported sport");
  }
}
