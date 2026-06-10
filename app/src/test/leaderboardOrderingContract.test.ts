/**
 * Leaderboard ordering + dedup contract.
 *
 * The ordering decision lives SERVER-SIDE (convex/leaderboards.ts /
 * convex/blitz.ts) — clients render entries as received. This locks:
 *
 *  - strict descending ELO order with deterministic tie-breaks,
 *  - exactly one entry per user (the unscoped board reads `userRatings`, which
 *    holds one row per user-sport-mode — collapsing to the user's best rating
 *    is what keeps a multi-mode player from filling several slots),
 *  - server-assigned ranks 1..n with no duplicates or gaps,
 *  - zero-game rows and ranked-ineligible (anonymous/guest) users excluded,
 *  - Blitz: one entry per user (best run), even with many runs on file.
 */
import { describe, expect, it } from "vitest";

import * as leaderboards from "../../convex/leaderboards";
import * as blitz from "../../convex/blitz";

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const f = fn as { _handler?: (ctx: unknown, args: unknown) => Promise<unknown> };
  if (typeof f._handler !== "function") {
    throw new Error("not a Convex function with an accessible handler");
  }
  return f._handler;
}

const USERS: Record<string, { _id: string; username: string; isAnonymous: boolean }> = {
  u_alice: { _id: "u_alice", username: "alice", isAnonymous: false },
  u_bob: { _id: "u_bob", username: "bob", isAnonymous: false },
  u_cara: { _id: "u_cara", username: "cara", isAnonymous: false },
  u_anon: { _id: "u_anon", username: "ghost", isAnonymous: true },
};

type RatingRow = {
  userId: string;
  sport: string;
  mode: string;
  eloRating: number;
  bestScore: number;
  gamesPlayed: number;
  wins: number;
};

function rating(
  userId: string,
  mode: string,
  eloRating: number,
  gamesPlayed = 5,
): RatingRow {
  return {
    userId,
    sport: "football",
    mode,
    eloRating,
    bestScore: 10,
    gamesPlayed,
    wins: 1,
  };
}

/** Mock ctx whose index emulates `by_sport_mode_elo` (ELO-desc) and whose
 *  unscoped collect returns rows in raw insertion order. */
function ctxWith(ratings: RatingRow[]) {
  return {
    db: {
      query: () => ({
        withIndex: () => ({
          order: () => ({
            collect: async () =>
              [...ratings].sort((a, b) => b.eloRating - a.eloRating),
          }),
        }),
        collect: async () => ratings,
      }),
      get: async (id: string) => USERS[id] ?? null,
    },
  };
}

type Entry = { rank: number; userId: string; elo_rating: number };

describe("getLeaderboard — unscoped (All) board", () => {
  // Insertion order is deliberately NOT elo order, and alice has two
  // mode rows — the old `.take(200)`-by-creation-time path returned exactly
  // this shape unsorted and with alice twice.
  const rows = [
    rating("u_alice", "quiz", 1500),
    rating("u_anon", "quiz", 1800),
    rating("u_bob", "quiz", 1600),
    rating("u_alice", "survival", 1700),
    rating("u_cara", "quiz", 1900, 0), // zero games — must not appear
  ];

  it("orders by ELO desc, dedupes users to their best rating, ranks 1..n", async () => {
    const result = (await handlerOf(leaderboards.getLeaderboard)(ctxWith(rows), {
      limit: 20,
    })) as { entries: Entry[] };

    expect(result.entries.map((e) => e.userId)).toEqual(["u_alice", "u_bob"]);
    expect(result.entries.map((e) => e.elo_rating)).toEqual([1700, 1600]);
    expect(result.entries.map((e) => e.rank)).toEqual([1, 2]);

    // Invariants QA tripped over: no duplicate users, strictly sorted.
    const ids = result.entries.map((e) => e.userId);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < result.entries.length; i++) {
      expect(result.entries[i - 1].elo_rating).toBeGreaterThanOrEqual(
        result.entries[i].elo_rating,
      );
    }
  });

  it("breaks ELO ties deterministically (more games first)", async () => {
    const tied = [
      rating("u_bob", "quiz", 1500, 3),
      rating("u_alice", "quiz", 1500, 9),
    ];
    const result = (await handlerOf(leaderboards.getLeaderboard)(ctxWith(tied), {
      limit: 20,
    })) as { entries: Entry[] };
    expect(result.entries.map((e) => e.userId)).toEqual(["u_alice", "u_bob"]);
  });
});

describe("getLeaderboard — scoped (sport+mode) board", () => {
  it("dedupes defensively and assigns strict ranks off the index order", async () => {
    const rows = [
      rating("u_bob", "quiz", 1600),
      rating("u_alice", "quiz", 1500),
      rating("u_anon", "quiz", 1800), // ineligible — skipped without a gap
    ];
    const result = (await handlerOf(leaderboards.getLeaderboard)(ctxWith(rows), {
      sport: "football",
      mode: "quiz",
      limit: 20,
    })) as { entries: Entry[] };

    expect(result.entries.map((e) => e.userId)).toEqual(["u_bob", "u_alice"]);
    expect(result.entries.map((e) => e.rank)).toEqual([1, 2]);
  });

  it("still fills the board when ineligible rows sit on top (no take-before-filter)", async () => {
    const rows = [
      rating("u_anon", "quiz", 2000),
      rating("u_alice", "quiz", 1500),
      rating("u_bob", "quiz", 1400),
    ];
    const result = (await handlerOf(leaderboards.getLeaderboard)(ctxWith(rows), {
      sport: "football",
      mode: "quiz",
      limit: 2,
    })) as { entries: Entry[] };
    expect(result.entries.map((e) => e.userId)).toEqual(["u_alice", "u_bob"]);
  });
});

describe("blitz getHighScores — one entry per user", () => {
  it("keeps each user's best run only, ranked in score order", async () => {
    const scores = [
      { userId: "u_anon", sport: "football", score: 60, correctCount: 20, wrongCount: 1, playedAt: 4 },
      { userId: "u_alice", sport: "football", score: 50, correctCount: 18, wrongCount: 2, playedAt: 3 },
      { userId: "u_alice", sport: "football", score: 45, correctCount: 16, wrongCount: 2, playedAt: 2 },
      { userId: "u_bob", sport: "football", score: 40, correctCount: 15, wrongCount: 3, playedAt: 1 },
    ];
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({
            order: () => ({
              collect: async () => [...scores].sort((a, b) => b.score - a.score),
            }),
          }),
        }),
        get: async (id: string) => USERS[id] ?? null,
      },
    };

    const result = (await handlerOf(blitz.getHighScores)(ctx, {
      sport: "football",
      limit: 20,
    })) as { entries: Array<{ rank: number; userId: string; score: number }> };

    expect(result.entries.map((e) => e.userId)).toEqual(["u_alice", "u_bob"]);
    expect(result.entries.map((e) => e.score)).toEqual([50, 40]);
    expect(result.entries.map((e) => e.rank)).toEqual([1, 2]);
  });
});
