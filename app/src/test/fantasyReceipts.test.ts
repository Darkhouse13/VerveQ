/**
 * FW-RECEIPT Part 3 — the settlement percentile stamp and the receipt read.
 *
 * Drives the REAL settlement path (finalize → stamp totals → settled mark) in
 * the in-memory harness, then pins:
 *
 *  - the stamp refuses until the settlement stamp is final (guarded on the
 *    stamp, never on "the cron reached me");
 *  - population = budget squads WITH a number; a squad whose settled weekend
 *    scored nothing is excluded, not counted as 0;
 *  - beatCount = strictly-lower totals; rows are immutable and the stamp is
 *    idempotent;
 *  - getReceipt is null before settlement (an unsettled weekend is a ledger,
 *    not a receipt) and afterwards carries the stamped total, the factual
 *    superlatives, and the percentile — or no percentile where there is no
 *    number, honestly.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FOUR_FOUR_TWO,
  SATURDAY,
  TWO_ATT_FINISHERS,
  handlerOf,
  seedWorld,
  type World,
} from "./support/fantasyFakeConvex";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => null as string | null),
}));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
  convexAuth: () => ({
    auth: {},
    signIn: () => {},
    signOut: () => {},
    store: {},
    isAuthenticated: () => false,
  }),
}));

import * as fantasySquads from "../../convex/fantasySquads";
import * as fantasyScores from "../../convex/fantasyScores";
import * as fantasyReceipts from "../../convex/fantasyReceipts";
import type { SquadReceipt, StampPercentilesResult } from "../../convex/fantasyReceipts";
import { emptyStats, type PlayerMatchStats } from "../../convex/lib/fantasyScoring";

const createSquad = handlerOf(fantasySquads.createSquad);
const setSlot = handlerOf(fantasySquads.setSlot);
const applyFixtureStats = handlerOf(fantasyScores.applyFixtureStats);
const finalizeGameweekChunk = handlerOf(fantasyScores.finalizeGameweekChunk);
const stampSquadFinalTotals = handlerOf(fantasyScores.stampSquadFinalTotals);
const stampGameweekPercentiles = handlerOf(fantasyReceipts.stampGameweekPercentiles);
const getReceipt = handlerOf(fantasyReceipts.getReceipt);

const THURSDAY = SATURDAY - 2 * 86_400_000;
const AFTER_SATURDAY = SATURDAY + 3 * 3_600_000;

let world: World;
let userA: string;
let userB: string;
let userC: string;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(THURSDAY);
  world = await seedWorld();
  userA = world.userId;
  userB = await world.db.insert("users", { username: "second" });
  userC = await world.db.insert("users", { username: "third" });
  authMock.getAuthUserId.mockImplementation(async () => userA);
});

function asUser(userId: string) {
  authMock.getAuthUserId.mockImplementation(async () => userId);
}

function row(
  providerPlayerId: string,
  clubId: string,
  feedPosition: "GK" | "DEF" | "MID" | "ATT" | null,
  stats: Partial<PlayerMatchStats>,
) {
  return {
    providerPlayerId,
    clubId,
    feedPosition,
    stats: emptyStats(stats),
    events: [] as { minute: number; kind: string }[],
    entryMinute: null as number | null,
  };
}

/** A partial budget squad: the listed handles into slots 0.. in order. */
async function buildPartialSquad(userId: string, handles: string[]): Promise<string> {
  asUser(userId);
  const { squadId } = (await createSquad(world.ctx, {
    gameweekId: world.gameweekId,
    context: "budget",
    formation: FOUR_FOUR_TWO,
    finisherRoles: [...TWO_ATT_FINISHERS],
  })) as { squadId: string };
  for (const [slotIndex, handle] of handles.entries()) {
    await setSlot(world.ctx, { squadId, slotIndex, playerId: world.players[handle] });
  }
  return squadId;
}

/**
 * SAT_A beats SAT_B 2-0.
 *   SAT_A_1 GK: 1 + win 1 + saves 3x0.5 + clean sheet 5      = 8.5
 *   SAT_A_2 DEF: 1 + win 1 + clean sheet 4 + tackles 4x0.4   = 7.6
 *   SAT_B_1 GK: 1 + saves 4x0.5 - concede 2/2               = 2.0
 */
async function scoreSaturday(): Promise<void> {
  const fixture = world.db
    .rows("fantasyFixtures")
    .find((f) => f.providerFixtureId === "f-sat-1");
  await world.db.patch(fixture!._id as string, { status: "finished", homeGoals: 2, awayGoals: 0 });
  await applyFixtureStats(world.ctx, {
    providerFixtureId: "f-sat-1",
    hasPlayerStats: true,
    hasEvents: true,
    now: AFTER_SATURDAY,
    rows: [
      row("SAT_A_1", "SAT_A", "GK", { minutes: 90, saves: 3 }),
      row("SAT_A_2", "SAT_A", "DEF", { minutes: 90, tackles: 4 }),
      row("SAT_B_1", "SAT_B", "GK", { minutes: 90, saves: 4 }),
    ],
  });
}

/** Finalize rows and stamp totals at the cut, which marks the gameweek settled. */
async function settle(): Promise<number> {
  const gameweek = world.db.rows("fantasyGameweeks")[0];
  const cut = (gameweek.finalityAt as number) + 1_000;
  vi.setSystemTime(cut);
  await finalizeGameweekChunk(world.ctx, { gameweekId: world.gameweekId, now: cut });
  await stampSquadFinalTotals(world.ctx, { gameweekId: world.gameweekId, now: cut });
  return cut;
}

function stampNow(now?: number): Promise<StampPercentilesResult> {
  return stampGameweekPercentiles(world.ctx, {
    gameweekId: world.gameweekId,
    ...(now === undefined ? {} : { now }),
  }) as Promise<StampPercentilesResult>;
}

function receiptFor(userId: string): Promise<SquadReceipt | null> {
  asUser(userId);
  return getReceipt(world.ctx, {
    gameweekId: world.gameweekId,
    context: "budget",
  }) as Promise<SquadReceipt | null>;
}

async function seedThreeSquads(): Promise<void> {
  await buildPartialSquad(userA, ["SAT_A_1", "SAT_A_2"]); // 16.1 settled
  await buildPartialSquad(userB, ["SAT_B_1"]); // 2.0 settled
  await buildPartialSquad(userC, ["SUN_A_1"]); // fixture never scored → no number
  vi.setSystemTime(AFTER_SATURDAY);
  await scoreSaturday();
}

describe("stampGameweekPercentiles", () => {
  it("refuses before the settlement stamp, and writes nothing", async () => {
    await seedThreeSquads();
    const early = await stampNow(AFTER_SATURDAY);
    expect(early.eligible).toBe(false);
    expect(world.db.rows("fantasyGameweekPercentiles")).toHaveLength(0);
  });

  it("stamps beatCount over the population WITH numbers, excluding the no-number squad", async () => {
    await seedThreeSquads();
    const cut = await settle();
    const result = await stampNow(cut + 1);

    expect(result.eligible).toBe(true);
    expect(result.done).toBe(true);
    expect(result.population).toBe(2); // userC's squad has no number: excluded
    expect(result.stamped).toBe(2);

    const rows = world.db.rows("fantasyGameweekPercentiles");
    expect(rows).toHaveLength(2);
    const forUser = (userId: string) => rows.find((r) => r.userId === userId)!;
    expect(forUser(userA).total).toBe(16.1);
    expect(forUser(userA).beatCount).toBe(1);
    expect(forUser(userA).population).toBe(2);
    expect(forUser(userB).total).toBe(2);
    expect(forUser(userB).beatCount).toBe(0);
    expect(rows.find((r) => r.userId === userC)).toBeUndefined();
  });

  it("is idempotent: a second pass writes nothing and moves nothing", async () => {
    await seedThreeSquads();
    const cut = await settle();
    await stampNow(cut + 1);
    const before = world.db
      .rows("fantasyGameweekPercentiles")
      .map((r) => `${r.userId}:${r.beatCount}/${r.population}@${r.computedAt}`);

    const again = await stampNow(cut + 60_000);
    expect(again.stamped).toBe(0);
    expect(again.done).toBe(true);
    expect(
      world.db
        .rows("fantasyGameweekPercentiles")
        .map((r) => `${r.userId}:${r.beatCount}/${r.population}@${r.computedAt}`),
    ).toEqual(before);
  });
});

describe("getReceipt", () => {
  it("is null before settlement — an unsettled weekend is a ledger, not a receipt", async () => {
    await seedThreeSquads();
    expect(await receiptFor(userA)).toBeNull();
  });

  it("after settlement: stamped total, factual superlatives, the percentile", async () => {
    await seedThreeSquads();
    const cut = await settle();
    await stampNow(cut + 1);

    const receipt = (await receiptFor(userA))!;
    expect(receipt.total).toBe(16.1);
    expect(receipt.scoredSlots).toBe(2);
    expect(receipt.settledAt).toBe(cut);
    expect(receipt.slots).toHaveLength(13);

    // Superlatives are facts: highest and lowest contributors.
    expect(receipt.best).toMatchObject({ playerName: "SAT_A_1", points: 8.5 });
    expect(receipt.worst).toMatchObject({ playerName: "SAT_A_2", points: 7.6 });

    // No crowd factor moved anything in this world.
    expect(receipt.crowdMoved).toEqual([]);
    expect(receipt.crewRank).toBeNull();
    expect(receipt.percentile).toEqual({ beatCount: 1, population: 2 });
  });

  it("a single-scored-slot squad gets no superlatives (one player is not a comparison)", async () => {
    await seedThreeSquads();
    const cut = await settle();
    await stampNow(cut + 1);

    const receipt = (await receiptFor(userB))!;
    expect(receipt.total).toBe(2);
    expect(receipt.best).toBeNull();
    expect(receipt.worst).toBeNull();
    expect(receipt.percentile).toEqual({ beatCount: 0, population: 2 });
  });

  it("a settled squad with no number carries no percentile — honestly absent", async () => {
    await seedThreeSquads();
    const cut = await settle();
    await stampNow(cut + 1);

    const receipt = (await receiptFor(userC))!;
    expect(receipt.scoredSlots).toBe(0);
    expect(receipt.percentile).toBeNull();
  });

  it("is null for a visitor", async () => {
    await seedThreeSquads();
    await settle();
    authMock.getAuthUserId.mockImplementation(async () => null);
    const receipt = await getReceipt(world.ctx, {
      gameweekId: world.gameweekId,
      context: "budget",
    });
    expect(receipt).toBeNull();
  });
});
