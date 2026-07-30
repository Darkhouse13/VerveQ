/**
 * Weekend Fantasy — the reclamation-court DEV walkthrough (FW-LAUNCH O3).
 *
 * The O3 DONE gate against a SYNTHETIC gameweek, through the real cores:
 * file → rule → re-scored version appears with the prior readable →
 * post-finality filing rejected → purge clean. Plus the adversarial set the
 * mission demands: rate limit, duplicate merge, filer/holder juror
 * exclusion, double vote, early resolver no-op, sub-threshold death, a feed
 * revision AFTER the ruling that must keep the ruled verdict, and settled-
 * gameweek immunity.
 *
 * Postures as its siblings: internal-only, tagged (`simcourt_*`), purged by
 * id. The ONE direct table write outside product paths is the holder's
 * scaffold squad (a budget-context squad row + one slot) — synthetic
 * players are unpriced by design so no product path could build it, and the
 * juror-exclusion rule cannot be exercised without a holder. Crew squads
 * are never fabricated (F1).
 *
 * Run:  npx convex run fantasyCourtSim:simulateCourtWalkthrough '{"salt":"o3"}'
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  castCourtVoteFor,
  endorseClaimFor,
  fileClaimFor,
  rebutClaimFor,
  ALREADY_VOTED,
  CONFLICTED_VOTER,
  FILER_CANNOT_VOTE,
  FILING_CLOSED,
  FILING_LIMIT_REACHED,
  GAMEWEEK_SETTLED,
  REBUTTAL_TAKEN,
} from "./fantasyCourt";
import type { Slot } from "./lib/fantasyScoring";

const SIM_USERNAME_PREFIX = "simcourt_";
const SIM_SEASON = "SYNTH-O3-COURT";
const SIM_GW = 903;
const SIM_FIXTURE = "synth-o3-court-1";
const SIM_USER_COUNT = 40; // u0 = filer; plenty of endorsers + 31 jurors

function fail(message: string): never {
  throw new Error(`WALKTHROUGH FAILED: ${message}`);
}

async function expectRejection(
  fn: () => Promise<unknown>,
  mustContain: string,
  label: string,
): Promise<string> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(mustContain)) {
      fail(`${label}: rejected for the wrong reason — "${message}" (wanted "${mustContain}")`);
    }
    return message;
  }
  return fail(`${label}: the server ACCEPTED what it must refuse.`);
}

const baseStats = {
  minutes: 90,
  goals: 0,
  assists: 0,
  shotsTotal: 1,
  shotsOn: 1,
  keyPasses: 1,
  passesTotal: 30,
  passesAccurate: 25,
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
  (["SYNTH-O3A", "SYNTH-O3B"] as const).map((clubId, j) => ({
    providerPlayerId: `synth-o3c-p${i * 2 + j}`,
    name: `Synth Court ${position} ${j}`,
    clubId,
    feedPosition: position,
  })),
);

function feedRows(goalsForFirstMid: number) {
  return SIM_PLAYERS.map((p) => ({
    providerPlayerId: p.providerPlayerId,
    clubId: p.clubId,
    feedPosition: p.feedPosition,
    stats:
      p.providerPlayerId === "synth-o3c-p4" // the claim target, a MID
        ? { ...baseStats, goals: goalsForFirstMid }
        : baseStats,
    events: [] as { minute: number; kind: "goal" }[],
    entryMinute: null,
  }));
}

// ── helper mutations ──

export const createCourtSimUsers = internalMutation({
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

/** The holder's scaffold: a budget-context squad row + one slot holding the
 *  claim target. See the module header for why this is a direct write. */
export const scaffoldHolderSquad = internalMutation({
  args: {
    userId: v.id("users"),
    gameweekId: v.id("fantasyGameweeks"),
    playerId: v.id("fantasyPlayers"),
  },
  handler: async (ctx, args) => {
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null || !gameweek.season.startsWith("SYNTH-")) {
      throw new Error("scaffoldHolderSquad refuses a non-synthetic gameweek.");
    }
    const squadId = await ctx.db.insert("fantasySquads", {
      userId: args.userId,
      gameweekId: args.gameweekId,
      context: "budget",
      contextKey: "budget",
      favoriteClubAtBuild: null,
      createdAt: Date.now(),
    });
    await ctx.db.insert("fantasySquadSlots", {
      squadId,
      slotIndex: 0,
      slotRole: "MID",
      isFinisher: false,
      playerId: args.playerId,
    });
    return { squadId };
  },
});

export const courtSimPhaseFile = internalMutation({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    filer: v.id("users"),
    duplicateFiler: v.id("users"),
  },
  handler: async (ctx, args) => {
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) fail("synthetic gameweek missing.");
    const now = Date.now();

    const playerX = await ctx.db
      .query("fantasyPlayers")
      .withIndex("by_providerPlayerId", (q) => q.eq("providerPlayerId", "synth-o3c-p4"))
      .first();
    const playerY = await ctx.db
      .query("fantasyPlayers")
      .withIndex("by_providerPlayerId", (q) => q.eq("providerPlayerId", "synth-o3c-p6"))
      .first();
    if (playerX === null || playerY === null) fail("synthetic players missing.");
    const fixture = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_providerFixtureId", (q) => q.eq("providerFixtureId", SIM_FIXTURE))
      .first();
    if (fixture === null) fail("synthetic fixture missing.");

    // Claim 1: the MID actually played DEF. Claim 2: the ATT played MID.
    const claim1 = await fileClaimFor(
      ctx,
      args.filer,
      gameweek,
      {
        playerId: playerX._id,
        fixtureId: fixture._id,
        claimedPosition: "DEF",
        argument: "He sat in the back line all game.",
      },
      now,
    );
    if (claim1.merged) fail("first filing reported as a merge.");
    const claim2 = await fileClaimFor(
      ctx,
      args.filer,
      gameweek,
      {
        playerId: playerY._id,
        fixtureId: fixture._id,
        claimedPosition: "MID",
        argument: "Dropped deep from the first whistle.",
      },
      now,
    );

    // Rate limit: the filer's third filing must be refused.
    const limitMsg = await expectRejection(
      () =>
        fileClaimFor(
          ctx,
          args.filer,
          gameweek,
          {
            playerId: playerY._id,
            fixtureId: fixture._id,
            claimedPosition: "GK",
            argument: "Third one.",
          },
          now,
        ),
      FILING_LIMIT_REACHED,
      "third filing",
    );

    // Duplicate claim (same player+fixture+position) merges as endorsement.
    const dup = await fileClaimFor(
      ctx,
      args.duplicateFiler,
      gameweek,
      {
        playerId: playerX._id,
        fixtureId: fixture._id,
        claimedPosition: "DEF",
        argument: "Same thing I saw.",
      },
      now,
    );
    if (!dup.merged || dup.claimId !== claim1.claimId) fail("duplicate did not merge.");
    const merged = await ctx.db.get(claim1.claimId);
    if (merged?.endorsements !== 2) {
      fail(`merged claim has ${merged?.endorsements} endorsements, expected 2.`);
    }

    return { claim1Id: claim1.claimId, claim2Id: claim2.claimId, limitMsg };
  },
});

export const courtSimPhaseEndorse = internalMutation({
  args: {
    claimId: v.id("fantasyCourtClaims"),
    endorsers: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const userId of args.endorsers) {
      await endorseClaimFor(ctx, userId, args.claimId, now);
    }
    const claim = await ctx.db.get(args.claimId);
    return { status: claim?.status, endorsements: claim?.endorsements };
  },
});

export const courtSimPhaseTrial = internalMutation({
  args: {
    claimId: v.id("fantasyCourtClaims"),
    filer: v.id("users"),
    holder: v.id("users"),
    rebutter: v.id("users"),
    secondRebutter: v.id("users"),
    yesVoters: v.array(v.id("users")),
    noVoters: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await rebutClaimFor(ctx, args.rebutter, args.claimId, "The feed had it right.", now);
    const rebuttalMsg = await expectRejection(
      () => rebutClaimFor(ctx, args.secondRebutter, args.claimId, "Me too.", now),
      REBUTTAL_TAKEN,
      "second rebuttal",
    );

    const filerMsg = await expectRejection(
      () => castCourtVoteFor(ctx, args.filer, args.claimId, "yes", now),
      FILER_CANNOT_VOTE,
      "filer voting",
    );
    const holderMsg = await expectRejection(
      () => castCourtVoteFor(ctx, args.holder, args.claimId, "yes", now),
      CONFLICTED_VOTER,
      "holder voting",
    );

    for (const userId of args.yesVoters) {
      await castCourtVoteFor(ctx, userId, args.claimId, "yes", now);
    }
    for (const userId of args.noVoters) {
      await castCourtVoteFor(ctx, userId, args.claimId, "no", now);
    }
    const doubleMsg = await expectRejection(
      () => castCourtVoteFor(ctx, args.yesVoters[0], args.claimId, "no", now),
      ALREADY_VOTED,
      "double vote",
    );

    return { rebuttalMsg, filerMsg, holderMsg, doubleMsg };
  },
});

export const courtSimProbeClosed = internalMutation({
  args: { gameweekId: v.id("fantasyGameweeks"), filer: v.id("users") },
  handler: async (ctx, args): Promise<string> => {
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) fail("synthetic gameweek missing.");
    const player = await ctx.db
      .query("fantasyPlayers")
      .withIndex("by_providerPlayerId", (q) => q.eq("providerPlayerId", "synth-o3c-p0"))
      .first();
    const fixture = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_providerFixtureId", (q) => q.eq("providerFixtureId", SIM_FIXTURE))
      .first();
    if (player === null || fixture === null) fail("synthetic rows missing.");
    return expectRejection(
      () =>
        fileClaimFor(
          ctx,
          args.filer,
          gameweek,
          {
            playerId: player._id,
            fixtureId: fixture._id,
            claimedPosition: "MID",
            argument: "Too late.",
          },
          Date.now(),
        ),
      FILING_CLOSED,
      "post-finality filing",
    );
  },
});

export const courtSimProbeSettled = internalMutation({
  args: { claimId: v.id("fantasyCourtClaims"), userId: v.id("users") },
  handler: async (ctx, args): Promise<string> => {
    return expectRejection(
      () => endorseClaimFor(ctx, args.userId, args.claimId, Date.now()),
      GAMEWEEK_SETTLED,
      "endorsing on a settled gameweek",
    );
  },
});

export const courtSimClaims = internalQuery({
  args: { gameweekId: v.id("fantasyGameweeks") },
  handler: async (ctx, { gameweekId }) => {
    const claims: Doc<"fantasyCourtClaims">[] = [];
    for (const status of ["filing", "trial", "died", "passed", "failed"] as const) {
      claims.push(
        ...(await ctx.db
          .query("fantasyCourtClaims")
          .withIndex("by_gameweek_status", (q) =>
            q.eq("gameweekId", gameweekId).eq("status", status),
          )
          .collect()),
      );
    }
    return claims.map((c) => ({
      claimId: c._id,
      providerPlayerId: c.providerPlayerId,
      claimedPosition: c.claimedPosition,
      status: c.status,
      endorsements: c.endorsements,
      tallies: c.tallies ?? null,
    }));
  },
});

export const purgeCourtSimData = internalMutation({
  args: { gameweekId: v.id("fantasyGameweeks") },
  handler: async (ctx, { gameweekId }) => {
    const gameweek = await ctx.db.get(gameweekId);
    if (gameweek !== null && !gameweek.season.startsWith("SYNTH-")) {
      throw new Error("purgeCourtSimData refuses a non-synthetic gameweek.");
    }
    let deleted = 0;
    for (const status of ["filing", "trial", "died", "passed", "failed"] as const) {
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
    // Sim users and the holder's scaffold squad.
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

// ── the walkthrough ──

export const simulateCourtWalkthrough = internalAction({
  args: { salt: v.optional(v.string()) },
  handler: async (ctx, { salt }): Promise<Record<string, unknown>> => {
    const tag = (salt ?? "o3").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 8) || "o3";
    const report: Record<string, unknown> = {};
    const now = Date.now();

    // 1 · seed + score. Finality 25h out: filing (finality−24h) is open.
    const seeded: { gameweekId: Id<"fantasyGameweeks"> } = await ctx.runMutation(
      internal.fantasyScoringDev.seedSyntheticFixture,
      {
        season: SIM_SEASON,
        gwNumber: SIM_GW,
        finalityAt: now + 25 * 60 * 60 * 1000,
        providerFixtureId: SIM_FIXTURE,
        kickoffAt: now - 3 * 60 * 60 * 1000,
        homeClubId: "SYNTH-O3A",
        awayClubId: "SYNTH-O3B",
        homeGoals: 1,
        awayGoals: 0,
        players: SIM_PLAYERS,
      },
    );
    const gameweekId = seeded.gameweekId;
    await ctx.runMutation(internal.fantasyScores.applyFixtureStats, {
      providerFixtureId: SIM_FIXTURE,
      hasPlayerStats: true,
      hasEvents: true,
      rows: feedRows(0),
    });
    report.seeded = gameweekId;

    // 2 · users + the conflicted holder's scaffold.
    const users: Id<"users">[] = await ctx.runMutation(
      internal.fantasyCourtSim.createCourtSimUsers,
      { salt: tag },
    );
    const filer = users[0];
    const duplicateFiler = users[1];
    const holder = users[39];
    const targetPlayer: { _id: Id<"fantasyPlayers"> } | null = await ctx.runQuery(
      internal.fantasyCourtSim.findSimPlayer,
      { providerPlayerId: "synth-o3c-p4" },
    );
    if (targetPlayer === null) fail("claim target missing.");
    await ctx.runMutation(internal.fantasyCourtSim.scaffoldHolderSquad, {
      userId: holder,
      gameweekId,
      playerId: targetPlayer._id,
    });

    // 3 · filing: two claims, rate limit, duplicate merge.
    const filedPhase: { claim1Id: Id<"fantasyCourtClaims">; claim2Id: Id<"fantasyCourtClaims">; limitMsg: string } =
      await ctx.runMutation(internal.fantasyCourtSim.courtSimPhaseFile, {
        gameweekId,
        filer,
        duplicateFiler,
      });
    report.filing = { rateLimit: filedPhase.limitMsg, duplicateMerged: true };

    // 4 · endorse claim1 to the threshold (floor 15; filer + duplicate = 2).
    const endorsed: { status?: string; endorsements?: number } = await ctx.runMutation(
      internal.fantasyCourtSim.courtSimPhaseEndorse,
      { claimId: filedPhase.claim1Id, endorsers: users.slice(2, 15) },
    );
    if (endorsed.status !== "trial") {
      fail(`claim1 should be on trial at ${endorsed.endorsements} endorsements, is "${endorsed.status}".`);
    }
    report.trialOpened = endorsed.endorsements;

    // 5 · trial: rebuttal (once), juror exclusions, 28 yes / 3 no.
    const trial: Record<string, string> = await ctx.runMutation(
      internal.fantasyCourtSim.courtSimPhaseTrial,
      {
        claimId: filedPhase.claim1Id,
        filer,
        holder,
        rebutter: users[35],
        secondRebutter: users[36],
        yesVoters: users.slice(2, 30), // 28
        noVoters: users.slice(30, 33), // 3
      },
    );
    report.trial = trial;

    // 6 · the resolver is a no-op while both windows are open.
    await ctx.runMutation(internal.fantasyCourt.resolveDueClaims, {});
    let claims: {
      claimId: string;
      status: string;
      tallies: { rawVotes: number; rawYes: number; rawNo: number } | null;
    }[] = await ctx.runQuery(internal.fantasyCourtSim.courtSimClaims, { gameweekId });
    const statusOf = (id: string) => claims.find((c) => c.claimId === id)?.status;
    if (statusOf(filedPhase.claim1Id) !== "trial" || statusOf(filedPhase.claim2Id) !== "filing") {
      fail("resolver acted while the windows were still open.");
    }
    report.earlyResolverNoop = true;

    // 7 · Monday 23:59 passes: the sub-threshold claim dies.
    await ctx.runMutation(internal.fantasyScoringDev.setSyntheticFinality, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
      finalityAt: Date.now() + 23 * 60 * 60 * 1000,
    });
    await ctx.runMutation(internal.fantasyCourt.resolveDueClaims, {});
    claims = await ctx.runQuery(internal.fantasyCourtSim.courtSimClaims, { gameweekId });
    if (statusOf(filedPhase.claim2Id) !== "died") fail("sub-threshold claim did not die at Monday close.");
    if (statusOf(filedPhase.claim1Id) !== "trial") fail("trial claim was touched at Monday close.");
    report.subThresholdDied = true;

    // 8 · Tuesday 21:00 passes: the trial resolves, passes, re-scores.
    await ctx.runMutation(internal.fantasyScoringDev.setSyntheticFinality, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
      finalityAt: Date.now() + 2 * 60 * 60 * 1000,
    });
    await ctx.runMutation(internal.fantasyCourt.resolveDueClaims, {});
    claims = await ctx.runQuery(internal.fantasyCourtSim.courtSimClaims, { gameweekId });
    const ruled = claims.find((c) => c.claimId === filedPhase.claim1Id);
    if (ruled?.status !== "passed") fail(`claim1 resolved "${ruled?.status}", expected passed.`);
    if (ruled.tallies === null || ruled.tallies.rawVotes !== 31) {
      fail(`tallies wrong: ${JSON.stringify(ruled?.tallies)}.`);
    }
    report.verdict = ruled.tallies;

    type ScoreRow = {
      providerPlayerId: string;
      version: number;
      crowdFactor: number;
      verdictPosition: string | null;
      supersededByVersion: number | null;
      statHash: string;
      baseScores: unknown;
    };
    let rows: ScoreRow[] = await ctx.runQuery(internal.fantasyScoringDev.syntheticScoreRows, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
    });
    const target = (want: number) =>
      rows
        .filter((r) => r.providerPlayerId === "synth-o3c-p4")
        .sort((a, b) => a.version - b.version)
        .slice(0, want + 1);
    {
      const mine = rows
        .filter((r) => r.providerPlayerId === "synth-o3c-p4")
        .sort((a, b) => a.version - b.version);
      if (mine.length !== 2) fail(`expected 2 versions for the target, got ${mine.length}.`);
      const [v1, v2] = mine;
      if (v2.verdictPosition !== "DEF") fail("re-scored version does not carry the ruled verdict.");
      if (v1.verdictPosition !== "MID") fail("prior version's verdict moved.");
      if (v1.supersededByVersion !== 2) fail("prior version not superseded.");
      if (v2.crowdFactor !== v1.crowdFactor) fail("re-score moved the crowd factor.");
      if (v1.statHash === v2.statHash) fail("verdict change did not move the stat hash.");
      if (JSON.stringify(v1.baseScores) === JSON.stringify(v2.baseScores)) {
        fail("re-score produced an identical grid — the dampener did not move.");
      }
    }
    report.rescore = "v2 = ruled DEF, prior readable + superseded, factor preserved";

    // 9 · a feed revision AFTER the ruling keeps the ruled verdict.
    await ctx.runMutation(internal.fantasyScores.applyFixtureStats, {
      providerFixtureId: SIM_FIXTURE,
      hasPlayerStats: true,
      hasEvents: true,
      rows: feedRows(1), // the target's goal count moves → revision
    });
    rows = await ctx.runQuery(internal.fantasyScoringDev.syntheticScoreRows, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
    });
    {
      const mine = rows
        .filter((r) => r.providerPlayerId === "synth-o3c-p4")
        .sort((a, b) => a.version - b.version);
      if (mine.length !== 3) fail(`expected 3 versions after the revision, got ${mine.length}.`);
      if (mine[2].verdictPosition !== "DEF") {
        fail("the feed revision RESET the ruled verdict — the override failed.");
      }
    }
    report.revisionKeepsRuling = true;
    void target;

    // 10 · post-finality: filing refused.
    await ctx.runMutation(internal.fantasyScoringDev.setSyntheticFinality, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
      finalityAt: Date.now() - 60 * 1000,
    });
    report.postFinalityFiling = await ctx.runMutation(
      internal.fantasyCourtSim.courtSimProbeClosed,
      { gameweekId, filer: users[37] },
    );

    // 11 · settle; the gameweek is then immune to every court write.
    await ctx.runAction(internal.fantasyScores.settleGameweeks, {});
    report.settledImmune = await ctx.runMutation(internal.fantasyCourtSim.courtSimProbeSettled, {
      claimId: filedPhase.claim1Id,
      userId: users[38],
    });
    const before = rows.length;
    await ctx.runMutation(internal.fantasyCourt.resolveDueClaims, {});
    rows = await ctx.runQuery(internal.fantasyScoringDev.syntheticScoreRows, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
    });
    if (rows.length !== before) fail("the resolver wrote versions on a settled gameweek.");

    // 12 · purge clean.
    const courtPurge = await ctx.runMutation(internal.fantasyCourtSim.purgeCourtSimData, {
      gameweekId,
    });
    const synthPurge = await ctx.runMutation(internal.fantasyScoringDev.purgeSynthetic, {
      season: SIM_SEASON,
    });
    report.purged = { court: courtPurge, synthetic: synthPurge };

    report.verdictLine = "PASS";
    return report;
  },
});

export const findSimPlayer = internalQuery({
  args: { providerPlayerId: v.string() },
  handler: async (ctx, { providerPlayerId }) => {
    return ctx.db
      .query("fantasyPlayers")
      .withIndex("by_providerPlayerId", (q) => q.eq("providerPlayerId", providerPlayerId))
      .first();
  },
});
