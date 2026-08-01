/**
 * Weekend Fantasy — the O5 integration pass (FW-LAUNCH).
 *
 * ONE synthetic gameweek through the WHOLE loop, both entry modes, every
 * write through the shipped paths: crew draft (real lobby → real picks →
 * real materialization) + budget squad built for the same gameweek →
 * fixture finishes → stats ingest → provisional scores → crowd votes → a
 * court case moves a verdict → a feed revision lands (keeping the ruling) →
 * the last-look-shaped re-read writes nothing → settlement (crowd factors →
 * finalize → stamp → settle → rater accuracy) → crew table with tie-breaks →
 * both squads' views settled. Purge clean.
 *
 * The one deliberate deviation from the FW-4 harness posture: this sim
 * ACTIVATES and PRICES its synthetic players (both writes synthetic-prefix-
 * asserted, both undone by the purge). The harness keeps synthetic players
 * unselectable because nothing should leak them into real surfaces; the
 * integration pass exists precisely to draft and buy them, on DEV, for
 * minutes, in a gameweek only it owns.
 *
 * Run:  npx convex run fantasyIntegrationSim:simulateWeekendLoop '{"salt":"o5"}'
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  armDraftFor,
  createCrewFor,
  createRoomFor,
  joinCrewFor,
  joinRoomFor,
  makePickFor,
  runBeginDrafting,
  runMaterializeRoomSquads,
  setSeatReadyFor,
} from "./fantasyDraftRooms";
import { seatIndexForPick } from "./lib/fantasyDraftEngine";
import { createBudgetSquadFor, setSlotFor } from "./fantasySquads";
import { crewTableFor, squadScore } from "./fantasyScores";
import { fileClaimFor, endorseClaimFor, castCourtVoteFor } from "./fantasyCourt";
import { GAMEWEEK_SETTLED } from "./fantasyCourt";
import { CROWD_FACTOR_MAX, CROWD_LIQUIDITY_THRESHOLD } from "./lib/fantasyCrowd";

const SIM_USERNAME_PREFIX = "simloop_";
const SIM_SEASON = "SYNTH-O5-LOOP";
const SIM_GW = 905;
const SIM_FIXTURE = "synth-o5-loop-1";
const SIM_CREW_NAME = "FW-O5 SIM";
const SIM_USER_COUNT = 40;

function fail(message: string): never {
  throw new Error(`WALKTHROUGH FAILED: ${message}`);
}

const baseStats = {
  minutes: 90,
  goals: 0,
  assists: 0,
  shotsTotal: 1,
  shotsOn: 1,
  keyPasses: 1,
  passesTotal: 40,
  passesAccurate: 34,
  dribblesAttempted: 1,
  dribblesCompleted: 1,
  tackles: 2,
  interceptions: 1,
  blocks: 1,
  duelsTotal: 6,
  duelsWon: 4,
  foulsCommitted: 0,
  foulsDrawn: 1,
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

const SIM_PLAYERS = (["GK", "DEF", "MID", "ATT"] as const).flatMap((position, i) =>
  (["SYNTH-O5A", "SYNTH-O5B"] as const).map((clubId, j) => ({
    providerPlayerId: `synth-o5l-p${i * 2 + j}`,
    name: `Synth Loop ${position} ${j}`,
    clubId,
    feedPosition: position,
  })),
);

/** The claim target: a MID the court will rule a DEF. */
const TARGET = "synth-o5l-p4";
/** The player whose stat moves in the post-ruling revision. */
const REVISED = "synth-o5l-p6";

function feedRows(revision: 1 | 2) {
  return SIM_PLAYERS.map((p) => ({
    providerPlayerId: p.providerPlayerId,
    clubId: p.clubId,
    feedPosition: p.feedPosition,
    stats:
      p.providerPlayerId === TARGET
        ? { ...baseStats, goals: 1 }
        : p.providerPlayerId === REVISED && revision === 2
          ? { ...baseStats, keyPasses: 3 }
          : baseStats,
    events: [] as { minute: number; kind: "goal" }[],
    entryMinute: null,
  }));
}

// ── setup mutations ──

export const createLoopUsers = internalMutation({
  args: { salt: v.string() },
  handler: async (ctx, { salt }): Promise<Id<"users">[]> => {
    const ids: Id<"users">[] = [];
    for (let i = 0; i < SIM_USER_COUNT; i += 1) {
      const username = `${SIM_USERNAME_PREFIX}${salt}_${i}`.slice(0, 24);
      const existing = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first();
      if (existing !== null) fail(`sim user ${username} already exists — purge first.`);
      ids.push(await ctx.db.insert("users", { username }));
    }
    return ids;
  },
});

/**
 * Make the synthetic fixture a FUTURE, scheduled one (so draft picks and
 * budget selections pass the hindsight gate), and make the synthetic
 * players draftable AND buyable. Every touched row is prefix-asserted.
 */
export const prepareLoopWorld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const fixture = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_providerFixtureId", (q) => q.eq("providerFixtureId", SIM_FIXTURE))
      .first();
    if (fixture === null) fail("synthetic fixture missing.");
    if (!SIM_FIXTURE.startsWith("synth-")) fail("refusing a non-synthetic fixture.");
    await ctx.db.patch(fixture._id, {
      status: "scheduled",
      kickoffAt: now + 60 * 60 * 1000,
      homeGoals: undefined,
      awayGoals: undefined,
    });

    const prices = [4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0];
    for (let i = 0; i < SIM_PLAYERS.length; i += 1) {
      const player = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) =>
          q.eq("providerPlayerId", SIM_PLAYERS[i].providerPlayerId),
        )
        .first();
      if (player === null) fail(`synthetic player ${SIM_PLAYERS[i].providerPlayerId} missing.`);
      if (!player.providerPlayerId.startsWith("synth-")) {
        fail("refusing to activate a non-synthetic player.");
      }
      await ctx.db.patch(player._id, { active: true, price: prices[i] });
    }
    return { fixtureId: fixture._id };
  },
});

export const finishLoopFixture = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fixture = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_providerFixtureId", (q) => q.eq("providerFixtureId", SIM_FIXTURE))
      .first();
    if (fixture === null) fail("synthetic fixture missing.");
    await ctx.db.patch(fixture._id, {
      status: "finished",
      kickoffAt: Date.now() - 3 * 60 * 60 * 1000,
      homeGoals: 2,
      awayGoals: 1,
    });
    return { ok: true };
  },
});

// ── the crew draft, through the real lobby ──

export const draftLoopCrew = internalMutation({
  args: {
    creator: v.id("users"),
    second: v.id("users"),
    gameweekId: v.id("fantasyGameweeks"),
  },
  handler: async (ctx, args) => {
    const { crewId, code } = await createCrewFor(ctx, args.creator, SIM_CREW_NAME);
    await joinCrewFor(ctx, args.second, code);
    const { roomId } = await createRoomFor(ctx, args.creator, crewId);
    const room0 = await ctx.db.get(roomId);
    if (room0 === null) fail("room vanished.");
    if (room0.gameweekId !== args.gameweekId) {
      fail(
        "the draft room targeted a different gameweek — the synthetic gameweek is not the earliest open one.",
      );
    }
    await joinRoomFor(ctx, args.second, roomId);
    await setSeatReadyFor(ctx, args.creator, roomId, true);
    await setSeatReadyFor(ctx, args.second, roomId, true);
    await armDraftFor(ctx, args.creator, roomId);
    await runBeginDrafting(ctx, roomId, Date.now());

    // Per-seat pick scripts: the 8 synthetic players split cap-legally
    // (3 + 1 from each club per seat), then 9 real players each from 18
    // distinct real clubs — "no fixture this gameweek" picks, legal by R5.
    const synthByProvider = new Map<string, Id<"fantasyPlayers">>();
    for (const p of SIM_PLAYERS) {
      const doc = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) => q.eq("providerPlayerId", p.providerPlayerId))
        .first();
      if (doc === null) fail(`synthetic player ${p.providerPlayerId} missing.`);
      synthByProvider.set(p.providerPlayerId, doc._id);
    }
    const sp = (n: number) => {
      const id = synthByProvider.get(`synth-o5l-p${n}`);
      if (id === undefined) fail(`synthetic player p${n} missing.`);
      return id;
    };

    const allPlayers = await ctx.db.query("fantasyPlayers").collect();
    const realByClub = new Map<string, Doc<"fantasyPlayers">>();
    for (const player of [...allPlayers].sort((a, b) =>
      a.providerPlayerId < b.providerPlayerId ? -1 : 1,
    )) {
      if (!player.active || player.providerPlayerId.startsWith("synth-")) continue;
      if (!realByClub.has(player.clubId)) realByClub.set(player.clubId, player);
      if (realByClub.size >= 18) break;
    }
    const realPicks = [...realByClub.values()];
    if (realPicks.length < 18) fail(`only ${realPicks.length} distinct real clubs available.`);

    // Club A: p0,p2,p4,p6 · club B: p1,p3,p5,p7 (positions alternate).
    const scripts: Id<"fantasyPlayers">[][] = [
      [sp(0), sp(2), sp(4), sp(1), ...realPicks.slice(0, 9).map((p) => p._id)],
      [sp(3), sp(5), sp(7), sp(6), ...realPicks.slice(9, 18).map((p) => p._id)],
    ];
    const cursors = [0, 0];
    const userBySeat = [args.creator, args.second];

    for (let guard = 0; guard < 30; guard += 1) {
      const room = await ctx.db.get(roomId);
      if (room === null) fail("room vanished mid-draft.");
      if (room.status === "completed") break;
      if (room.status !== "drafting" || room.snakeOrder === undefined) {
        fail(`room in unexpected status ${room.status}.`);
      }
      const seatIndex = seatIndexForPick(room.snakeOrder, room.currentPickIndex ?? 0);
      const script = scripts[seatIndex];
      const playerId = script[cursors[seatIndex]];
      if (playerId === undefined) fail(`seat ${seatIndex} ran out of scripted picks.`);
      cursors[seatIndex] += 1;
      await makePickFor(ctx, userBySeat[seatIndex], roomId, playerId);
    }

    const done = await ctx.db.get(roomId);
    if (done?.status !== "completed") fail("draft did not complete in 26 picks.");
    await runMaterializeRoomSquads(ctx, roomId, Date.now());
    return { crewCode: code, roomId };
  },
});

// ── the budget squad ──

export const buildLoopBudget = internalMutation({
  args: { userId: v.id("users"), gameweekId: v.id("fantasyGameweeks") },
  handler: async (ctx, args) => {
    const { squadId } = await createBudgetSquadFor(ctx, args.userId, {
      gameweekId: args.gameweekId,
      formation: { GK: 1, DEF: 4, MID: 4, ATT: 2 },
      finisherRoles: ["MID", "ATT"],
    });
    // 3 from each synthetic club (the cap's maximum without a favorite);
    // the other 7 slots ride empty and score zero — spec behavior, on show.
    const picks = ["synth-o5l-p0", "synth-o5l-p2", "synth-o5l-p4", "synth-o5l-p1", "synth-o5l-p3", "synth-o5l-p5"];
    for (let slotIndex = 0; slotIndex < picks.length; slotIndex += 1) {
      const player = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) => q.eq("providerPlayerId", picks[slotIndex]))
        .first();
      if (player === null) fail(`budget pick ${picks[slotIndex]} missing.`);
      await setSlotFor(ctx, args.userId, { squadId, slotIndex, playerId: player._id });
    }
    return { squadId };
  },
});

// ── the court case ──

export const loopCourtCase = internalMutation({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    filer: v.id("users"),
    endorsers: v.array(v.id("users")),
    yesVoters: v.array(v.id("users")),
    noVoters: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) fail("gameweek missing.");
    const now = Date.now();
    const player = await ctx.db
      .query("fantasyPlayers")
      .withIndex("by_providerPlayerId", (q) => q.eq("providerPlayerId", TARGET))
      .first();
    const fixture = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_providerFixtureId", (q) => q.eq("providerFixtureId", SIM_FIXTURE))
      .first();
    if (player === null || fixture === null) fail("court target rows missing.");

    const { claimId } = await fileClaimFor(
      ctx,
      args.filer,
      gameweek,
      {
        playerId: player._id,
        fixtureId: fixture._id,
        claimedPosition: "DEF",
        argument: "Played the whole game at centre half.",
      },
      now,
    );
    for (const endorser of args.endorsers) {
      await endorseClaimFor(ctx, endorser, claimId, now);
    }
    const claim = await ctx.db.get(claimId);
    if (claim?.status !== "trial") fail(`claim is "${claim?.status}", expected trial.`);
    for (const voter of args.yesVoters) {
      await castCourtVoteFor(ctx, voter, claimId, "yes", now);
    }
    for (const voter of args.noVoters) {
      await castCourtVoteFor(ctx, voter, claimId, "no", now);
    }
    return { claimId };
  },
});

export const loopProbeSettledCourt = internalMutation({
  args: { claimId: v.id("fantasyCourtClaims"), userId: v.id("users") },
  handler: async (ctx, args): Promise<string> => {
    try {
      await endorseClaimFor(ctx, args.userId, args.claimId, Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes(GAMEWEEK_SETTLED)) {
        fail(`settled court probe rejected for the wrong reason: ${message}`);
      }
      return message;
    }
    return fail("a settled gameweek accepted a court write.");
  },
});

// ── read model for assertions ──

export const loopState = internalQuery({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    crewCode: v.string(),
    memberUserId: v.id("users"),
    budgetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) fail("gameweek missing.");
    const now = Date.now();

    const budgetSquad = await ctx.db
      .query("fantasySquads")
      .withIndex("by_user_gameweek_contextKey", (q) =>
        q
          .eq("userId", args.budgetUserId)
          .eq("gameweekId", args.gameweekId)
          .eq("contextKey", "budget"),
      )
      .first();
    const budget =
      budgetSquad === null ? null : await squadScore(ctx, budgetSquad, gameweek, now, true);

    const table = await crewTableFor(ctx, args.crewCode, args.memberUserId);

    const ratings = await ctx.db
      .query("fantasyCrowdRatings")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", args.gameweekId))
      .collect();
    const raterStats = await ctx.db
      .query("fantasyCrowdRaterStats")
      .withIndex("by_gameweek_user", (q) => q.eq("gameweekId", args.gameweekId))
      .collect();

    return {
      budget:
        budget === null
          ? null
          : {
              state: budget.state,
              total: budget.total,
              scoredSlots: budget.scoredSlots,
              awaitingSlots: budget.awaitingSlots,
              emptySlots: budget.emptySlots,
              slots: budget.slots.map((s) => ({
                slotIndex: s.slotIndex,
                state: s.state,
                points: s.points,
                crowdFactor: s.crowdFactor,
                verdictPosition: s.verdictPosition,
                mismatch: s.mismatch,
                crowdVotes: s.crowdVotes,
              })),
            },
      table:
        table === null
          ? null
          : {
              tieBreaksApplied: table.tieBreaksApplied,
              rows: table.rows.map((r) => ({
                userId: r.userId,
                rank: r.rank,
                tied: r.tied,
                cumulativePoints: r.cumulativePoints,
                provisional: r.provisional,
              })),
            },
      ratings: ratings.map((r) => ({
        providerPlayerId: r.providerPlayerId,
        voteCount: r.voteCount,
      })),
      raterStatsCount: raterStats.length,
    };
  },
});

// ── purge ──

export const purgeLoopData = internalMutation({
  args: { gameweekId: v.id("fantasyGameweeks") },
  handler: async (ctx, { gameweekId }) => {
    const gameweek = await ctx.db.get(gameweekId);
    if (gameweek !== null && !gameweek.season.startsWith("SYNTH-")) {
      throw new Error("purgeLoopData refuses a non-synthetic gameweek.");
    }
    let deleted = 0;

    // Crew, rooms, draft logs — by the sim's crew name.
    const crews = await ctx.db.query("fantasyCrews").collect();
    for (const crew of crews) {
      if (crew.name !== SIM_CREW_NAME) continue;
      const rooms = await ctx.db
        .query("fantasyDraftRooms")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .collect();
      for (const room of rooms) {
        const log = await ctx.db
          .query("fantasyDraftLog")
          .withIndex("by_room_seq", (q) => q.eq("roomId", room._id))
          .collect();
        for (const entry of log) {
          await ctx.db.delete(entry._id);
          deleted += 1;
        }
        await ctx.db.delete(room._id);
        deleted += 1;
      }
      const members = await ctx.db
        .query("fantasyCrewMembers")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .collect();
      for (const member of members) {
        await ctx.db.delete(member._id);
        deleted += 1;
      }
      await ctx.db.delete(crew._id);
      deleted += 1;
    }

    // Crowd + court rows for the synthetic gameweek.
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
    for (const table of ["fantasyCrowdRatings"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweekId))
        .collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    const raterRows = await ctx.db
      .query("fantasyCrowdRaterStats")
      .withIndex("by_gameweek_user", (q) => q.eq("gameweekId", gameweekId))
      .collect();
    for (const row of raterRows) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    for (const status of ["filing", "trial", "died", "passed", "failed", "expired"] as const) {
      const claims = await ctx.db
        .query("fantasyCourtClaims")
        .withIndex("by_gameweek_status", (q) =>
          q.eq("gameweekId", gameweekId).eq("status", status),
        )
        .collect();
      for (const claim of claims) {
        for (const table of ["fantasyCourtEndorsements", "fantasyCourtVotes"] as const) {
          const rows = await ctx.db
            .query(table)
            .withIndex("by_claim", (q) => q.eq("claimId", claim._id))
            .collect();
          for (const row of rows) {
            await ctx.db.delete(row._id);
            deleted += 1;
          }
        }
        await ctx.db.delete(claim._id);
        deleted += 1;
      }
    }

    // Sim users and every squad of theirs (crew squads from materialization
    // and the budget squad alike), then the users themselves.
    let deletedUsers = 0;
    const users = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.gte("username", SIM_USERNAME_PREFIX).lt("username", SIM_USERNAME_PREFIX + "\uffff"),
      )
      .take(100);
    for (const user of users) {
      if (!user.username?.startsWith(SIM_USERNAME_PREFIX)) continue;
      const squads = await ctx.db
        .query("fantasySquads")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const squad of squads) {
        const slots = await ctx.db
          .query("fantasySquadSlots")
          .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
          .collect();
        for (const slot of slots) {
          await ctx.db.delete(slot._id);
          deleted += 1;
        }
        await ctx.db.delete(squad._id);
        deleted += 1;
      }
      await ctx.db.delete(user._id);
      deletedUsers += 1;
    }

    return { deleted, deletedUsers };
  },
});

// ── UI-run scaffolding (the mobile E2E, H1) ──

/**
 * Draft a REAL crew room for a browser-onboarded user (username must carry
 * the sim prefix so the purge owns it), against whatever gameweek the room
 * machinery targets — on DEV that is the real upcoming GW. Real players,
 * real lobby, real picks, real materialization; the E2E then opens the
 * sheet screen on a phone viewport. `purgeUiRun` removes all of it.
 */
export const draftSheetForUser = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    if (!username.startsWith(SIM_USERNAME_PREFIX)) {
      throw new Error(`draftSheetForUser requires a ${SIM_USERNAME_PREFIX}* username.`);
    }
    const browserUser = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    if (browserUser === null) fail(`no user named ${username}.`);

    const partnerName = `${SIM_USERNAME_PREFIX}uipartner`.slice(0, 24);
    let partner = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", partnerName))
      .first();
    if (partner === null) {
      const partnerId = await ctx.db.insert("users", { username: partnerName });
      partner = await ctx.db.get(partnerId);
    }
    if (partner === null) fail("partner vanished.");

    const { crewId, code } = await createCrewFor(ctx, browserUser._id, SIM_CREW_NAME);
    await joinCrewFor(ctx, partner._id, code);
    const { roomId } = await createRoomFor(ctx, browserUser._id, crewId);
    const room0 = await ctx.db.get(roomId);
    if (room0 === null) fail("room vanished.");
    await joinRoomFor(ctx, partner._id, roomId);
    await setSeatReadyFor(ctx, browserUser._id, roomId, true);
    await setSeatReadyFor(ctx, partner._id, roomId, true);
    await armDraftFor(ctx, browserUser._id, roomId);
    await runBeginDrafting(ctx, roomId, Date.now());

    // 26 real players from 26 distinct clubs — cap-legal by construction.
    const allPlayers = await ctx.db.query("fantasyPlayers").collect();
    const byClub = new Map<string, Doc<"fantasyPlayers">>();
    for (const player of [...allPlayers].sort((a, b) =>
      a.providerPlayerId < b.providerPlayerId ? -1 : 1,
    )) {
      if (!player.active || player.providerPlayerId.startsWith("synth-")) continue;
      if (!byClub.has(player.clubId)) byClub.set(player.clubId, player);
      if (byClub.size >= 26) break;
    }
    const picks = [...byClub.values()];
    if (picks.length < 26) fail(`only ${picks.length} distinct clubs available.`);
    const scripts: Id<"fantasyPlayers">[][] = [
      picks.slice(0, 13).map((p) => p._id),
      picks.slice(13, 26).map((p) => p._id),
    ];
    const cursors = [0, 0];
    const userBySeat = [browserUser._id, partner._id];

    for (let guard = 0; guard < 30; guard += 1) {
      const room = await ctx.db.get(roomId);
      if (room === null) fail("room vanished mid-draft.");
      if (room.status === "completed") break;
      if (room.status !== "drafting" || room.snakeOrder === undefined) {
        fail(`room in unexpected status ${room.status}.`);
      }
      const seatIndex = seatIndexForPick(room.snakeOrder, room.currentPickIndex ?? 0);
      const playerId = scripts[seatIndex][cursors[seatIndex]];
      if (playerId === undefined) fail(`seat ${seatIndex} out of picks.`);
      cursors[seatIndex] += 1;
      await makePickFor(ctx, userBySeat[seatIndex], roomId, playerId);
    }
    await runMaterializeRoomSquads(ctx, roomId, Date.now());
    const done = await ctx.db.get(roomId);
    return { roomId, crewCode: code, gameweekId: done?.gameweekId ?? null };
  },
});

/** Remove everything a UI run created: the sim-named crew(s), their rooms,
 *  logs, every simloop_* user and all of those users' squads. */
export const purgeUiRun = internalMutation({
  args: {},
  handler: async (ctx) => {
    let deleted = 0;
    const crews = await ctx.db.query("fantasyCrews").collect();
    for (const crew of crews) {
      if (crew.name !== SIM_CREW_NAME) continue;
      const rooms = await ctx.db
        .query("fantasyDraftRooms")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .collect();
      for (const room of rooms) {
        const log = await ctx.db
          .query("fantasyDraftLog")
          .withIndex("by_room_seq", (q) => q.eq("roomId", room._id))
          .collect();
        for (const entry of log) {
          await ctx.db.delete(entry._id);
          deleted += 1;
        }
        await ctx.db.delete(room._id);
        deleted += 1;
      }
      const members = await ctx.db
        .query("fantasyCrewMembers")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .collect();
      for (const member of members) {
        await ctx.db.delete(member._id);
        deleted += 1;
      }
      await ctx.db.delete(crew._id);
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
      const squads = await ctx.db
        .query("fantasySquads")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const squad of squads) {
        const slots = await ctx.db
          .query("fantasySquadSlots")
          .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
          .collect();
        for (const slot of slots) {
          await ctx.db.delete(slot._id);
          deleted += 1;
        }
        await ctx.db.delete(squad._id);
        deleted += 1;
      }
      await ctx.db.delete(user._id);
      deletedUsers += 1;
    }
    return { deleted, deletedUsers };
  },
});

// ── the loop ──

export const simulateWeekendLoop = internalAction({
  args: { salt: v.optional(v.string()) },
  handler: async (ctx, { salt }): Promise<Record<string, unknown>> => {
    const tag = (salt ?? "o5").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 8) || "o5";
    const report: Record<string, unknown> = {};
    const now = Date.now();

    // 1 · world: synthetic gameweek (finality 26h out so the court's filing
    // window is open), fixture rewound to a scheduled future kickoff, and
    // the synthetic players made draftable + buyable.
    const seeded: { gameweekId: Id<"fantasyGameweeks"> } = await ctx.runMutation(
      internal.fantasyScoringDev.seedSyntheticFixture,
      {
        season: SIM_SEASON,
        gwNumber: SIM_GW,
        finalityAt: now + 26 * 60 * 60 * 1000,
        providerFixtureId: SIM_FIXTURE,
        kickoffAt: now + 60 * 60 * 1000,
        homeClubId: "SYNTH-O5A",
        awayClubId: "SYNTH-O5B",
        homeGoals: 0,
        awayGoals: 0,
        players: SIM_PLAYERS,
      },
    );
    const gameweekId = seeded.gameweekId;
    await ctx.runMutation(internal.fantasyIntegrationSim.prepareLoopWorld, {});
    const users: Id<"users">[] = await ctx.runMutation(
      internal.fantasyIntegrationSim.createLoopUsers,
      { salt: tag },
    );
    const [drafterA, drafterB, budgetUser] = users;
    report.world = { gameweekId, users: users.length };

    // 2 · both entry modes, same gameweek, real write paths.
    const crew: { crewCode: string; roomId: Id<"fantasyDraftRooms"> } = await ctx.runMutation(
      internal.fantasyIntegrationSim.draftLoopCrew,
      { creator: drafterA, second: drafterB, gameweekId },
    );
    await ctx.runMutation(internal.fantasyIntegrationSim.buildLoopBudget, {
      userId: budgetUser,
      gameweekId,
    });
    report.entered = { crewCode: crew.crewCode, budget: true };

    // 3 · the weekend happens: fixture finishes, stats ingest, provisional.
    await ctx.runMutation(internal.fantasyIntegrationSim.finishLoopFixture, {});
    await ctx.runMutation(internal.fantasyScores.applyFixtureStats, {
      providerFixtureId: SIM_FIXTURE,
      hasPlayerStats: true,
      hasEvents: true,
      rows: feedRows(1),
    });
    let state = await ctx.runQuery(internal.fantasyIntegrationSim.loopState, {
      gameweekId,
      crewCode: crew.crewCode,
      memberUserId: drafterA,
      budgetUserId: budgetUser,
    });
    if (state.budget === null || state.budget.state !== "provisional") {
      fail("budget squad is not provisional after first scoring.");
    }
    if (state.budget.scoredSlots !== 6 || state.budget.emptySlots !== 7) {
      fail(
        `budget squad expected 6 scored + 7 empty, got ${state.budget.scoredSlots}/${state.budget.emptySlots}.`,
      );
    }
    if (state.table === null || state.table.rows.length !== 2) fail("crew table missing rows.");
    report.provisional = {
      budgetTotal: state.budget.total,
      crewRows: state.table.rows.map((r) => r.cumulativePoints),
    };

    // 4 · the crowd votes (voters hold nothing, so nothing is excluded).
    const voters = users.slice(3, 8);
    for (const voter of voters) {
      await ctx.runMutation(internal.fantasyCrowdSim.castAllPairsFor, {
        userId: voter,
        gameweekId,
      });
    }
    state = await ctx.runQuery(internal.fantasyIntegrationSim.loopState, {
      gameweekId,
      crewCode: crew.crewCode,
      memberUserId: drafterA,
      budgetUserId: budgetUser,
    });
    for (const rating of state.ratings) {
      if (rating.voteCount < CROWD_LIQUIDITY_THRESHOLD) {
        fail(`${rating.providerPlayerId} below the liquidity threshold (${rating.voteCount}).`);
      }
    }
    report.votes = `all ${state.ratings.length} players ≥ ${CROWD_LIQUIDITY_THRESHOLD}`;

    // 5 · the court: file on the MID, endorse to trial, 28–3 yes.
    const court: { claimId: Id<"fantasyCourtClaims"> } = await ctx.runMutation(
      internal.fantasyIntegrationSim.loopCourtCase,
      {
        gameweekId,
        filer: users[39],
        endorsers: users.slice(8, 22),
        yesVoters: users.slice(8, 36), // 28
        noVoters: users.slice(36, 39), // 3
      },
    );

    // 6 · Tuesday 21:00 arrives (finality now+2h): the verdict lands.
    await ctx.runMutation(internal.fantasyScoringDev.setSyntheticFinality, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
      finalityAt: Date.now() + 2 * 60 * 60 * 1000,
    });
    const resolved: { passed: number; rescored: number } = await ctx.runMutation(
      internal.fantasyCourt.resolveDueClaims,
      {},
    );
    if (resolved.passed !== 1 || resolved.rescored !== 1) {
      fail(`verdict expected 1 passed + 1 rescored, got ${JSON.stringify(resolved)}.`);
    }
    state = await ctx.runQuery(internal.fantasyIntegrationSim.loopState, {
      gameweekId,
      crewCode: crew.crewCode,
      memberUserId: drafterA,
      budgetUserId: budgetUser,
    });
    const ruledSlot = state.budget?.slots.find((s) => s.verdictPosition === "DEF");
    if (ruledSlot === undefined) fail("no budget slot reads the ruled DEF verdict.");
    report.verdictMoved = true;

    // 7 · a feed revision lands AFTER the ruling — and keeps it.
    await ctx.runMutation(internal.fantasyScores.applyFixtureStats, {
      providerFixtureId: SIM_FIXTURE,
      hasPlayerStats: true,
      hasEvents: true,
      rows: feedRows(2),
    });
    type ScoreRow = { providerPlayerId: string; version: number; verdictPosition: string | null };
    const rows: ScoreRow[] = await ctx.runQuery(internal.fantasyScoringDev.syntheticScoreRows, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
    });
    const currentOf = (pid: string) =>
      rows.filter((r) => r.providerPlayerId === pid).sort((a, b) => b.version - a.version)[0];
    if (currentOf(TARGET)?.verdictPosition !== "DEF") {
      fail("the revision reset the ruled verdict.");
    }
    if (currentOf(REVISED)?.version !== 2) {
      fail("the revision did not produce a new version for the changed player.");
    }
    report.revision = "landed as new versions, ruling kept";

    // 8 · the last-look-shaped re-read (same rows again) writes nothing.
    const lastLook: { scoreVersionsWritten?: number } = await ctx.runMutation(
      internal.fantasyScores.applyFixtureStats,
      {
        providerFixtureId: SIM_FIXTURE,
        hasPlayerStats: true,
        hasEvents: true,
        rows: feedRows(2),
      },
    );
    if ((lastLook.scoreVersionsWritten ?? -1) !== 0) {
      fail(`last-look re-read wrote ${lastLook.scoreVersionsWritten} versions, expected 0.`);
    }
    report.lastLook = "idempotent — zero writes";

    // 9 · finality passes; the settlement driver runs the whole tail:
    // crowd factors → finalize → stamp → settle → rater accuracy.
    await ctx.runMutation(internal.fantasyScoringDev.setSyntheticFinality, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
      finalityAt: Date.now() - 60 * 1000,
    });
    await ctx.runAction(internal.fantasyScores.settleGameweeks, {});

    state = await ctx.runQuery(internal.fantasyIntegrationSim.loopState, {
      gameweekId,
      crewCode: crew.crewCode,
      memberUserId: drafterA,
      budgetUserId: budgetUser,
    });
    if (state.budget?.state !== "final") fail("budget squad is not settled.");
    const factored = state.budget.slots.filter(
      (s) => s.crowdFactor !== null && s.crowdFactor !== 0,
    );
    if (factored.length === 0) fail("no budget slot carries a crowd factor after settlement.");
    for (const slot of factored) {
      if (Math.abs(slot.crowdFactor ?? 0) > CROWD_FACTOR_MAX) {
        fail(`slot ${slot.slotIndex} factor ${slot.crowdFactor} out of band.`);
      }
    }
    if (state.table?.tieBreaksApplied !== true) fail("crew table does not apply tie-breaks.");
    if (state.table.rows.some((r) => r.cumulativePoints === null)) {
      fail("a crew row settled without a total.");
    }
    if (state.raterStatsCount !== voters.length) {
      fail(`expected ${voters.length} rater rows, got ${state.raterStatsCount}.`);
    }
    report.settled = {
      budgetTotal: state.budget.total,
      factoredSlots: factored.length,
      crewRanks: state.table.rows.map((r) => `${r.rank}${r.tied ? "T" : ""}`),
    };

    // 10 · settled means immune, everywhere.
    report.settledCourtImmune = await ctx.runMutation(
      internal.fantasyIntegrationSim.loopProbeSettledCourt,
      { claimId: court.claimId, userId: users[38] },
    );
    const immune: { eligible: boolean } = await ctx.runMutation(
      internal.fantasyCrowdVoting.applyCrowdFactorsForGameweek,
      { gameweekId },
    );
    if (immune.eligible) fail("settled gameweek accepted a factor application.");

    // 11 · purge clean, everything.
    const loopPurge = await ctx.runMutation(internal.fantasyIntegrationSim.purgeLoopData, {
      gameweekId,
    });
    const synthPurge = await ctx.runMutation(internal.fantasyScoringDev.purgeSynthetic, {
      season: SIM_SEASON,
    });
    report.purged = { loop: loopPurge, synthetic: synthPurge };

    report.verdict = "PASS";
    return report;
  },
});
