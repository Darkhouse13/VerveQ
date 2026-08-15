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
  CROWD_SESSION_GOAL,
  consensusOf,
  consensusRevealOf,
  deriveCrowdFactors,
  eligibleForSelection,
  eloUpdate,
  pairKeyOf,
  selectionAfterCascade,
  serveCardContextOf,
  serveGateOf,
  todayStartOf,
  todaysTenOf,
  unseenFixturesOf,
  type ConsensusReveal,
  type CrowdRatingEntry,
  type ServeCardContext,
  type TodaysTenProgress,
  type UnseenSide,
} from "./lib/fantasyCrowd";
import { assertCrowdFactorInBand } from "./lib/fantasyScorePipeline";
import { clubLabel } from "./fantasyPlayerCard";
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
  /** The current stat revision — the served card's memory (minutes, factual
   *  events, appeared-for club) rides on it (EYE-TEST-CONTEXT). */
  statRow: Doc<"fantasyFixtureStats">;
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
      statRow: row,
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

// ── the fixture picker (EYE-TEST-TEN) ──

/** The user's picker row for a gameweek, or null if never asked. */
async function watchedRowOf(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<Doc<"fantasyCrowdWatched"> | null> {
  return await ctx.db
    .query("fantasyCrowdWatched")
    .withIndex("by_user_gameweek", (q) =>
      q.eq("userId", userId).eq("gameweekId", gameweekId),
    )
    .first();
}

/**
 * Record which games the user says he caught. Ids are validated against THIS
 * gameweek's fixtures and deduped — a fixture from another gameweek (or a
 * fabricated id) is dropped rather than stored, so the selection can never
 * widen the voteable population beyond what serving would allow anyway.
 *
 * An empty list is accepted and stored: "didn't watch anything this weekend"
 * is an answer, and the row's existence is what distinguishes it from never
 * having been asked.
 *
 * A fixture already retired by a didn't-see is dropped too. That is what makes
 * "never serves them a pair from an unseen fixture again" hold for the whole
 * gameweek rather than until the next save: the voter has already answered for
 * that game, and the re-edit exists for games he never spoke about.
 */
export async function setWatchedFixturesFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  gameweek: Doc<"fantasyGameweeks">,
  fixtureIds: readonly Id<"fantasyFixtures">[],
  now: number,
): Promise<{ selected: Id<"fantasyFixtures">[]; unseen: Id<"fantasyFixtures">[] }> {
  const gameweekFixtures = await ctx.db
    .query("fantasyFixtures")
    .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
    .collect();
  const known = new Set<string>(gameweekFixtures.map((f) => f._id));
  const existing = await watchedRowOf(ctx, userId, gameweek._id);
  const unseen = existing?.unseenFixtureIds ?? [];

  const requested: Id<"fantasyFixtures">[] = [];
  const seen = new Set<string>();
  for (const fixtureId of fixtureIds) {
    if (!known.has(fixtureId) || seen.has(fixtureId)) continue;
    seen.add(fixtureId);
    requested.push(fixtureId);
  }
  const selected = selectionAfterCascade(requested, unseen) as Id<"fantasyFixtures">[];

  if (existing === null) {
    await ctx.db.insert("fantasyCrowdWatched", {
      userId,
      gameweekId: gameweek._id,
      fixtureIds: selected,
      updatedAt: now,
    });
  } else {
    await ctx.db.patch(existing._id, { fixtureIds: selected, updatedAt: now });
  }
  return { selected, unseen: [...unseen] };
}

export const setWatchedFixtures = mutation({
  args: { fixtureIds: v.array(v.id("fantasyFixtures")) },
  handler: async (ctx, { fixtureIds }) => {
    const userId = await requireUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) throw new Error(VOTING_CLOSED);
    return setWatchedFixturesFor(ctx, userId, gameweek, fixtureIds, Date.now());
  },
});

/** The picker's current answer, for the "+ add games" re-edit. Null selection
 *  = never asked; an empty array = answered "nothing". */
export const getWatchedFixtures = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return null;
    // One shape from both branches: a signed-out caller has never been asked
    // and has retired nothing.
    if (userId === null) {
      return { gameweekId: gameweek._id, selected: null, unseen: [] };
    }
    const row = await watchedRowOf(ctx, userId, gameweek._id);
    return {
      gameweekId: gameweek._id,
      selected: row === null ? null : row.fixtureIds,
      /** Retired by a didn't-see — the picker shows these as answered-for
       *  rather than as unpicked, so a tap that would do nothing isn't
       *  offered. */
      unseen: row?.unseenFixtureIds ?? [],
    };
  },
});

// ── serving ──

export type ServeResult =
  | { status: "closed" }
  /** EYE-TEST-TEN: the picker has never been answered for this gameweek —
   *  the session's first screen, not an error. */
  | { status: "needs_picker" }
  /** Answered, but nothing is selected — either "didn't watch anything" or
   *  every picked game has since been retired by a didn't-see. */
  | { status: "no_fixtures" }
  | { status: "cap_reached"; served: number; cap: number; progress: TodaysTenProgress }
  | { status: "exhausted"; served: number; cap: number; progress: TodaysTenProgress }
  | {
      status: "served";
      pairId: Id<"fantasyCrowdPairs">;
      served: number;
      cap: number;
      progress: TodaysTenProgress;
      players: [ServedPlayer, ServedPlayer];
    };

/** One served card: identity plus the card's memory (EYE-TEST-CONTEXT).
 *  The context fields — appeared-for club, opponent, venue, fixture line,
 *  minutes, factual events — come from lib/fantasyCrowd.serveCardContextOf;
 *  everything on it is a stored fact of fantasyFixtures / the current
 *  fantasyFixtureStats revision. Nothing evaluative, by ruling. */
export interface ServedPlayer extends ServeCardContext {
  playerId: Id<"fantasyPlayers">;
  /** EYE-TEST-TEN: which game this card's memory belongs to. The surface
   *  compares the two sides' ids to decide whether ONE combined didn't-see
   *  button is honest, and sends it back so the cascade retires the right
   *  fixture. */
  fixtureId: Id<"fantasyFixtures">;
  name: string;
  position: "GK" | "DEF" | "MID" | "ATT";
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
  clientDayStart?: number | null,
): Promise<ServeResult> {
  if (!(await votingWindowOpen(ctx, gameweek, now))) return { status: "closed" };

  // The picker gates serving BEFORE any pair is chosen or inserted: a voter
  // who has not answered it gets the first screen, never a pair he then has
  // to skip. Both gate exits are pre-insert, so neither burns a pair or a
  // serve-cap slot.
  const watched = await watchedRowOf(ctx, userId, gameweek._id);
  const gate = serveGateOf(watched?.fixtureIds ?? null);
  if (gate.kind === "needs_picker") return { status: "needs_picker" };
  if (gate.kind === "no_fixtures") return { status: "no_fixtures" };

  const priorPairs = await ctx.db
    .query("fantasyCrowdPairs")
    .withIndex("by_user_gameweek", (q) =>
      q.eq("userId", userId).eq("gameweekId", gameweek._id),
    )
    .collect();
  const progress = todaysTenOf(
    priorPairs.filter((p) => p.status === "voted").map((p) => p.votedAt),
    todayStartOf(now, clientDayStart),
  );
  if (priorPairs.length >= CROWD_SERVE_CAP_PER_GAMEWEEK) {
    return {
      status: "cap_reached",
      served: priorPairs.length,
      cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
      progress,
    };
  }
  const servedKeys = new Set(priorPairs.map((p) => p.pairKey));

  const appeared = await appearedPlayers(ctx, gameweek._id);
  const conflicted = await conflictedPlayerIds(ctx, userId, gameweek._id);
  const eligible = eligibleForSelection(appeared, gate.fixtureIds, conflicted);
  if (eligible.length < 2) {
    return {
      status: "exhausted",
      served: priorPairs.length,
      cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
      progress,
    };
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
      const sides = [target, partner];
      const docs = await Promise.all(
        sides.map(async (p) => ({
          player: await ctx.db.get(p.playerId),
          fixture: await ctx.db.get(p.fixtureId),
        })),
      );
      // Club labels for both sides of both fixtures via the bounded
      // pool-meta walk (getWeekendFixtures precedent) — at most four clubs
      // per serve, and a same-fixture pair shares its two.
      const clubNames = new Map<string, string>();
      for (const { fixture } of docs) {
        for (const clubId of [fixture?.homeClubId, fixture?.awayClubId]) {
          if (clubId === undefined || clubNames.has(clubId)) continue;
          const label = await clubLabel(ctx, clubId);
          if (label !== null) clubNames.set(clubId, label);
        }
      }
      const players = sides.map((p, i): ServedPlayer => {
        const doc = docs[i].player;
        const fixture = docs[i].fixture;
        return {
          playerId: p.playerId,
          fixtureId: p.fixtureId,
          name: doc?.name ?? "…",
          position: doc?.feedPosition ?? "MID",
          ...serveCardContextOf({
            appearedClubId: p.statRow.clubId,
            stats: p.statRow.stats,
            fixture: {
              leagueId: fixture?.leagueId ?? p.leagueId,
              kickoffAt: fixture?.kickoffAt ?? 0,
              homeClubId: fixture?.homeClubId ?? "",
              awayClubId: fixture?.awayClubId ?? "",
              homeGoals: fixture?.homeGoals ?? null,
              awayGoals: fixture?.awayGoals ?? null,
            },
            clubNames,
          }),
        };
      });
      return {
        status: "served",
        pairId,
        served: priorPairs.length + 1,
        cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
        progress,
        players: [players[0], players[1]],
      };
    }
  }

  return {
    status: "exhausted",
    served: priorPairs.length,
    cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
    progress,
  };
}

export const servePair = mutation({
  args: {
    /** The client's local midnight, so Today's Ten rolls over at the voter's
     *  midnight. Clamped server-side (lib/fantasyCrowd.todayStartOf). */
    dayStartAt: v.optional(v.number()),
  },
  handler: async (ctx, { dayStartAt }): Promise<ServeResult> => {
    const userId = await requireUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return { status: "closed" };
    return servePairFor(ctx, userId, gameweek, Date.now(), dayStartAt);
  },
});

// ── voting ──

/**
 * The tap. "a" | "b" is a judgment; the rest are didn't-sees.
 *
 * `unseen_a` / `unseen_b` are the per-card "didn't see him" — a pair can span
 * two fixtures, so one card's answer must not retire the other's game.
 * `skip` is the combined button, offered only when both cards share a
 * fixture, and remains the wire name a pre-EYE-TEST-TEN client sends.
 */
export type VoteChoice = "a" | "b" | "unseen_a" | "unseen_b" | "skip";

export interface CastVoteResult {
  ok: true;
  /** Post-vote only. A didn't-see gets NO reveal — it is not a vote, and
   *  paying it with a crowd number would make not-watching worth farming. */
  reveal: ConsensusReveal | null;
  progress: TodaysTenProgress;
}

const UNSEEN_SIDE: Record<"unseen_a" | "unseen_b" | "skip", UnseenSide> = {
  unseen_a: "a",
  unseen_b: "b",
  skip: "both",
};

/** Today's Ten for a user, from their answered pairs. */
async function progressFor(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
  gameweekId: Id<"fantasyGameweeks">,
  now: number,
  clientDayStart?: number | null,
): Promise<TodaysTenProgress> {
  const pairs = await ctx.db
    .query("fantasyCrowdPairs")
    .withIndex("by_user_gameweek", (q) =>
      q.eq("userId", userId).eq("gameweekId", gameweekId),
    )
    .collect();
  return todaysTenOf(
    pairs.filter((p) => p.status === "voted").map((p) => p.votedAt),
    todayStartOf(now, clientDayStart),
  );
}

/**
 * The reveal for the pair the caller just voted on.
 *
 * Counted from the stored pairs themselves (by_gameweek_pairKey_status),
 * in the CANONICAL direction — two users can be dealt the same pair with A
 * and B swapped, so "a" is meaningless across rows; the winner's playerId is
 * not. Same orientation rule scoreRaterAccuracy uses, so the number a voter
 * sees live and the frozen consensus he is scored against are the same
 * quantity read at two different times.
 */
async function revealFor(
  ctx: MutationCtx,
  pair: Doc<"fantasyCrowdPairs">,
  callerWinnerId: Id<"fantasyPlayers">,
): Promise<ConsensusReveal> {
  const voted = await ctx.db
    .query("fantasyCrowdPairs")
    .withIndex("by_gameweek_pairKey_status", (q) =>
      q.eq("gameweekId", pair.gameweekId).eq("pairKey", pair.pairKey).eq("status", "voted"),
    )
    .collect();
  let withYou = 0;
  for (const row of voted) {
    const winnerId = row.choice === "a" ? row.playerAId : row.playerBId;
    if (winnerId === callerWinnerId) withYou += 1;
  }
  return consensusRevealOf(withYou, voted.length);
}

export async function castVoteFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  pairId: Id<"fantasyCrowdPairs">,
  choice: VoteChoice,
  now: number,
  clientDayStart?: number | null,
): Promise<CastVoteResult> {
  const pair = await ctx.db.get(pairId);
  if (pair === null || pair.userId !== userId) throw new Error(PAIR_NOT_FOUND);
  // Single-use, checked BEFORE anything is written or read back to the
  // caller: a pair already answered cannot be re-answered, which is also what
  // stops a voter re-requesting a reveal for a pair whose crowd has since
  // moved.
  if (pair.status !== "served") throw new Error(PAIR_ALREADY_USED);

  const gameweek = await ctx.db.get(pair.gameweekId);
  if (gameweek === null) throw new Error(PAIR_NOT_FOUND);
  if (!(await votingWindowOpen(ctx, gameweek, now))) throw new Error(VOTING_CLOSED);

  if (choice !== "a" && choice !== "b") {
    // A didn't-see — costless, no Elo update, no penalty (LOCKED). This
    // branch returns before any rating row is touched, which is where "carries
    // no weight in the crowd factor" is enforced rather than merely intended:
    // deriveCrowdFactors reads fantasyCrowdRatings, and nothing here writes
    // one. scoreRaterAccuracy is likewise blind to it (status "voted" only).
    const side = UNSEEN_SIDE[choice];
    await ctx.db.patch(pair._id, { status: "skipped", unseen: side, votedAt: now });

    // The cascade: retire the fixture(s) he says he didn't see from his
    // picker selection, so every REMAINING pair drawn from that game is
    // excluded for the rest of the gameweek — not just this one.
    const retired = unseenFixturesOf(side, pair.fixtureAId, pair.fixtureBId);
    const watched = await watchedRowOf(ctx, userId, pair.gameweekId);
    if (watched !== null) {
      const nextSelected = selectionAfterCascade(watched.fixtureIds, retired);
      // Remembered separately, so a later "+ add games" save cannot resurrect
      // a game he has already answered for (the "never again" half of the
      // cascade rule).
      const nextUnseen = [
        ...new Set([...(watched.unseenFixtureIds ?? []), ...retired]),
      ] as Id<"fantasyFixtures">[];
      await ctx.db.patch(watched._id, {
        fixtureIds: nextSelected as Id<"fantasyFixtures">[],
        unseenFixtureIds: nextUnseen,
        updatedAt: now,
      });
    }
    return {
      ok: true,
      reveal: null,
      progress: await progressFor(ctx, userId, pair.gameweekId, now, clientDayStart),
    };
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

  // Read the tally AFTER the write, so the caller is inside his own crowd —
  // "68% went with you" counts the vote he just cast.
  const reveal = await revealFor(ctx, pair, choice === "a" ? pair.playerAId : pair.playerBId);
  return {
    ok: true as const,
    reveal,
    progress: await progressFor(ctx, userId, pair.gameweekId, now, clientDayStart),
  };
}

export const castVote = mutation({
  args: {
    pairId: v.id("fantasyCrowdPairs"),
    choice: v.union(
      v.literal("a"),
      v.literal("b"),
      v.literal("unseen_a"),
      v.literal("unseen_b"),
      v.literal("skip"),
    ),
    dayStartAt: v.optional(v.number()),
  },
  handler: async (ctx, { pairId, choice, dayStartAt }): Promise<CastVoteResult> => {
    const userId = await requireUserId(ctx);
    return castVoteFor(ctx, userId, pairId, choice, Date.now(), dayStartAt);
  },
});

// ── status read ──

export const getVotingStatus = query({
  args: { dayStartAt: v.optional(v.number()) },
  handler: async (ctx, { dayStartAt }) => {
    const userId = await getAuthUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return null;
    const now = Date.now();
    const open = await votingWindowOpen(ctx, gameweek, now);
    let served = 0;
    let voted = 0;
    let progress = todaysTenOf([], todayStartOf(now, dayStartAt));
    let pickerAnswered = false;
    if (userId !== null) {
      const pairs = await ctx.db
        .query("fantasyCrowdPairs")
        .withIndex("by_user_gameweek", (q) =>
          q.eq("userId", userId).eq("gameweekId", gameweek._id),
        )
        .collect();
      served = pairs.length;
      voted = pairs.filter((p) => p.status === "voted").length;
      progress = todaysTenOf(
        pairs.filter((p) => p.status === "voted").map((p) => p.votedAt),
        todayStartOf(now, dayStartAt),
      );
      pickerAnswered = (await watchedRowOf(ctx, userId, gameweek._id)) !== null;
    }
    return {
      gameweekId: gameweek._id,
      gwNumber: gameweek.gwNumber,
      finalityAt: gameweek.finalityAt,
      open,
      served,
      voted,
      /** The gameweek ceiling, unchanged. The surface no longer counts
       *  toward it (EYE-TEST-TEN) — `progress` is what a session is about. */
      cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
      goal: CROWD_SESSION_GOAL,
      progress,
      pickerAnswered,
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
