/**
 * FW-RECEIPT Part 2 — the live ledger (getSquadLedger).
 *
 * Runs the REAL convex/fantasyLedger.ts read surface over the REAL build +
 * ingest path in the in-memory harness. Pins the rules the mission states:
 *
 *  - awaiting is ABSENT: a player whose fixture is unscored contributes no
 *    entry at all — the ledger never says zero for him;
 *  - every line traces to a row: term narration only appears when the stored
 *    version's statHash re-derives exactly; a fixture score that moved after
 *    the fact degrades the entry to points-only (terms: null), never to an
 *    invented story;
 *  - a revision entry says what changed, honestly: term-level deltas that sum
 *    to the visible points movement;
 *  - entries are newest-first and the squad's construction is the oldest.
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
import * as fantasyLedger from "../../convex/fantasyLedger";
import type { SquadLedger, SquadLedgerEvent } from "../../convex/fantasyLedger";
import { emptyStats, type PlayerMatchStats } from "../../convex/lib/fantasyScoring";

const createSquad = handlerOf(fantasySquads.createSquad);
const setSlot = handlerOf(fantasySquads.setSlot);
const applyFixtureStats = handlerOf(fantasyScores.applyFixtureStats);
const getSquadLedger = handlerOf(fantasyLedger.getSquadLedger);

const THURSDAY = SATURDAY - 2 * 86_400_000;
const AFTER_SATURDAY = SATURDAY + 3 * 3_600_000;
const LATER = AFTER_SATURDAY + 2 * 3_600_000;

const SHEET = [
  "SAT_A_1", // 0  GK
  "SAT_A_2", // 1  DEF
  "SAT_A_3", // 2  DEF
  "SAT_B_1", // 3  DEF
  "SAT_B_2", // 4  DEF
  "SAT_B_3", // 5  MID
  "SAT_C_1", // 6  MID
  "SAT_C_2", // 7  MID
  "SAT_C_3", // 8  MID
  "SAT_D_1", // 9  ATT
  "SAT_D_2", // 10 ATT
  "SAT_D_3", // 11 finisher
  "SUN_A_1", // 12 finisher
] as const;

let world: World;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(THURSDAY);
  world = await seedWorld();
  authMock.getAuthUserId.mockImplementation(async () => world.userId);
});

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

async function finishFixture(
  providerFixtureId: string,
  homeGoals: number,
  awayGoals: number,
): Promise<void> {
  const fixture = world.db
    .rows("fantasyFixtures")
    .find((f) => f.providerFixtureId === providerFixtureId);
  await world.db.patch(fixture!._id as string, { status: "finished", homeGoals, awayGoals });
}

async function buildSquad(): Promise<string> {
  const { squadId } = (await createSquad(world.ctx, {
    gameweekId: world.gameweekId,
    context: "budget",
    formation: FOUR_FOUR_TWO,
    finisherRoles: [...TWO_ATT_FINISHERS],
  })) as { squadId: string };
  for (const [slotIndex, handle] of SHEET.entries()) {
    await setSlot(world.ctx, { squadId, slotIndex, playerId: world.players[handle] });
  }
  return squadId;
}

function ledgerNow(): Promise<SquadLedger | null> {
  return getSquadLedger(world.ctx, {
    gameweekId: world.gameweekId,
    context: "budget",
  }) as Promise<SquadLedger | null>;
}

/** SAT_A beats SAT_B 2-0; two hand-computed lines land. */
async function scoreSaturdayOne(): Promise<void> {
  await finishFixture("f-sat-1", 2, 0);
  await applyFixtureStats(world.ctx, {
    providerFixtureId: "f-sat-1",
    hasPlayerStats: true,
    hasEvents: true,
    now: AFTER_SATURDAY,
    rows: [
      // GK: appearance 1 + win 1 + saves 3x0.5 + clean sheet 5 = 8.5
      row("SAT_A_1", "SAT_A", "GK", { minutes: 90, saves: 3 }),
      // MID (SAT_B, 0-2 loss): appearance 1 + key passes 3x0.8 = 3.4
      row("SAT_B_3", "SAT_B", "MID", { minutes: 90, keyPasses: 3 }),
    ],
  });
}

const playerEntries = (ledger: SquadLedger, name: string) =>
  ledger.entries.filter((e) => "playerName" in e && e.playerName === name);

describe("getSquadLedger", () => {
  it("is null for a visitor and for a gameweek without a squad", async () => {
    authMock.getAuthUserId.mockImplementation(async () => null);
    expect(await ledgerNow()).toBeNull();

    authMock.getAuthUserId.mockImplementation(async () => world.userId);
    expect(await ledgerNow()).toBeNull(); // no squad yet
  });

  it("narrates a scored fixture with engine terms, and stays silent on awaiting players", async () => {
    await buildSquad();
    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    const ledger = (await ledgerNow())!;
    expect(ledger.state).toBe("provisional");

    // The keeper's entry: 8.5, with the ledger the engine itself derives.
    const gk = playerEntries(ledger, "SAT_A_1");
    const scored = gk.find((e) => e.kind === "scored");
    expect(scored).toBeDefined();
    if (scored?.kind !== "scored") throw new Error("unreachable");
    expect(scored.points).toBe(8.5);
    expect(scored.terms).not.toBeNull();
    const termPoints = scored.terms!.reduce((sum, t) => sum + t.points, 0);
    expect(Math.round(termPoints * 100) / 100).toBe(8.5);
    expect(scored.terms!.map((t) => t.code)).toContain("gk.cleanSheet");

    // SAT_A_3 was fielded but had no line in the scored fixture: N5's honest 0
    // belongs to the score surface. The LEDGER records no event for him —
    // nothing happened TO him.
    expect(playerEntries(ledger, "SAT_A_3")).toHaveLength(0);

    // Sunday's player: fixture unscored — absent, never zero.
    expect(playerEntries(ledger, "SUN_A_1")).toHaveLength(0);

    // Oldest entry is the squad's construction; entries are newest-first.
    expect(ledger.entries[ledger.entries.length - 1].kind).toBe("squad_built");
    for (let i = 1; i < ledger.entries.length; i += 1) {
      expect(ledger.entries[i - 1].at).toBeGreaterThanOrEqual(ledger.entries[i].at);
    }
  });

  it("a revision entry says what changed, honestly (key passes 3→4, +0.8)", async () => {
    await buildSquad();
    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    // The feed corrects the midfielder's key passes: 3 → 4.
    await applyFixtureStats(world.ctx, {
      providerFixtureId: "f-sat-1",
      hasPlayerStats: true,
      hasEvents: true,
      now: LATER,
      rows: [
        row("SAT_A_1", "SAT_A", "GK", { minutes: 90, saves: 3 }),
        row("SAT_B_3", "SAT_B", "MID", { minutes: 90, keyPasses: 4 }),
      ],
    });

    const ledger = (await ledgerNow())!;
    const mid = playerEntries(ledger, "SAT_B_3");
    const revised = mid.find((e) => e.kind === "revised");
    expect(revised).toBeDefined();
    if (revised?.kind !== "revised") throw new Error("unreachable");

    // MID key passes pay 0.8 each: 3.4 → 4.2.
    expect(revised.cause).toBe("stats");
    expect(revised.prevPoints).toBe(3.4);
    expect(revised.points).toBe(4.2);
    expect(revised.changes).not.toBeNull();
    const kp = revised.changes!.find((c) => c.code === "mid.keyPasses");
    expect(kp).toBeDefined();
    expect(kp!.fromCount).toBe(3);
    expect(kp!.toCount).toBe(4);
    expect(Math.round(kp!.pointsDelta * 100) / 100).toBe(0.8);

    // The keeper's line did not change — no revision entry for him.
    expect(
      playerEntries(ledger, "SAT_A_1").filter((e) => e.kind === "revised"),
    ).toHaveLength(0);
  });

  it("degrades to points-only when the stored line no longer re-derives (no invented stories)", async () => {
    await buildSquad();
    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    // The fixture score is corrected AFTER scoring: 2-0 becomes 3-1. The
    // stored version's hash no longer matches a reconstruction, so the entry
    // must refuse to narrate terms rather than derive them from the wrong
    // match context.
    const fixture = world.db
      .rows("fantasyFixtures")
      .find((f) => f.providerFixtureId === "f-sat-1");
    await world.db.patch(fixture!._id as string, { homeGoals: 3, awayGoals: 1 });

    const ledger = (await ledgerNow())!;
    const scored = playerEntries(ledger, "SAT_A_1").find((e) => e.kind === "scored");
    if (scored?.kind !== "scored") throw new Error("unreachable");
    expect(scored.points).toBe(8.5); // the stored number stands
    expect(scored.terms).toBeNull(); // the story does not get invented
  });

  it("records a lock event at the fixture's kickoff once the sweep stamps it", async () => {
    const squadId = await buildSquad();
    const slot = world.db
      .rows("fantasySquadSlots")
      .find((s) => s.squadId === squadId && s.slotIndex === 0);
    await world.db.patch(slot!._id as string, { lockedAt: SATURDAY });

    const ledger = (await ledgerNow())!;
    const locked = playerEntries(ledger, "SAT_A_1").find((e) => e.kind === "locked");
    expect(locked).toBeDefined();
    expect(locked!.at).toBe(SATURDAY);
  });
});

// Type-level guard: the event union stays exhaustive for the frontend switch.
const _exhaustive = (e: SquadLedgerEvent): string => e.kind;
void _exhaustive;
