/**
 * Weekend Fantasy — the reclamation-court DEV walkthrough (FW-LAUNCH O3,
 * extended by FW-CR1).
 *
 * The O3 DONE gate against a SYNTHETIC gameweek, through the real cores:
 * file → rule → re-scored version appears with the prior readable →
 * post-finality filing rejected → purge clean. Plus the adversarial set the
 * mission demands: rate limit, duplicate merge, filer/holder juror
 * exclusion, double vote, early resolver no-op, sub-threshold death, a feed
 * revision AFTER the ruling that must keep the ruled verdict, and settled-
 * gameweek immunity.
 *
 * FW-CR1 adds three:
 *   · the SETTLEMENT-LAG EXPIRY PATH (item 1) — a second synthetic gameweek
 *     carrying a claim whose votes WOULD pass, resolved for the first time
 *     after its own finality instant. It must expire, not rule: no verdict,
 *     no tallies, not one new score version. Two gameweeks on two clocks
 *     through ONE resolver call also prove the split is per-gameweek.
 *   · the CROWD REGROUPING check (item 2) — the freeze reads each row's
 *     CURRENT verdict, so the court-moved player is percentiled among the
 *     group he was ruled into and the group he left re-percentiles.
 *   · the rebuttal's TRIAL gate (item 3) — refused during filing, slot intact.
 *
 * Postures as its siblings: internal-only, tagged (`simcourt_*`), purged by
 * id. TWO direct table writes sit outside product paths, both on synthetic
 * rows only:
 *   · the holder's scaffold squad (a budget-context squad row + one slot) —
 *     synthetic players are unpriced by design so no product path could build
 *     it, and the juror-exclusion rule cannot be exercised without a holder;
 *   · the crowd rating rows for the regrouping check — reaching the liquidity
 *     threshold through the real Elo path costs 100+ pair votes per run, and
 *     that path is already covered end-to-end by fantasyCrowdSim. What is
 *     under test here is the FREEZE's grouping, which reads ratings as data.
 * Crew squads are never fabricated (F1).
 *
 * Run:  npx convex run fantasyCourtSim:simulateCourtWalkthrough '{"salt":"o3"}'
 *
 * FW-VS1 data contract: pass `"keepData": true` to SKIP the purge phase and
 * leave every row on DEV for independent inspection — the report then names
 * the exact purge commands (also listed here, ORDER MATTERS — the lag
 * gameweek first with `purgeUsers: false`, because the sim users are shared
 * across both gameweeks and the holder's scaffold squad is reached through
 * them):
 *   npx convex run fantasyCourtSim:purgeCourtSimData '{"gameweekId":"<lag id>","purgeUsers":false}'
 *   npx convex run fantasyCourtSim:purgeCourtSimData '{"gameweekId":"<main id>"}'
 *   npx convex run fantasyScoringDev:purgeSynthetic '{"season":"SYNTH-O3-COURT"}'
 * All three are idempotent — a second pass deletes zero rows.
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
  NOT_ON_TRIAL,
  REBUTTAL_TAKEN,
} from "./fantasyCourt";
import { CROWD_FACTOR_MAX } from "./lib/fantasyCrowd";
import type { Slot } from "./lib/fantasyScoring";

const SIM_USERNAME_PREFIX = "simcourt_";
const SIM_SEASON = "SYNTH-O3-COURT";
const SIM_GW = 903;
const SIM_FIXTURE = "synth-o3-court-1";
const SIM_USER_COUNT = 40; // u0 = filer; plenty of endorsers + 31 jurors

/** The settlement-lag gameweek: same synthetic season, its own clock. */
const SIM_GW_LAG = 904;
const SIM_FIXTURE_LAG = "synth-o3-court-lag";
/** The lag claim's target and one team-mate, so the fixture is a real match. */
const LAG_PLAYERS = [
  {
    providerPlayerId: "synth-o3l-p0",
    name: "Synth Lag DEF 0",
    clubId: "SYNTH-O3C",
    feedPosition: "DEF" as const,
  },
  {
    providerPlayerId: "synth-o3l-p1",
    name: "Synth Lag MID 1",
    clubId: "SYNTH-O3D",
    feedPosition: "MID" as const,
  },
];

/**
 * The frozen-factor fixture for item 2. Ratings are chosen so the two
 * hypotheses DISAGREE IN SIGN for the court-moved player: p4 is the floor of
 * the DEF group he was ruled into (−15%) and would be the ceiling of the MID
 * group he left (+15%). p5, alone in MID once the ruling lands, sits at his
 * group's median rather than at the bottom he would hold beside p4.
 */
const CROWD_SCAFFOLD = [
  { providerPlayerId: "synth-o3c-p0", rating: 1550 }, // GK
  { providerPlayerId: "synth-o3c-p1", rating: 1450 }, // GK
  { providerPlayerId: "synth-o3c-p2", rating: 1700 }, // DEF
  { providerPlayerId: "synth-o3c-p3", rating: 1600 }, // DEF
  { providerPlayerId: "synth-o3c-p4", rating: 1500 }, // MID → ruled DEF
  { providerPlayerId: "synth-o3c-p5", rating: 1400 }, // MID (left alone)
  { providerPlayerId: "synth-o3c-p6", rating: 1650 }, // ATT
  { providerPlayerId: "synth-o3c-p7", rating: 1350 }, // ATT
];

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

    // FW-CR1 item 3: the rebuttal is a trial feature. Refused here, on a claim
    // still gathering endorsements — and the slot must survive to the hearing,
    // which the trial phase then proves by spending it.
    if (merged.status !== "filing") fail("claim1 is not in filing status for the rebuttal probe.");
    const earlyRebuttalMsg = await expectRejection(
      () => rebutClaimFor(ctx, args.duplicateFiler, claim1.claimId, "Not so.", now),
      NOT_ON_TRIAL,
      "rebuttal during filing",
    );
    const untouched = await ctx.db.get(claim1.claimId);
    if (untouched?.rebuttal !== undefined) {
      fail("the refused rebuttal still landed on the claim.");
    }

    return { claim1Id: claim1.claimId, claim2Id: claim2.claimId, limitMsg, earlyRebuttalMsg };
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

// ── the settlement-lag gameweek (FW-CR1 item 1) ──

/**
 * File the lag claim and endorse it onto the docket. Its gameweek's clock is
 * still 25h from finality here, so this is an ordinary filing through the
 * ordinary cores — nothing about it is special until the resolver arrives late.
 */
export const courtSimLagFile = internalMutation({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    filer: v.id("users"),
    endorsers: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) fail("lag gameweek missing.");
    const now = Date.now();

    const player = await ctx.db
      .query("fantasyPlayers")
      .withIndex("by_providerPlayerId", (q) =>
        q.eq("providerPlayerId", LAG_PLAYERS[0].providerPlayerId),
      )
      .first();
    const fixture = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_providerFixtureId", (q) => q.eq("providerFixtureId", SIM_FIXTURE_LAG))
      .first();
    if (player === null || fixture === null) fail("lag fixture rows missing.");

    const filed = await fileClaimFor(
      ctx,
      args.filer,
      gameweek,
      {
        playerId: player._id,
        fixtureId: fixture._id,
        claimedPosition: "MID",
        argument: "He played in midfield the whole way.",
      },
      now,
    );
    for (const userId of args.endorsers) {
      await endorseClaimFor(ctx, userId, filed.claimId, now);
    }
    const claim = await ctx.db.get(filed.claimId);
    if (claim?.status !== "trial") {
      fail(`lag claim should be on trial at ${claim?.endorsements} endorsements, is "${claim?.status}".`);
    }
    return { claimId: filed.claimId, endorsements: claim.endorsements };
  },
});

/** Seat a passing jury on the lag claim — the verdict it must never receive. */
export const courtSimLagVotes = internalMutation({
  args: { claimId: v.id("fantasyCourtClaims"), yesVoters: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const userId of args.yesVoters) {
      await castCourtVoteFor(ctx, userId, args.claimId, "yes", now);
    }
    const votes = await ctx.db
      .query("fantasyCourtVotes")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .collect();
    return { votes: votes.length };
  },
});

export const courtSimClaim = internalQuery({
  args: { claimId: v.id("fantasyCourtClaims") },
  handler: async (ctx, { claimId }) => {
    const claim = await ctx.db.get(claimId);
    if (claim === null) return null;
    return {
      status: claim.status,
      resolvedAt: claim.resolvedAt ?? null,
      tallies: claim.tallies ?? null,
      claimedPosition: claim.claimedPosition,
      providerPlayerId: claim.providerPlayerId,
    };
  },
});

// ── crowd ratings scaffold (FW-CR1 item 2) ──

/**
 * Write this gameweek's crowd ratings directly. See the module header for why
 * this is a direct write; the guard is the same one every purge uses.
 */
export const scaffoldCrowdRatings = internalMutation({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    voteCount: v.number(),
    rows: v.array(v.object({ providerPlayerId: v.string(), rating: v.number() })),
  },
  handler: async (ctx, args) => {
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null || !gameweek.season.startsWith("SYNTH-")) {
      throw new Error("scaffoldCrowdRatings refuses a non-synthetic gameweek.");
    }
    let written = 0;
    for (const row of args.rows) {
      const player = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) =>
          q.eq("providerPlayerId", row.providerPlayerId),
        )
        .first();
      if (player === null) fail(`crowd scaffold: player ${row.providerPlayerId} missing.`);
      await ctx.db.insert("fantasyCrowdRatings", {
        gameweekId: args.gameweekId,
        playerId: player._id,
        providerPlayerId: row.providerPlayerId,
        rating: row.rating,
        voteCount: args.voteCount,
      });
      written += 1;
    }
    return { written };
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
    for (const status of ["filing", "trial", "died", "passed", "failed", "expired"] as const) {
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
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    /** The sim users are shared across the walkthrough's two gameweeks, and
     *  the holder's scaffold squad is reached THROUGH them — so only the last
     *  purge of a run takes them. Defaults to taking them (single-gameweek use). */
    purgeUsers: v.optional(v.boolean()),
  },
  handler: async (ctx, { gameweekId, purgeUsers }) => {
    const gameweek = await ctx.db.get(gameweekId);
    if (gameweek !== null && !gameweek.season.startsWith("SYNTH-")) {
      throw new Error("purgeCourtSimData refuses a non-synthetic gameweek.");
    }
    let deleted = 0;
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
    // The crowd ratings scaffolded for the regrouping check (FW-CR1 item 2).
    const ratings = await ctx.db
      .query("fantasyCrowdRatings")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweekId))
      .collect();
    for (const row of ratings) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    // Sim users and the holder's scaffold squad.
    let deletedUsers = 0;
    if (purgeUsers === false) return { deleted, deletedUsers };
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
  args: {
    salt: v.optional(v.string()),
    /** FW-VS1: true skips the purge phase so a verifier can inspect the rows;
     *  the report then carries the exact purge commands. Default: purge. */
    keepData: v.optional(v.boolean()),
  },
  handler: async (ctx, { salt, keepData }): Promise<Record<string, unknown>> => {
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

    // 3 · filing: two claims, rate limit, duplicate merge, rebuttal refused.
    const filedPhase: {
      claim1Id: Id<"fantasyCourtClaims">;
      claim2Id: Id<"fantasyCourtClaims">;
      limitMsg: string;
      earlyRebuttalMsg: string;
    } = await ctx.runMutation(internal.fantasyCourtSim.courtSimPhaseFile, {
      gameweekId,
      filer,
      duplicateFiler,
    });
    report.filing = {
      rateLimit: filedPhase.limitMsg,
      duplicateMerged: true,
      rebuttalDuringFiling: filedPhase.earlyRebuttalMsg,
    };

    // 4 · endorse claim1 to the threshold (floor 15; filer + duplicate = 2).
    const endorsed: { status?: string; endorsements?: number } = await ctx.runMutation(
      internal.fantasyCourtSim.courtSimPhaseEndorse,
      { claimId: filedPhase.claim1Id, endorsers: users.slice(2, 15) },
    );
    if (endorsed.status !== "trial") {
      fail(`claim1 should be on trial at ${endorsed.endorsements} endorsements, is "${endorsed.status}".`);
    }
    report.trialOpened = endorsed.endorsements;

    // 5 · trial: the rebuttal slot spent (proving it survived filing), juror
    //     exclusions, 28 yes / 3 no.
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
    report.rebuttalSlotSurvivedFiling = true;

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

    // 6b · the settlement-lag gameweek: a second synthetic week on its OWN
    //      clock, carrying a claim with a jury that would pass it. Filed and
    //      seated here, while its finality is still 25h out.
    const lagSeeded: { gameweekId: Id<"fantasyGameweeks"> } = await ctx.runMutation(
      internal.fantasyScoringDev.seedSyntheticFixture,
      {
        season: SIM_SEASON,
        gwNumber: SIM_GW_LAG,
        finalityAt: Date.now() + 25 * 60 * 60 * 1000,
        providerFixtureId: SIM_FIXTURE_LAG,
        kickoffAt: Date.now() - 3 * 60 * 60 * 1000,
        homeClubId: "SYNTH-O3C",
        awayClubId: "SYNTH-O3D",
        homeGoals: 1,
        awayGoals: 1,
        players: LAG_PLAYERS,
      },
    );
    const lagGameweekId = lagSeeded.gameweekId;
    await ctx.runMutation(internal.fantasyScores.applyFixtureStats, {
      providerFixtureId: SIM_FIXTURE_LAG,
      hasPlayerStats: true,
      hasEvents: true,
      rows: LAG_PLAYERS.map((p) => ({
        providerPlayerId: p.providerPlayerId,
        clubId: p.clubId,
        feedPosition: p.feedPosition,
        stats: baseStats,
        events: [] as { minute: number; kind: "goal" }[],
        entryMinute: null,
      })),
    });
    const lagFiled: { claimId: Id<"fantasyCourtClaims">; endorsements: number } =
      await ctx.runMutation(internal.fantasyCourtSim.courtSimLagFile, {
        gameweekId: lagGameweekId,
        filer: users[20],
        endorsers: users.slice(0, 14), // + the filer = the floor of 15
      });
    const lagVotes: { votes: number } = await ctx.runMutation(
      internal.fantasyCourtSim.courtSimLagVotes,
      {
        claimId: lagFiled.claimId,
        // 31 unanimous yes at weight 1.0 — quorum 30, share 100%. This claim
        // passes the trial test outright; only the clock stops it.
        yesVoters: [...users.slice(0, 20), ...users.slice(21, 32)],
      },
    );
    if (lagVotes.votes !== 31) fail(`lag claim seated ${lagVotes.votes} jurors, expected 31.`);
    const lagScoresBefore: { providerPlayerId: string; version: number; verdictPosition: string | null }[] =
      await ctx.runQuery(internal.fantasyScoringDev.syntheticScoreRows, {
        season: SIM_SEASON,
        gwNumber: SIM_GW_LAG,
      });
    report.lagSeeded = { endorsements: lagFiled.endorsements, jurors: lagVotes.votes };

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

    // 8b · THE SETTLEMENT-LAG EXPIRY PATH (FW-CR1 item 1, the critical one).
    //
    //      The pass above ran inside GW903's verdict window and left GW904
    //      alone — its own clock was nowhere near a window. Now GW904 goes
    //      PAST finality with its trial still open and un-judged, exactly as a
    //      missed resolver tick leaves it, and the gameweek is NOT yet stamped
    //      settled: the lag. The resolver must refuse the verdict and expire
    //      the claim instead.
    {
      const lagStillOpen: { status: string } | null = await ctx.runQuery(
        internal.fantasyCourtSim.courtSimClaim,
        { claimId: lagFiled.claimId },
      );
      if (lagStillOpen?.status !== "trial") {
        fail(`the GW903 verdict pass moved the lag claim to "${lagStillOpen?.status}".`);
      }

      await ctx.runMutation(internal.fantasyScoringDev.setSyntheticFinality, {
        season: SIM_SEASON,
        gwNumber: SIM_GW_LAG,
        finalityAt: Date.now() - 60 * 1000,
      });
      const lagStatus: { gameweekScoring: { state: string } | null } | null =
        await ctx.runQuery(internal.fantasyScoringDev.syntheticStatus, {
          season: SIM_SEASON,
          gwNumber: SIM_GW_LAG,
        });
      if (lagStatus?.gameweekScoring?.state === "final") {
        fail("the lag gameweek settled before the probe — this is not the lag scenario.");
      }

      const resolved: { expired: number; passed: number; rescored: number } =
        await ctx.runMutation(internal.fantasyCourt.resolveDueClaims, {});
      if (resolved.passed !== 0 || resolved.rescored !== 0) {
        fail(
          `a verdict was applied at/after finality: passed=${resolved.passed}, rescored=${resolved.rescored}.`,
        );
      }
      // The COUNT is reported, not asserted: this runs on DEV, where the court
      // cron fires every 15 minutes and may legitimately have expired the claim
      // in the second between the finality move and this call. The claim's own
      // state below is the assertion either way.
      report.lagResolverCounts = resolved;

      const lagClaim: {
        status: string;
        tallies: unknown;
        resolvedAt: number | null;
      } | null = await ctx.runQuery(internal.fantasyCourtSim.courtSimClaim, {
        claimId: lagFiled.claimId,
      });
      if (lagClaim?.status !== "expired") {
        fail(`the lag claim resolved "${lagClaim?.status}" — history asserts an outcome.`);
      }
      if (lagClaim.tallies !== null) fail("an expired claim carries a verdict's tallies.");
      if (lagClaim.resolvedAt === null) fail("the expiry left no timestamp.");

      // And the scores it never reached: not one version, not one verdict.
      const lagScoresAfter: {
        providerPlayerId: string;
        version: number;
        verdictPosition: string | null;
      }[] = await ctx.runQuery(internal.fantasyScoringDev.syntheticScoreRows, {
        season: SIM_SEASON,
        gwNumber: SIM_GW_LAG,
      });
      if (lagScoresAfter.length !== lagScoresBefore.length) {
        fail(
          `the expiry wrote score versions: ${lagScoresBefore.length} → ${lagScoresAfter.length}.`,
        );
      }
      const lagTarget = lagScoresAfter.find(
        (r) => r.providerPlayerId === LAG_PLAYERS[0].providerPlayerId,
      );
      if (lagTarget?.verdictPosition !== LAG_PLAYERS[0].feedPosition) {
        fail(
          `the expired claim moved the verdict to "${lagTarget?.verdictPosition}" — it must stay ${LAG_PLAYERS[0].feedPosition}.`,
        );
      }
      report.settlementLagExpiry =
        "31-juror passing claim expired at finality: no verdict, no tallies, no score version";
    }

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

    // 10b · CROWD REGROUPING UNDER A PASSED VERDICT (FW-CR1 item 2).
    //
    //       The freeze runs after finality and derives each player's factor
    //       from his row's CURRENT verdict — so p4, ruled MID→DEF in step 8,
    //       is percentiled among the DEFs and the MID group he left
    //       re-percentiles over whoever remains. The ratings are picked so the
    //       two readings disagree in SIGN: nothing here passes by accident.
    await ctx.runMutation(internal.fantasyCourtSim.scaffoldCrowdRatings, {
      gameweekId,
      voteCount: 30, // clear of the liquidity threshold: every row is liquid
      rows: CROWD_SCAFFOLD,
    });
    const frozen: {
      written: number;
      unchanged: number;
      insufficient: number;
      done: boolean;
    } = await ctx.runMutation(internal.fantasyCrowdVoting.applyCrowdFactorsForGameweek, {
      gameweekId,
    });
    // Every liquid player is derived; the two whose frozen factor IS the
    // default 0 (the ruled group's median and the vacated group's lone member)
    // need no version — the pass is idempotent, not blind.
    if (frozen.written + frozen.unchanged !== CROWD_SCAFFOLD.length || frozen.insufficient !== 0) {
      fail(
        `crowd freeze covered ${frozen.written}+${frozen.unchanged}/${CROWD_SCAFFOLD.length} (${frozen.insufficient} illiquid) — ` +
          "if this says 0+0, the DEV settlement cron stamped the gameweek between phases 10 and 10b; re-run.",
      );
    }
    if (frozen.written !== 6) fail(`expected 6 non-zero factors, got ${frozen.written}.`);
    rows = await ctx.runQuery(internal.fantasyScoringDev.syntheticScoreRows, {
      season: SIM_SEASON,
      gwNumber: SIM_GW,
    });
    {
      const near = (a: number, b: number) => Math.abs(a - b) < 1e-12;
      const current = (providerPlayerId: string) =>
        rows
          .filter((r) => r.providerPlayerId === providerPlayerId)
          .sort((a, b) => b.version - a.version)[0];

      const moved = current("synth-o3c-p4");
      if (moved.verdictPosition !== "DEF") fail("the frozen version lost the ruled verdict.");
      // The floor of the three-man DEF group he was RULED into. Had the freeze
      // grouped him by his filed position he would be the MID group's ceiling,
      // i.e. +15% — the assertion below is the whole determination.
      if (!near(moved.crowdFactor, -CROWD_FACTOR_MAX)) {
        fail(
          `court-moved player froze at ${moved.crowdFactor}, expected ${-CROWD_FACTOR_MAX} (the ruled group's floor).`,
        );
      }
      // The group he joined re-percentiled around him: p3 was the floor of a
      // two-man DEF group and is now its median.
      if (!near(current("synth-o3c-p3").crowdFactor, 0)) {
        fail(`the receiving group did not re-percentile: p3 froze at ${current("synth-o3c-p3").crowdFactor}.`);
      }
      if (!near(current("synth-o3c-p2").crowdFactor, CROWD_FACTOR_MAX)) {
        fail(`the receiving group's ceiling moved: p2 froze at ${current("synth-o3c-p2").crowdFactor}.`);
      }
      // The vacated group is consistent: p5 is alone in MID, so his group's
      // median — not the −15% floor he held while p4 was still beside him.
      const vacated = current("synth-o3c-p5");
      if (vacated.verdictPosition !== "MID" || vacated.crowdFactor !== 0) {
        fail(
          `the vacated group is inconsistent: p5 froze at ${vacated.crowdFactor} as ${vacated.verdictPosition}.`,
        );
      }
      for (const row of rows) {
        if (Math.abs(row.crowdFactor) > CROWD_FACTOR_MAX) {
          fail(`${row.providerPlayerId} v${row.version} carries an out-of-band factor.`);
        }
      }
    }
    report.crowdRegrouping =
      "ruled DEF floor −15% (would be +15% as a MID), receiving group re-percentiled, vacated MID at median";

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

    // 12 · purge clean — the lag gameweek first, because the users it shares
    //      with GW903 are what the last purge walks to reach the scaffolds.
    //      With keepData the phase is skipped whole and the report carries
    //      the same three commands, in the same order, for the verifier.
    if (keepData === true) {
      report.kept = {
        gameweekId,
        lagGameweekId,
        purgeCommands: [
          `npx convex run fantasyCourtSim:purgeCourtSimData '{"gameweekId":"${lagGameweekId}","purgeUsers":false}'`,
          `npx convex run fantasyCourtSim:purgeCourtSimData '{"gameweekId":"${gameweekId}"}'`,
          `npx convex run fantasyScoringDev:purgeSynthetic '{"season":"${SIM_SEASON}"}'`,
        ],
      };
    } else {
      const lagPurge = await ctx.runMutation(internal.fantasyCourtSim.purgeCourtSimData, {
        gameweekId: lagGameweekId,
        purgeUsers: false,
      });
      const courtPurge = await ctx.runMutation(internal.fantasyCourtSim.purgeCourtSimData, {
        gameweekId,
      });
      report.lagPurged = lagPurge;
      const synthPurge = await ctx.runMutation(internal.fantasyScoringDev.purgeSynthetic, {
        season: SIM_SEASON,
      });
      report.purged = { court: courtPurge, synthetic: synthPurge };
    }

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
