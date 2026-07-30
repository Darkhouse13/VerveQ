/**
 * Weekend Fantasy — crowd voting (FW-LAUNCH O2, CROWD_VOTING_SPEC v1.0.1).
 *
 * The eye-test instrument. Server-served pairwise votes ("who had the better
 * game?") move a per-gameweek Elo per player; at settlement the frozen
 * ratings derive each player's crowd factor and the factor reaches scores as
 * NEW fantasyPlayerScores versions — never a mutation, never a second
 * mirroring rule. Rules live in lib/fantasyCrowd.ts (pure); this module is
 * the authorized wrapper plus the one pipeline hook.
 *
 * The band discipline (STANDING RULE 6): deriveCrowdFactors is in ±15% by
 * construction, and applyCrowdFactorsForGameweek still calls
 * assertCrowdFactorInBand on every factor before writing — the pipeline's
 * rejection stays the safety net, exercised on every write.
 *
 * Windows (LOCKED): voting opens at each fixture's full-time and closes at
 * the gameweek's finality instant; the factor applied is the frozen one;
 * a settled gameweek is immune to everything here.
 *
 * Anti-abuse per spec §Anti-abuse: pairs are server-chosen, single-use per
 * user, capped per gameweek, liquidity-targeted, and a user is never served
 * a pair containing any player in any of their squads this gameweek.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  CROWD_LIQUIDITY_THRESHOLD,
  CROWD_ELO_START,
  CROWD_SERVE_CAP_PER_GAMEWEEK,
  consensusOf,
  deriveCrowdFactors,
  eloUpdate,
  pairKeyOf,
  type CrowdRatingEntry,
} from "./lib/fantasyCrowd";
import { assertCrowdFactorInBand } from "./lib/fantasyScorePipeline";
import { findOpenGameweek } from "./fantasyDraftRooms";
import { currentScoreRow, gameweekScoringRow } from "./fantasyScores";

export const SIGN_IN_REQUIRED = "Sign in to vote.";
export const VOTING_CLOSED = "Voting for this gameweek has closed.";
export const PAIR_NOT_FOUND = "That pair is not yours to vote on.";
export const PAIR_ALREADY_USED = "That pair has already been answered.";
export const SERVE_CAP_REACHED =
  "You have reached this gameweek's voting limit — thank you for the eyes.";

// ── shared guards ──

async function requireUserId(ctx: MutationCtx | QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error(SIGN_IN_REQUIRED);
  return userId;
}

/** Voting is open while the gameweek's finality instant is ahead AND the
 *  settlement stamp has not landed. Both, deliberately: the stamp can only
 *  trail the instant, and neither alone survives a re-windowed gameweek. */
async function votingWindowOpen(
  ctx: MutationCtx | QueryCtx,
  gameweek: Doc<"fantasyGameweeks">,
  now: number,
): Promise<boolean> {
  if (now >= gameweek.finalityAt) return false;
  const scoring = await gameweekScoringRow(ctx, gameweek._id);
  return scoring?.state !== "final";
}

// ── the appeared pool ──

interface AppearedPlayer {
  playerId: Id<"fantasyPlayers">;
  providerPlayerId: string;
  fixtureId: Id<"fantasyFixtures">;
  leagueId: number;
}

/**
 * Players who APPEARED (minutes > 0 on their current stat revision) in a
 * finished fixture of this gameweek — the spec's voteable population. Built
 * from FW-4's raw stat rows, which exist from the first post-fixture ingest.
 */
async function appearedPlayers(
  ctx: MutationCtx | QueryCtx,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<AppearedPlayer[]> {
  const fixtures = await ctx.db
    .query("fantasyFixtures")
    .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweekId))
    .collect();
  const finished = new Map<string, Doc<"fantasyFixtures">>();
  for (const fixture of fixtures) {
    if (fixture.status === "finished") finished.set(fixture._id, fixture);
  }
  if (finished.size === 0) return [];

  const statRows = await ctx.db
    .query("fantasyFixtureStats")
    .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweekId))
    .collect();

  // Highest revision per (fixture, player) is current.
  const currentByKey = new Map<string, Doc<"fantasyFixtureStats">>();
  for (const row of statRows) {
    const key = `${row.fixtureId}:${row.providerPlayerId}`;
    const seen = currentByKey.get(key);
    if (seen === undefined || row.revision > seen.revision) currentByKey.set(key, row);
  }

  const appeared: AppearedPlayer[] = [];
  for (const row of currentByKey.values()) {
    if (row.playerId === undefined) continue;
    if (row.stats.minutes <= 0) continue;
    const fixture = finished.get(row.fixtureId);
    if (fixture === undefined) continue;
    appeared.push({
      playerId: row.playerId,
      providerPlayerId: row.providerPlayerId,
      fixtureId: row.fixtureId,
      leagueId: fixture.leagueId,
    });
  }
  return appeared;
}

/** Every player in any of the user's squads this gameweek — budget or crew.
 *  Conflict exclusion is enforced at serve time (LOCKED). */
async function conflictedPlayerIds(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<Set<string>> {
  const squads = await ctx.db
    .query("fantasySquads")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const conflicted = new Set<string>();
  for (const squad of squads) {
    if (squad.gameweekId !== gameweekId) continue;
    const slots = await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
      .collect();
    for (const slot of slots) {
      if (slot.playerId !== undefined) conflicted.add(slot.playerId);
    }
  }
  return conflicted;
}

// ── serving ──

export type ServeResult =
  | { status: "closed" }
  | { status: "cap_reached"; served: number; cap: number }
  | { status: "exhausted"; served: number; cap: number }
  | {
      status: "served";
      pairId: Id<"fantasyCrowdPairs">;
      served: number;
      cap: number;
      players: [ServedPlayer, ServedPlayer];
    };

export interface ServedPlayer {
  playerId: Id<"fantasyPlayers">;
  name: string;
  clubId: string;
  position: "GK" | "DEF" | "MID" | "ATT";
  fixture: {
    homeClubId: string;
    awayClubId: string;
    homeGoals: number | null;
    awayGoals: number | null;
  };
}

/**
 * Serve the caller's next pair (the core — fantasyCrowdSim drives this
 * without a session, same seam as fantasySquads' `…For` functions).
 *
 * Pair-serving per spec §Pair-serving: same-fixture by default, same-league
 * same-gameweek as fallback, never cross-league; probability weights toward
 * under-voted players; conflicts excluded at serve time; one serve per pair
 * per user, ever.
 */
export async function servePairFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  gameweek: Doc<"fantasyGameweeks">,
  now: number,
): Promise<ServeResult> {
  if (!(await votingWindowOpen(ctx, gameweek, now))) return { status: "closed" };

  const priorPairs = await ctx.db
    .query("fantasyCrowdPairs")
    .withIndex("by_user_gameweek", (q) =>
      q.eq("userId", userId).eq("gameweekId", gameweek._id),
    )
    .collect();
  if (priorPairs.length >= CROWD_SERVE_CAP_PER_GAMEWEEK) {
    return {
      status: "cap_reached",
      served: priorPairs.length,
      cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
    };
  }
  const servedKeys = new Set(priorPairs.map((p) => p.pairKey));

  const appeared = await appearedPlayers(ctx, gameweek._id);
  const conflicted = await conflictedPlayerIds(ctx, userId, gameweek._id);
  const eligible = appeared.filter((p) => !conflicted.has(p.playerId));
  if (eligible.length < 2) {
    return { status: "exhausted", served: priorPairs.length, cap: CROWD_SERVE_CAP_PER_GAMEWEEK };
  }

  const ratings = await ctx.db
    .query("fantasyCrowdRatings")
    .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
    .collect();
  const votesByPlayer = new Map(ratings.map((r) => [r.playerId as string, r.voteCount]));
  const votesOf = (p: AppearedPlayer) => votesByPlayer.get(p.playerId) ?? 0;

  // Liquidity targeting: least-voted first; random jitter breaks ties so the
  // same under-voted head is not hammered in lockstep by every voter.
  const byLiquidity = [...eligible].sort(
    (a, b) => votesOf(a) - votesOf(b) || Math.random() - 0.5,
  );

  for (const target of byLiquidity) {
    // Same fixture first, then same league — never cross-league (LOCKED).
    const sameFixture = byLiquidity.filter(
      (p) => p.fixtureId === target.fixtureId && p.playerId !== target.playerId,
    );
    const sameLeague = byLiquidity.filter(
      (p) => p.fixtureId !== target.fixtureId && p.leagueId === target.leagueId,
    );
    for (const partner of [...sameFixture, ...sameLeague]) {
      const pairKey = pairKeyOf(target.playerId, partner.playerId);
      if (servedKeys.has(pairKey)) continue;

      const pairId = await ctx.db.insert("fantasyCrowdPairs", {
        gameweekId: gameweek._id,
        userId,
        playerAId: target.playerId,
        playerBId: partner.playerId,
        fixtureAId: target.fixtureId,
        fixtureBId: partner.fixtureId,
        pairKey,
        servedAt: now,
        status: "served",
      });
      const players = await Promise.all(
        [target, partner].map(async (p): Promise<ServedPlayer> => {
          const doc = await ctx.db.get(p.playerId);
          const fixture = await ctx.db.get(p.fixtureId);
          return {
            playerId: p.playerId,
            name: doc?.name ?? "…",
            clubId: doc?.clubId ?? "",
            position: doc?.feedPosition ?? "MID",
            fixture: {
              homeClubId: fixture?.homeClubId ?? "",
              awayClubId: fixture?.awayClubId ?? "",
              homeGoals: fixture?.homeGoals ?? null,
              awayGoals: fixture?.awayGoals ?? null,
            },
          };
        }),
      );
      return {
        status: "served",
        pairId,
        served: priorPairs.length + 1,
        cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
        players: [players[0], players[1]],
      };
    }
  }

  return { status: "exhausted", served: priorPairs.length, cap: CROWD_SERVE_CAP_PER_GAMEWEEK };
}

export const servePair = mutation({
  args: {},
  handler: async (ctx): Promise<ServeResult> => {
    const userId = await requireUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return { status: "closed" };
    return servePairFor(ctx, userId, gameweek, Date.now());
  },
});

// ── voting ──

export async function castVoteFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  pairId: Id<"fantasyCrowdPairs">,
  choice: "a" | "b" | "skip",
  now: number,
): Promise<{ ok: true }> {
  const pair = await ctx.db.get(pairId);
  if (pair === null || pair.userId !== userId) throw new Error(PAIR_NOT_FOUND);
  if (pair.status !== "served") throw new Error(PAIR_ALREADY_USED);

  const gameweek = await ctx.db.get(pair.gameweekId);
  if (gameweek === null) throw new Error(PAIR_NOT_FOUND);
  if (!(await votingWindowOpen(ctx, gameweek, now))) throw new Error(VOTING_CLOSED);

  if (choice === "skip") {
    // "Didn't watch" — costless, no update, no penalty (LOCKED).
    await ctx.db.patch(pair._id, { status: "skipped", votedAt: now });
    return { ok: true };
  }

  const ratingRowOf = async (
    playerId: Id<"fantasyPlayers">,
  ): Promise<Doc<"fantasyCrowdRatings">> => {
    const existing = await ctx.db
      .query("fantasyCrowdRatings")
      .withIndex("by_gameweek_player", (q) =>
        q.eq("gameweekId", pair.gameweekId).eq("playerId", playerId),
      )
      .first();
    if (existing !== null) return existing;
    const player = await ctx.db.get(playerId);
    const rowId = await ctx.db.insert("fantasyCrowdRatings", {
      gameweekId: pair.gameweekId,
      playerId,
      providerPlayerId: player?.providerPlayerId ?? "",
      rating: CROWD_ELO_START,
      voteCount: 0,
    });
    const row = await ctx.db.get(rowId);
    if (row === null) throw new Error("rating row vanished mid-transaction");
    return row;
  };

  const rowA = await ratingRowOf(pair.playerAId);
  const rowB = await ratingRowOf(pair.playerBId);
  const next = eloUpdate(rowA.rating, rowB.rating, choice === "a");
  await ctx.db.patch(rowA._id, { rating: next.a, voteCount: rowA.voteCount + 1 });
  await ctx.db.patch(rowB._id, { rating: next.b, voteCount: rowB.voteCount + 1 });
  await ctx.db.patch(pair._id, { status: "voted", choice, votedAt: now });
  return { ok: true };
}

export const castVote = mutation({
  args: {
    pairId: v.id("fantasyCrowdPairs"),
    choice: v.union(v.literal("a"), v.literal("b"), v.literal("skip")),
  },
  handler: async (ctx, { pairId, choice }) => {
    const userId = await requireUserId(ctx);
    return castVoteFor(ctx, userId, pairId, choice, Date.now());
  },
});

// ── status read ──

export const getVotingStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return null;
    const open = await votingWindowOpen(ctx, gameweek, Date.now());
    let served = 0;
    let voted = 0;
    if (userId !== null) {
      const pairs = await ctx.db
        .query("fantasyCrowdPairs")
        .withIndex("by_user_gameweek", (q) =>
          q.eq("userId", userId).eq("gameweekId", gameweek._id),
        )
        .collect();
      served = pairs.length;
      voted = pairs.filter((p) => p.status === "voted").length;
    }
    return {
      gameweekId: gameweek._id,
      gwNumber: gameweek.gwNumber,
      finalityAt: gameweek.finalityAt,
      open,
      served,
      voted,
      cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
    };
  },
});

// ── factor application (the pipeline hook) ──

export interface ApplyCrowdFactorsResult {
  eligible: boolean;
  reason: string | null;
  written: number;
  unchanged: number;
  insufficient: number;
  done: boolean;
}

const APPLY_CHUNK = 100;

/**
 * Derive the frozen crowd factors and land them as NEW score versions.
 *
 * Called by the settlement driver AFTER the cut and BEFORE finalization, so
 * the rows the finalizer flips already carry their factors. Refuses before
 * finality (the ratings are not frozen yet) and on a settled gameweek
 * (immune, twice over: the early return here and the per-row final-state
 * guard below). Idempotent: a factor equal to the current row's writes
 * nothing, so re-runs converge to zero writes.
 *
 * Chunked like finalizeGameweekChunk: at most APPLY_CHUNK versions per
 * transaction; the driver loops until `done`.
 */
export const applyCrowdFactorsForGameweek = internalMutation({
  args: { gameweekId: v.id("fantasyGameweeks"), now: v.optional(v.number()) },
  handler: async (ctx, args): Promise<ApplyCrowdFactorsResult> => {
    const now = args.now ?? Date.now();
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) throw new Error("Gameweek not found.");

    const scoring = await gameweekScoringRow(ctx, gameweek._id);
    if (scoring?.state === "final") {
      return {
        eligible: false,
        reason: "settled gameweek immune",
        written: 0,
        unchanged: 0,
        insufficient: 0,
        done: true,
      };
    }
    if (now < gameweek.finalityAt) {
      return {
        eligible: false,
        reason: "before finality — ratings are not frozen yet",
        written: 0,
        unchanged: 0,
        insufficient: 0,
        done: true,
      };
    }

    const ratings = await ctx.db
      .query("fantasyCrowdRatings")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
      .collect();
    if (ratings.length === 0) {
      return { eligible: true, reason: null, written: 0, unchanged: 0, insufficient: 0, done: true };
    }

    // The percentile population needs every liquid player's verdict, so the
    // whole derivation recomputes each chunk — it is pure arithmetic; only
    // the WRITES are chunked.
    const entries: CrowdRatingEntry[] = [];
    const rowByPlayer = new Map<string, Doc<"fantasyPlayerScores">>();
    for (const rating of ratings) {
      const row = await currentScoreRow(ctx, gameweek._id, rating.providerPlayerId);
      if (row === null || row.verdictPosition === null) continue;
      rowByPlayer.set(rating.providerPlayerId, row);
      entries.push({
        playerId: rating.providerPlayerId,
        verdictPosition: row.verdictPosition,
        rating: rating.rating,
        voteCount: rating.voteCount,
      });
    }

    const results = deriveCrowdFactors(entries);
    let written = 0;
    let unchanged = 0;
    let insufficient = 0;
    for (const result of results) {
      if (result.insufficientVotes) insufficient += 1;
      const current = rowByPlayer.get(result.playerId);
      if (current === undefined) continue;
      if (current.crowdFactor === result.factor) {
        unchanged += 1;
        continue;
      }
      if (current.state === "final") {
        // Settled numbers are immune even row by row — a partially finalized
        // gameweek must never half-apply a crowd.
        continue;
      }
      if (written >= APPLY_CHUNK) {
        return { eligible: true, reason: null, written, unchanged, insufficient, done: false };
      }

      // The safety net, exercised on every write (R5 / STANDING RULE 6).
      assertCrowdFactorInBand(result.factor, `player ${result.playerId}`);

      const version = current.version + 1;
      await ctx.db.insert("fantasyPlayerScores", {
        gameweekId: current.gameweekId,
        fixtureId: current.fixtureId,
        providerPlayerId: current.providerPlayerId,
        ...(current.playerId === undefined ? {} : { playerId: current.playerId }),
        version,
        state: "provisional",
        baseScores: current.baseScores,
        crowdFactor: result.factor,
        verdictPosition: current.verdictPosition,
        statHash: current.statHash,
        rawRevision: current.rawRevision,
        revisedFrom: current.version,
        specVersion: current.specVersion,
        scoredAt: now,
      });
      await ctx.db.patch(current._id, { supersededByVersion: version });
      written += 1;
    }

    return { eligible: true, reason: null, written, unchanged, insufficient, done: true };
  },
});

// ── rater accuracy (the sealed second game) ──

export interface RaterAccuracyResult {
  eligible: boolean;
  reason: string | null;
  usersScored: number;
  done: boolean;
}

const RATER_CHUNK = 200;

/**
 * Score every user's votes against the frozen consensus, once, after the
 * gameweek settles. Ties have no majority and score nobody. One row per
 * (user, gameweek), written once — re-runs skip scored users, so the pass is
 * idempotent and chunk-safe.
 */
export const scoreRaterAccuracy = internalMutation({
  args: { gameweekId: v.id("fantasyGameweeks"), now: v.optional(v.number()) },
  handler: async (ctx, args): Promise<RaterAccuracyResult> => {
    const now = args.now ?? Date.now();
    const scoring = await gameweekScoringRow(ctx, args.gameweekId);
    if (scoring?.state !== "final") {
      return {
        eligible: false,
        reason: "consensus is frozen only after settlement",
        usersScored: 0,
        done: true,
      };
    }

    const votedPairs = await ctx.db
      .query("fantasyCrowdPairs")
      .withIndex("by_gameweek_status", (q) =>
        q.eq("gameweekId", args.gameweekId).eq("status", "voted"),
      )
      .collect();
    if (votedPairs.length === 0) {
      return { eligible: true, reason: null, usersScored: 0, done: true };
    }

    // Tally in the CANONICAL direction, not the served one: two users can be
    // dealt the same pair with A and B swapped, so "a" is meaningless across
    // rows. The winner's playerId is orientation-free; "low" is the side
    // whose id leads the canonical pairKey.
    const winnerOf = (pair: Doc<"fantasyCrowdPairs">): string =>
      pair.choice === "a" ? pair.playerAId : pair.playerBId;
    const lowOf = (pair: Doc<"fantasyCrowdPairs">): string =>
      pair.playerAId < pair.playerBId ? pair.playerAId : pair.playerBId;
    const tallies = new Map<string, { a: number; b: number }>();
    for (const pair of votedPairs) {
      const tally = tallies.get(pair.pairKey) ?? { a: 0, b: 0 };
      if (winnerOf(pair) === lowOf(pair)) tally.a += 1;
      else tally.b += 1;
      tallies.set(pair.pairKey, tally);
    }

    const byUser = new Map<string, Doc<"fantasyCrowdPairs">[]>();
    for (const pair of votedPairs) {
      const list = byUser.get(pair.userId) ?? [];
      list.push(pair);
      byUser.set(pair.userId, list);
    }

    let usersScored = 0;
    for (const [userIdRaw, pairs] of byUser) {
      const userId = userIdRaw as Id<"users">;
      const existing = await ctx.db
        .query("fantasyCrowdRaterStats")
        .withIndex("by_gameweek_user", (q) =>
          q.eq("gameweekId", args.gameweekId).eq("userId", userId),
        )
        .first();
      if (existing !== null) continue;
      if (usersScored >= RATER_CHUNK) {
        return { eligible: true, reason: null, usersScored, done: false };
      }

      let scoredVotes = 0;
      let accurateVotes = 0;
      for (const pair of pairs) {
        const tally = tallies.get(pair.pairKey);
        // "a" = the canonical low side won; compare directions, not letters.
        const consensus = tally === undefined ? null : consensusOf(tally.a, tally.b);
        if (consensus === null) continue; // a tie convicts nobody
        scoredVotes += 1;
        const votedLow = winnerOf(pair) === lowOf(pair);
        if (votedLow === (consensus === "a")) accurateVotes += 1;
      }
      await ctx.db.insert("fantasyCrowdRaterStats", {
        userId,
        gameweekId: args.gameweekId,
        scoredVotes,
        accurateVotes,
        scoredAt: now,
      });
      usersScored += 1;
    }

    return { eligible: true, reason: null, usersScored, done: true };
  },
});

/** Rolling accuracy across all settled gameweeks — the court's trust input. */
export async function raterAccuracyOf(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<{ scoredVotes: number; accurateVotes: number }> {
  const rows = await ctx.db
    .query("fantasyCrowdRaterStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let scoredVotes = 0;
  let accurateVotes = 0;
  for (const row of rows) {
    scoredVotes += row.scoredVotes;
    accurateVotes += row.accurateVotes;
  }
  return { scoredVotes, accurateVotes };
}

/** Per-player crowd liquidity for a gameweek, for read surfaces that must
 *  say "insufficient votes" rather than nothing (spec §Rating math). */
export async function crowdVotesFor(
  ctx: QueryCtx | MutationCtx,
  gameweekId: Id<"fantasyGameweeks">,
  playerId: Id<"fantasyPlayers">,
): Promise<number> {
  const row = await ctx.db
    .query("fantasyCrowdRatings")
    .withIndex("by_gameweek_player", (q) =>
      q.eq("gameweekId", gameweekId).eq("playerId", playerId),
    )
    .first();
  return row?.voteCount ?? 0;
}

export { CROWD_LIQUIDITY_THRESHOLD };
