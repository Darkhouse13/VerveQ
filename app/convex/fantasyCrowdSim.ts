/**
 * Weekend Fantasy — the crowd-voting DEV walkthrough (FW-LAUNCH O2).
 *
 * The O2 DONE gate, scripted against a SYNTHETIC gameweek through the real
 * paths: votes cast → factor derived in band → score version created →
 * superseded version still readable → settled gameweek immune → purge clean.
 *
 * Same postures as its siblings: internal-only; drives the shipped cores
 * (`servePairFor`, `castVoteFor`) and the shipped internal mutations
 * (`fantasyScoringDev.seedSyntheticFixture`, `fantasyScores.applyFixtureStats`,
 * `fantasyCrowdVoting.applyCrowdFactorsForGameweek`, the real
 * `settleGameweeks` action) — every acceptance and every refusal below is the
 * product's own. Everything it creates is tagged (`simcrowd_*` users, the
 * SYNTH- gameweek) and purged by id.
 *
 * Run:  npx convex run fantasyCrowdSim:simulateCrowdWalkthrough '{"salt":"o2"}'
 *       (purges are the walkthrough's own last phase)
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  CROWD_FACTOR_MAX,
  CROWD_LIQUIDITY_THRESHOLD,
} from "./lib/fantasyCrowd";
import { castVoteFor, servePairFor } from "./fantasyCrowdVoting";
import { VOTING_CLOSED } from "./fantasyCrowdVoting";

const SIM_USERNAME_PREFIX = "simcrowd_";
const SIM_SEASON = "SYNTH-O2-CROWD";
const SIM_GW = 902;
const SIM_FIXTURE = "synth-o2-crowd-1";
const SIM_VOTERS = 5;

function fail(message: string): never {
  throw new Error(`WALKTHROUGH FAILED: ${message}`);
}

const zeroStats = {
  minutes: 90,
  goals: 0,
  assists: 0,
  shotsTotal: 0,
  shotsOn: 0,
  keyPasses: 0,
  passesTotal: 20,
  passesAccurate: 15,
  dribblesAttempted: 0,
  dribblesCompleted: 0,
  tackles: 1,
  interceptions: 1,
  blocks: 0,
  duelsTotal: 4,
  duelsWon: 2,
  foulsCommitted: 0,
  foulsDrawn: 0,
  yellowCards: 0,
  redCards: 0,
  saves: 0,
  penaltiesWon: 0,
  penaltiesConceded: 0,
  penaltiesScored: 0,
  penaltiesMissed: 0,
  penaltiesSaved: 0,
  ownGoals: 0,
  wasSubstitute: false,
};

/** 8 synthetic players: both clubs field one of each position, so every
 *  verdict-position group has exactly 2 members and the derivation's
 *  extremes (±15%) are reachable and predictable. */
const SIM_PLAYERS = (["GK", "DEF", "MID", "ATT"] as const).flatMap((position, i) =>
  (["SYNTH-O2A", "SYNTH-O2B"] as const).map((clubId, j) => ({
    providerPlayerId: `synth-o2c-p${i * 2 + j}`,
    name: `Synth Crowd ${position} ${j}`,
    clubId,
    feedPosition: position,
  })),
);

// ── helper mutations (each its own transaction, driven by the action) ──

export const createSimVoters = internalMutation({
  args: { salt: v.string() },
  handler: async (ctx, { salt }): Promise<Id<"users">[]> => {
    const userIds: Id<"users">[] = [];
    for (let i = 0; i < SIM_VOTERS; i += 1) {
      const username = `${SIM_USERNAME_PREFIX}${salt}_${i}`.slice(0, 24);
      const existing = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first();
      if (existing !== null) fail(`sim user ${username} already exists — purge first.`);
      userIds.push(await ctx.db.insert("users", { username }));
    }
    return userIds;
  },
});

/**
 * Exhaust one voter's stack through the real serve/vote cores. Choice is
 * deterministic and IDENTICAL for every voter — the lower playerId "won" —
 * so ratings order totally, consensus is unanimous, and every rater scores
 * accuracy 1.0. `leaveLastUnvoted` keeps one served pair open, for the
 * after-close rejection probe.
 */
export const castAllPairsFor = internalMutation({
  args: {
    userId: v.id("users"),
    gameweekId: v.id("fantasyGameweeks"),
    leaveLastUnvoted: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ served: number; voted: number; openPairId: string | null }> => {
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) fail("synthetic gameweek missing.");
    const now = Date.now();
    let served = 0;
    let voted = 0;
    let openPairId: Id<"fantasyCrowdPairs"> | null = null;
    for (let guard = 0; guard < 100; guard += 1) {
      const serve = await servePairFor(ctx, args.userId, gameweek, now);
      if (serve.status !== "served") break;
      served += 1;
      if (args.leaveLastUnvoted === true && openPairId === null) {
        // Hold the FIRST pair open (any one will do) and keep dealing.
        openPairId = serve.pairId;
        continue;
      }
      const [a, b] = serve.players;
      await castVoteFor(
        ctx,
        args.userId,
        serve.pairId,
        a.playerId < b.playerId ? "a" : "b",
        now,
      );
      voted += 1;
    }
    return { served, voted, openPairId };
  },
});

export const probeVoteAfterClose = internalMutation({
  args: { userId: v.id("users"), pairId: v.id("fantasyCrowdPairs") },
  handler: async (ctx, args): Promise<string> => {
    try {
      await castVoteFor(ctx, args.userId, args.pairId, "a", Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes(VOTING_CLOSED)) {
        fail(`after-close vote rejected for the wrong reason: ${message}`);
      }
      return message;
    }
    return fail("a vote landed AFTER the voting window closed.");
  },
});

export const simCrowdState = internalQuery({
  args: { gameweekId: v.id("fantasyGameweeks") },
  handler: async (ctx, { gameweekId }) => {
    const ratings = await ctx.db
      .query("fantasyCrowdRatings")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweekId))
      .collect();
    const raterStats = await ctx.db
      .query("fantasyCrowdRaterStats")
      .withIndex("by_gameweek_user", (q) => q.eq("gameweekId", gameweekId))
      .collect();
    let pairs = 0;
    for (const status of ["served", "voted", "skipped"] as const) {
      const rows = await ctx.db
        .query("fantasyCrowdPairs")
        .withIndex("by_gameweek_status", (q) =>
          q.eq("gameweekId", gameweekId).eq("status", status),
        )
        .collect();
      pairs += rows.length;
    }
    return {
      ratings: ratings.map((r) => ({
        providerPlayerId: r.providerPlayerId,
        rating: r.rating,
        voteCount: r.voteCount,
      })),
      raterStats: raterStats.map((r) => ({
        scoredVotes: r.scoredVotes,
        accurateVotes: r.accurateVotes,
      })),
      pairs,
    };
  },
});

export const purgeSimCrowdData = internalMutation({
  args: { gameweekId: v.id("fantasyGameweeks") },
  handler: async (ctx, { gameweekId }) => {
    const gameweek = await ctx.db.get(gameweekId);
    // Re-validated, dropTestPurge-style: crowd rows are deleted only off a
    // synthetic gameweek, and only sim-prefixed users are deleted.
    if (gameweek !== null && !gameweek.season.startsWith("SYNTH-")) {
      throw new Error("purgeSimCrowdData refuses a non-synthetic gameweek.");
    }
    let deleted = 0;
    for (const status of ["served", "voted", "skipped"] as const) {
      const rows = await ctx.db
        .query("fantasyCrowdPairs")
        .withIndex("by_gameweek_status", (q) =>
          q.eq("gameweekId", gameweekId).eq("status", status),
        )
        .collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    const ratings = await ctx.db
      .query("fantasyCrowdRatings")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweekId))
      .collect();
    for (const row of ratings) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    const raterStats = await ctx.db
      .query("fantasyCrowdRaterStats")
      .withIndex("by_gameweek_user", (q) => q.eq("gameweekId", gameweekId))
      .collect();
    for (const row of raterStats) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    let deletedUsers = 0;
    const users = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.gte("username", SIM_USERNAME_PREFIX).lt("username", SIM_USERNAME_PREFIX + "\uffff"),
      )
      .take(100);
    for (const user of users) {
      if (!user.username?.startsWith(SIM_USERNAME_PREFIX)) continue;
      await ctx.db.delete(user._id);
      deletedUsers += 1;
    }
    return { deleted, deletedUsers };
  },
});

// ── the walkthrough ──

export const simulateCrowdWalkthrough = internalAction({
  args: { salt: v.optional(v.string()) },
  handler: async (ctx, { salt }): Promise<Record<string, unknown>> => {
    const tag = (salt ?? "o2").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 8) || "o2";
    const report: Record<string, unknown> = {};
    const now = Date.now();

    // 1 · synthetic gameweek, one finished fixture, 8 appeared players.
    const seeded: { gameweekId: Id<"fantasyGameweeks"> } = await ctx.runMutation(
      internal.fantasyScoringDev.seedSyntheticFixture,
      {
        season: SIM_SEASON,
        gwNumber: SIM_GW,
        finalityAt: now + 60 * 60 * 1000, // voting window open
        providerFixtureId: SIM_FIXTURE,
        kickoffAt: now - 3 * 60 * 60 * 1000,
        homeClubId: "SYNTH-O2A",
        awayClubId: "SYNTH-O2B",
        homeGoals: 2,
        awayGoals: 1,
        players: SIM_PLAYERS,
      },
    );
    const gameweekId = seeded.gameweekId;
    report.seeded = { gameweekId, players: SIM_PLAYERS.length };

    // 2 · score it through the ONLY write path (crowdFactor 0, R5 default).
    await ctx.runMutation(internal.fantasyScores.applyFixtureStats, {
      providerFixtureId: SIM_FIXTURE,
      hasPlayerStats: true,
      hasEvents: true,
      rows: SIM_PLAYERS.map((p) => ({
        providerPlayerId: p.providerPlayerId,
        clubId: p.clubId,
        feedPosition: p.feedPosition,
        stats: zeroStats,
        events: [],
        entryMinute: null,
      })),
    });

    // 3 · five voters exhaust their stacks identically; voter 0 leaves one
    //     pair open for the after-close probe.
    const voters: Id<"users">[] = await ctx.runMutation(
      internal.fantasyCrowdSim.createSimVoters,
      { salt: tag },
    );
    let openPairId: string | null = null;
    let totalVotes = 0;
    for (let i = 0; i < voters.length; i += 1) {
      const round: { served: number; voted: number; openPairId: string | null } =
        await ctx.runMutation(internal.fantasyCrowdSim.castAllPairsFor, {
          userId: voters[i],
          gameweekId,
          ...(i === 0 ? { leaveLastUnvoted: true } : {}),
        });
      totalVotes += round.voted;
      if (round.openPairId !== null) openPairId = round.openPairId;
    }
    report.votesCast = totalVotes;

    // 4 · liquidity check: every player must clear the threshold.
    const state: {
      ratings: { providerPlayerId: string; rating: number; voteCount: number }[];
      raterStats: { scoredVotes: number; accurateVotes: number }[];
      pairs: number;
    } = await ctx.runQuery(internal.fantasyCrowdSim.simCrowdState, { gameweekId });
    if (state.ratings.length !== SIM_PLAYERS.length) {
      fail(`expected ${SIM_PLAYERS.length} rating rows, found ${state.ratings.length}.`);
    }
    for (const rating of state.ratings) {
      if (rating.voteCount < CROWD_LIQUIDITY_THRESHOLD) {
        fail(
          `${rating.providerPlayerId} has ${rating.voteCount} votes < threshold ${CROWD_LIQUIDITY_THRESHOLD} — walkthrough needs more voters.`,
        );
      }
    }
    report.liquidity = `all ${state.ratings.length} players ≥ ${CROWD_LIQUIDITY_THRESHOLD} votes`;

    // 5 · factors refuse to derive BEFORE the cut (not frozen yet).
    const early: { eligible: boolean; reason: string | null } = await ctx.runMutation(
      internal.fantasyCrowdVoting.applyCrowdFactorsForGameweek,
      { gameweekId },
    );
    if (early.eligible) fail("factors derived before finality — ratings were not frozen.");
    report.preFinalityRefused = early.reason;

    // 6 · move the cut into the past; apply the frozen factors.
    await ctx.runMutation(internal.fantasyScoringDev.setSyntheticFinality, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
      finalityAt: Date.now() - 60 * 1000,
    });
    const applied: { written: number; insufficient: number } = await ctx.runMutation(
      internal.fantasyCrowdVoting.applyCrowdFactorsForGameweek,
      { gameweekId },
    );
    if (applied.written !== SIM_PLAYERS.length) {
      fail(
        `expected ${SIM_PLAYERS.length} factor versions (2-player groups pin the extremes), got ${applied.written}.`,
      );
    }
    report.factorVersionsWritten = applied.written;

    // 7 · versions: v2 carries an in-band factor, v1 readable + superseded,
    //     bases and hashes untouched.
    type ScoreRow = {
      providerPlayerId: string;
      version: number;
      crowdFactor: number;
      supersededByVersion: number | null;
      statHash: string;
      baseScores: Doc<"fantasyPlayerScores">["baseScores"];
      state: string;
    };
    const rows: ScoreRow[] = await ctx.runQuery(internal.fantasyScoringDev.syntheticScoreRows, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
    });
    for (const player of SIM_PLAYERS) {
      const mine = rows
        .filter((r) => r.providerPlayerId === player.providerPlayerId)
        .sort((a, b) => a.version - b.version);
      if (mine.length !== 2) fail(`${player.providerPlayerId}: expected 2 versions, got ${mine.length}.`);
      const [v1, v2] = mine;
      if (v1.supersededByVersion !== 2) fail(`${player.providerPlayerId}: v1 not superseded by v2.`);
      if (v1.crowdFactor !== 0) fail(`${player.providerPlayerId}: v1 factor moved.`);
      if (Math.abs(v2.crowdFactor) > CROWD_FACTOR_MAX || v2.crowdFactor === 0) {
        fail(`${player.providerPlayerId}: v2 factor ${v2.crowdFactor} not a non-zero in-band value.`);
      }
      if (v1.statHash !== v2.statHash) fail(`${player.providerPlayerId}: statHash moved on a crowd version.`);
      if (JSON.stringify(v1.baseScores) !== JSON.stringify(v2.baseScores)) {
        fail(`${player.providerPlayerId}: baseScores moved on a crowd version.`);
      }
    }
    report.versions = "v2 in band, v1 superseded + readable, bases/hashes identical";

    // 8 · the window is shut: the held-open pair refuses a vote.
    if (openPairId === null) fail("no open pair was held for the after-close probe.");
    report.afterCloseRejected = await ctx.runMutation(
      internal.fantasyCrowdSim.probeVoteAfterClose,
      { userId: voters[0], pairId: openPairId as Id<"fantasyCrowdPairs"> },
    );

    // 9 · settle through the real driver; then the gameweek is immune.
    await ctx.runAction(internal.fantasyScores.settleGameweeks, {});
    const immune: { eligible: boolean; reason: string | null } = await ctx.runMutation(
      internal.fantasyCrowdVoting.applyCrowdFactorsForGameweek,
      { gameweekId },
    );
    if (immune.eligible) fail("a settled gameweek accepted a factor application.");
    report.settledImmune = immune.reason;
    const rowsAfter: ScoreRow[] = await ctx.runQuery(
      internal.fantasyScoringDev.syntheticScoreRows,
      { season: SIM_SEASON, gwNumber: SIM_GW },
    );
    if (rowsAfter.length !== rows.length) {
      fail(`version count moved after settlement: ${rows.length} → ${rowsAfter.length}.`);
    }

    // 10 · rater accuracy: unanimous voters all score 1.0.
    const settledState: { raterStats: { scoredVotes: number; accurateVotes: number }[] } =
      await ctx.runQuery(internal.fantasyCrowdSim.simCrowdState, { gameweekId });
    if (settledState.raterStats.length !== SIM_VOTERS) {
      fail(`expected ${SIM_VOTERS} rater rows, got ${settledState.raterStats.length}.`);
    }
    for (const rater of settledState.raterStats) {
      if (rater.scoredVotes === 0 || rater.accurateVotes !== rater.scoredVotes) {
        fail(`unanimous voter scored ${rater.accurateVotes}/${rater.scoredVotes} — expected all accurate.`);
      }
    }
    report.raterAccuracy = "5 voters scored, unanimous, all accurate";

    // 11 · purge clean, both layers.
    const crowdPurge = await ctx.runMutation(internal.fantasyCrowdSim.purgeSimCrowdData, {
      gameweekId,
    });
    const synthPurge = await ctx.runMutation(internal.fantasyScoringDev.purgeSynthetic, {
      season: SIM_SEASON,
    });
    report.purged = { crowd: crowdPurge, synthetic: synthPurge };

    report.verdict = "PASS";
    return report;
  },
});
