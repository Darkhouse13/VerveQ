/**
 * Weekend Fantasy — the crowd-voting DEV walkthrough (FW-LAUNCH O2).
 *
 * The O2 DONE gate, scripted against a SYNTHETIC gameweek through the real
 * paths: votes cast → factor derived in band → score version created →
 * superseded version still readable → settled gameweek immune → purge clean.
 * FW-CR2 adds the SECOND-VOTE probe (verify-package O2): a re-ballot on a
 * voted pair, refused server-side by the used-pair check while voting is
 * still open — the walkthrough report carries the refusal verbatim.
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
 *
 * FW-VS1 data contract: pass `"keepData": true` to SKIP the purge phase and
 * leave every row on DEV for independent inspection — the report then names
 * the exact purge commands (also listed here):
 *   npx convex run fantasyCrowdSim:purgeSimCrowdData '{"gameweekId":"<id from the report>"}'
 *   npx convex run fantasyScoringDev:purgeSynthetic '{"season":"SYNTH-O2-CROWD"}'
 * Both are idempotent — a second run deletes zero rows.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  CROWD_FACTOR_MAX,
  CROWD_LIQUIDITY_THRESHOLD,
  CROWD_REVEAL_MIN_VOTES,
  CROWD_UNDO_WINDOW_MS,
} from "./lib/fantasyCrowd";
import {
  castVoteFor,
  servePairFor,
  setWatchedFixturesFor,
  undoUnseenFor,
} from "./fantasyCrowdVoting";
import { PAIR_ALREADY_USED, VOTING_CLOSED } from "./fantasyCrowdVoting";

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

/** EYE-TEST-TEN: the session-rules probe's own voter, tagged like the rest so
 *  the purge sweeps him and his picker row with the others. */
export const createProbeVoter = internalMutation({
  args: { salt: v.string() },
  handler: async (ctx, { salt }): Promise<Id<"users">> => {
    const username = `${SIM_USERNAME_PREFIX}${salt}_p`.slice(0, 24);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (existing !== null) fail(`sim user ${username} already exists — purge first.`);
    return await ctx.db.insert("users", { username });
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
  handler: async (
    ctx,
    args,
  ): Promise<{ served: number; voted: number; openPairId: string | null; votedPairId: string | null }> => {
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) fail("synthetic gameweek missing.");
    const now = Date.now();

    // EYE-TEST-TEN: the fixture picker is the session's first screen, and
    // serving refuses ("needs_picker") until it is answered. The walkthrough
    // answers it through the REAL core — the voter says he caught every
    // synthetic fixture — so the serve loop below exercises the shipped gate
    // rather than a bypass.
    const fixtures = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", args.gameweekId))
      .collect();
    await setWatchedFixturesFor(
      ctx,
      args.userId,
      gameweek,
      fixtures.map((f) => f._id),
      now,
    );

    let served = 0;
    let voted = 0;
    let openPairId: Id<"fantasyCrowdPairs"> | null = null;
    let votedPairId: Id<"fantasyCrowdPairs"> | null = null;
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
      votedPairId = serve.pairId;
    }
    return { served, voted, openPairId, votedPairId };
  },
});

/**
 * FW-CR2 (verify-package O2): the used-pair rejection, exercised server-side.
 * A second ballot on an already-voted pair must refuse with PAIR_ALREADY_USED
 * — the single-use check sits BEFORE the window check and before any rating
 * write, so this probe runs while voting is still open and moves nothing.
 */
export const probeSecondVote = internalMutation({
  args: { userId: v.id("users"), pairId: v.id("fantasyCrowdPairs") },
  handler: async (ctx, args): Promise<string> => {
    try {
      await castVoteFor(ctx, args.userId, args.pairId, "a", Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes(PAIR_ALREADY_USED)) {
        fail(`second vote rejected for the wrong reason: ${message}`);
      }
      return message;
    }
    return fail("a SECOND vote landed on an already-voted pair.");
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

/**
 * EYE-TEST-TEN (verify-package): the session's two new server rules, probed
 * against real stored data by one extra voter.
 *
 *  1. THE REVEAL is an aggregate of the pair's STORED votes across users, read
 *     after the caller's own vote lands — so a voter joining a unanimous crowd
 *     of five reads 100% and counts himself inside it. Nothing is
 *     denormalized: this is the same quantity settlement freezes.
 *  2. THE CASCADE retires a FIXTURE, not a pair. After one "didn't see him"
 *     on the only synthetic fixture, the picker selection is empty, serving
 *     answers `no_fixtures` rather than dealing another pair from it, and a
 *     re-add through the picker is REFUSED — "never again" outlives the save.
 *  3. THE UNDO (EYE-TEST-SERVE) gives back the GAME and not the PAIR: inside
 *     the five-second window the fixture returns to the selection and leaves
 *     the retirement ledger, while the pair stays `skipped` and re-answering
 *     it still hits the used-pair refusal. A second undo is refused, and past
 *     the window the retirement is permanent — which also leaves the probe
 *     voter exactly where rule 2 left him.
 *
 * Votes in the same unanimous direction as every other voter, so it does not
 * disturb the walkthrough's consensus or accuracy assertions. Its didn't-sees
 * are weightless by construction (no Elo touch), so the extra ones rule 3
 * needs cost the consensus nothing.
 */
export const probeSessionRules = internalMutation({
  args: { userId: v.id("users"), gameweekId: v.id("fantasyGameweeks") },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) fail("synthetic gameweek missing.");
    const now = Date.now();

    const fixtures = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", args.gameweekId))
      .collect();
    const fixtureIds = fixtures.map((f) => f._id);

    // The picker gates serving: unanswered means no pair, not an empty pair.
    const beforePicker = await servePairFor(ctx, args.userId, gameweek, now);
    if (beforePicker.status !== "needs_picker") {
      fail(`serving before the picker returned "${beforePicker.status}", expected needs_picker.`);
    }
    await setWatchedFixturesFor(ctx, args.userId, gameweek, fixtureIds, now);

    // 1 · the reveal, from stored votes across users.
    const first = await servePairFor(ctx, args.userId, gameweek, now);
    if (first.status !== "served") fail(`probe voter got "${first.status}", expected a pair.`);
    const [a, b] = first.players;
    const voted = await castVoteFor(
      ctx,
      args.userId,
      first.pairId,
      a.playerId < b.playerId ? "a" : "b",
      now,
    );
    if (voted.reveal === null) fail("a real vote returned no consensus reveal.");
    if (voted.reveal.total < CROWD_REVEAL_MIN_VOTES) {
      fail(`reveal saw ${voted.reveal.total} votes — below the sample floor, unexpectedly.`);
    }
    if (voted.reveal.withYou !== voted.reveal.total || voted.reveal.percent !== 100) {
      fail(
        `unanimous crowd read ${voted.reveal.withYou}/${voted.reveal.total} = ${voted.reveal.percent}%, expected 100%.`,
      );
    }

    // 2 · the cascade: one didn't-see retires the whole game.
    const second = await servePairFor(ctx, args.userId, gameweek, now);
    if (second.status !== "served") fail(`probe voter got "${second.status}", expected a pair.`);
    const unseen = await castVoteFor(ctx, args.userId, second.pairId, "unseen_a", now);
    if (unseen.reveal !== null) fail("a didn't-see was paid with a consensus reveal.");

    const afterCascade = await ctx.db
      .query("fantasyCrowdWatched")
      .withIndex("by_user_gameweek", (q) =>
        q.eq("userId", args.userId).eq("gameweekId", args.gameweekId),
      )
      .first();
    if (afterCascade === null) fail("the picker row vanished on a didn't-see.");
    if (afterCascade.fixtureIds.length !== 0) {
      fail(`the retired fixture is still selected: ${afterCascade.fixtureIds.join(",")}`);
    }
    const nextServe = await servePairFor(ctx, args.userId, gameweek, now);
    if (nextServe.status !== "no_fixtures") {
      fail(`serving after the cascade returned "${nextServe.status}", expected no_fixtures.`);
    }

    // 3 · "never again" outlives a picker re-save.
    const readd = await setWatchedFixturesFor(ctx, args.userId, gameweek, fixtureIds, now);
    if (readd.selected.length !== 0) {
      fail(`a retired fixture was re-added through the picker: ${readd.selected.join(",")}`);
    }

    // 4 · EYE-TEST-SERVE — the undo gives back the GAME, never the PAIR.
    if (unseen.undo === null) fail("a didn't-see that retired a game offered no undo.");
    if (unseen.undo.fixtures.length !== 1) {
      fail(`the undo offered ${unseen.undo.fixtures.length} fixture(s), expected 1.`);
    }
    await undoUnseenFor(ctx, args.userId, second.pairId, now);
    const afterUndo = await ctx.db
      .query("fantasyCrowdWatched")
      .withIndex("by_user_gameweek", (q) =>
        q.eq("userId", args.userId).eq("gameweekId", args.gameweekId),
      )
      .first();
    if (afterUndo === null) fail("the picker row vanished on an undo.");
    if (afterUndo.fixtureIds.length !== fixtureIds.length) {
      fail(`the undo restored ${afterUndo.fixtureIds.length} fixture(s), expected ${fixtureIds.length}.`);
    }
    if ((afterUndo.unseenFixtureIds ?? []).length !== 0) {
      fail("the undo left the game on the retirement ledger.");
    }
    // The pair itself stays answered — the take-back is not a second ballot.
    const undonePair = await ctx.db.get(second.pairId);
    if (undonePair === null || undonePair.status !== "skipped") {
      fail(`the undone pair reads "${undonePair?.status}", expected it to stay skipped.`);
    }
    let reAnswerRefused = "";
    try {
      await castVoteFor(ctx, args.userId, second.pairId, "a", now);
      fail("an undone pair accepted a second answer.");
    } catch (error) {
      reAnswerRefused = error instanceof Error ? error.message : String(error);
    }
    if (reAnswerRefused !== PAIR_ALREADY_USED) {
      fail(`re-answering an undone pair failed with "${reAnswerRefused}", expected the used-pair refusal.`);
    }
    let secondUndoRefused = "";
    try {
      await undoUnseenFor(ctx, args.userId, second.pairId, now);
      fail("a retirement was taken back twice.");
    } catch (error) {
      secondUndoRefused = error instanceof Error ? error.message : String(error);
    }

    // 5 · past the window the retirement is permanent (EYE-TEST-TEN ruling),
    //     which also puts the probe voter back in the cascade's end state.
    const third = await servePairFor(ctx, args.userId, gameweek, now);
    if (third.status !== "served") fail(`probe voter got "${third.status}", expected a pair.`);
    await castVoteFor(ctx, args.userId, third.pairId, "unseen_a", now);
    let lateUndoRefused = "";
    try {
      await undoUnseenFor(ctx, args.userId, third.pairId, now + CROWD_UNDO_WINDOW_MS + 1);
      fail("a retirement was taken back after the window closed.");
    } catch (error) {
      lateUndoRefused = error instanceof Error ? error.message : String(error);
    }
    const finalWatched = await ctx.db
      .query("fantasyCrowdWatched")
      .withIndex("by_user_gameweek", (q) =>
        q.eq("userId", args.userId).eq("gameweekId", args.gameweekId),
      )
      .first();
    if (finalWatched === null || finalWatched.fixtureIds.length !== 0) {
      fail("the expired undo left the retired game on the selection.");
    }

    return {
      pickerGated: "serving refused before the picker was answered",
      reveal: `${voted.reveal.withYou}/${voted.reveal.total} = ${voted.reveal.percent}% (unanimous crowd, caller counted inside it)`,
      didntSeeUnpaid: "no reveal on a didn't-see",
      cascade: "one didn't-see emptied the selection; serving answered no_fixtures",
      readdRefused: `re-adding ${fixtureIds.length} retired fixture(s) through the picker selected 0`,
      undoRestored: `the game came back to the selection and left the ledger; the pair stayed skipped ("${reAnswerRefused}")`,
      secondUndoRefused,
      lateUndoRefused,
    };
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
    // EYE-TEST-TEN: the picker rows the walkthrough's voters answered. Keyed
    // by (user, gameweek) with no by_gameweek index, so they are collected
    // per sim voter — the same users the purge below deletes.
    for (const user of await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.gte("username", SIM_USERNAME_PREFIX).lt("username", SIM_USERNAME_PREFIX + "\uffff"),
      )
      .take(100)) {
      if (!user.username?.startsWith(SIM_USERNAME_PREFIX)) continue;
      const watched = await ctx.db
        .query("fantasyCrowdWatched")
        .withIndex("by_user_gameweek", (q) =>
          q.eq("userId", user._id).eq("gameweekId", gameweekId),
        )
        .collect();
      for (const row of watched) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
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
  args: {
    salt: v.optional(v.string()),
    /** FW-VS1: true skips the purge phase so a verifier can inspect the rows;
     *  the report then carries the exact purge commands. Default: purge. */
    keepData: v.optional(v.boolean()),
  },
  handler: async (ctx, { salt, keepData }): Promise<Record<string, unknown>> => {
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
    let votedPairId: string | null = null;
    let totalVotes = 0;
    for (let i = 0; i < voters.length; i += 1) {
      const round: {
        served: number;
        voted: number;
        openPairId: string | null;
        votedPairId: string | null;
      } = await ctx.runMutation(internal.fantasyCrowdSim.castAllPairsFor, {
        userId: voters[i],
        gameweekId,
        ...(i === 0 ? { leaveLastUnvoted: true } : {}),
      });
      totalVotes += round.voted;
      if (round.openPairId !== null) openPairId = round.openPairId;
      if (i === 0) votedPairId = round.votedPairId;
    }
    report.votesCast = totalVotes;

    // 3b · single-use pairs (FW-CR2, verify-package O2): a second ballot on a
    //      pair voter 0 already voted must refuse — while voting is still
    //      OPEN, so the refusal can only be the used-pair rejection.
    if (votedPairId === null) fail("no voted pair was captured for the second-vote probe.");
    report.secondVoteRejected = await ctx.runMutation(
      internal.fantasyCrowdSim.probeSecondVote,
      { userId: voters[0], pairId: votedPairId as Id<"fantasyCrowdPairs"> },
    );

    // 3c · EYE-TEST-TEN: the picker gate, the reveal aggregate, the cascade
    //      and its durability — one extra voter, voting in the same unanimous
    //      direction so the consensus and accuracy assertions below are
    //      untouched (he adds exactly one rater row, counted for at step 10).
    const probeVoter: Id<"users"> = await ctx.runMutation(
      internal.fantasyCrowdSim.createProbeVoter,
      { salt: tag },
    );
    report.sessionRules = await ctx.runMutation(internal.fantasyCrowdSim.probeSessionRules, {
      userId: probeVoter,
      gameweekId,
    });

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
    // SIM_VOTERS + the EYE-TEST-TEN session-rules probe voter, who cast one
    // vote in the same unanimous direction (his didn't-see is not a vote and
    // scores nothing — the weightlessness rule, exercised here).
    if (settledState.raterStats.length !== SIM_VOTERS + 1) {
      fail(`expected ${SIM_VOTERS + 1} rater rows, got ${settledState.raterStats.length}.`);
    }
    for (const rater of settledState.raterStats) {
      if (rater.scoredVotes === 0 || rater.accurateVotes !== rater.scoredVotes) {
        fail(`unanimous voter scored ${rater.accurateVotes}/${rater.scoredVotes} — expected all accurate.`);
      }
    }
    report.raterAccuracy = `${SIM_VOTERS + 1} voters scored (${SIM_VOTERS} + the session-rules probe), unanimous, all accurate`;

    // 11 · purge clean, both layers — unless the verifier asked to inspect.
    if (keepData === true) {
      report.kept = {
        gameweekId,
        purgeCommands: [
          `npx convex run fantasyCrowdSim:purgeSimCrowdData '{"gameweekId":"${gameweekId}"}'`,
          `npx convex run fantasyScoringDev:purgeSynthetic '{"season":"${SIM_SEASON}"}'`,
        ],
      };
    } else {
      const crowdPurge = await ctx.runMutation(internal.fantasyCrowdSim.purgeSimCrowdData, {
        gameweekId,
      });
      const synthPurge = await ctx.runMutation(internal.fantasyScoringDev.purgeSynthetic, {
        season: SIM_SEASON,
      });
      report.purged = { crowd: crowdPurge, synthetic: synthPurge };
    }

    report.verdict = "PASS";
    return report;
  },
});
