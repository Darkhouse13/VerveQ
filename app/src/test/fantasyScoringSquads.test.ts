/**
 * Weekend Fantasy FW-4 — squad aggregation and the crew table (P5, P6).
 *
 * Runs the REAL convex/fantasyScores.ts read surfaces on top of the REAL
 * convex/fantasySquads.ts build path and the REAL ingest mutation, against the
 * in-memory harness. The chain under test is the shipped one end to end:
 * build a squad → score its fixtures → read the total.
 *
 * The one thing stubbed rather than driven is the FW-3 draft that PRODUCES a crew
 * squad (crew, member, completed room, materialized sheet). Those rows are
 * inserted directly here, because the draft that writes them has its own suites
 * (fantasyDraftRoomEngine.test.ts drives a full 13-round draft to materialization)
 * and re-driving it would test FW-3 rather than the table.
 *
 * Every expected number is hand-computed from SCORING_SPEC v0.5.1 in the comment
 * above its assertion.
 *
 * FW-4R adds, in this file: N2 (the "final" label derives from the settlement
 * stamp, never from the movable instant) and N5 (a fielded player absent from a
 * SCORED fixture is an honest 0 — "did not appear" — not eternal awaiting).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FOUR_FOUR_TWO,
  SATURDAY,
  SUNDAY,
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
import { emptyStats, type PlayerMatchStats } from "../../convex/lib/fantasyScoring";

const createSquad = handlerOf(fantasySquads.createSquad);
const setSlot = handlerOf(fantasySquads.setSlot);
const applyFixtureStats = handlerOf(fantasyScores.applyFixtureStats);
const getSquadScore = handlerOf(fantasyScores.getSquadScore);
const getCrewTable = handlerOf(fantasyScores.getCrewTable);
const finalizeGameweekChunk = handlerOf(fantasyScores.finalizeGameweekChunk);
const stampSquadFinalTotals = handlerOf(fantasyScores.stampSquadFinalTotals);

const THURSDAY = SATURDAY - 2 * 86_400_000;
const AFTER_SATURDAY = SATURDAY + 3 * 3_600_000;

/** The 13 players, ordered to fill slots 0..12. Five clubs, cap 3 respected. */
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

// ── helpers ──

type FeedRow = {
  providerPlayerId: string;
  clubId: string;
  feedPosition: "GK" | "DEF" | "MID" | "ATT" | null;
  stats: PlayerMatchStats;
  events: { minute: number; kind: string }[];
  entryMinute: number | null;
};

function row(
  providerPlayerId: string,
  clubId: string,
  feedPosition: FeedRow["feedPosition"],
  stats: Partial<PlayerMatchStats>,
): FeedRow {
  return {
    providerPlayerId,
    clubId,
    feedPosition,
    stats: emptyStats(stats),
    events: [],
    entryMinute: null,
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

/** A full 4-4-2 + two ATT finishers, manned from SHEET. */
async function buildSquad(): Promise<string> {
  const { squadId } = (await createSquad(world.ctx, {
    gameweekId: world.gameweekId,
    context: "budget",
    formation: FOUR_FOUR_TWO,
    finisherRoles: [...TWO_ATT_FINISHERS],
  })) as { squadId: string };

  for (const [slotIndex, handle] of SHEET.entries()) {
    await setSlot(world.ctx, {
      squadId,
      slotIndex,
      playerId: world.players[handle],
    });
  }
  return squadId;
}

function squadScoreNow() {
  return getSquadScore(world.ctx, {
    gameweekId: world.gameweekId,
    context: "budget",
  }) as Promise<{
    total: number;
    state: string;
    scoredSlots: number;
    awaitingSlots: number;
    emptySlots: number;
    awaiting: boolean;
    finalizedAt: number | null;
    slots: {
      slotIndex: number;
      slotRole: string;
      isFinisher: boolean;
      state: string;
      points: number | null;
      baseScore: number | null;
      crowdFactor: number | null;
      verdictPosition: string | null;
      mismatch: boolean;
      locked: boolean;
      awaitingReason: string | null;
      zeroReason: string | null;
      rowState: string | null;
      playerName: string | null;
    }[];
  }>;
}

/**
 * Score f-sat-1 with four hand-computed lines. SAT_A is the HOME side and wins
 * 2-0, so SAT_A keeps a clean sheet and SAT_B concedes two.
 */
async function scoreSaturdayOne(): Promise<void> {
  await finishFixture("f-sat-1", 2, 0);
  await applyFixtureStats(world.ctx, {
    providerFixtureId: "f-sat-1",
    hasPlayerStats: true,
    hasEvents: true,
    now: AFTER_SATURDAY,
    rows: [
      // slot 0, fielded GK, verdict GK:
      //   appearance 1 + win 1 + saves 3 x 0.5 = 1.5 + clean sheet 5 = 8.5
      row("SAT_A_1", "SAT_A", "GK", { minutes: 90, saves: 3 }),
      // slot 1, fielded DEF, verdict DEF:
      //   appearance 1 + win 1 + clean sheet 4 + tackles 4 x 0.4 = 1.6 = 7.6
      row("SAT_A_2", "SAT_A", "DEF", { minutes: 90, tackles: 4 }),
      // slot 2, fielded DEF, verdict DEF, did not appear: an honest stored 0
      row("SAT_A_3", "SAT_A", "DEF", { minutes: 0 }),
      // slot 5, fielded MID, verdict GK ⇒ MISMATCH. MID template on a 0-2 loss:
      //   appearance 1 (no clean sheet, no result points, no concession term for
      //   MID) = 1, x0.75 = 0.75
      row("SAT_B_3", "SAT_B", "GK", { minutes: 90 }),
    ],
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("P5 — squad aggregation", () => {
  it("totals only the scored slots, and reports the rest as awaiting", async () => {
    await buildSquad();
    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    const score = await squadScoreNow();

    // 8.5 + 7.6 + 0 + 0.75 = 16.85. The seven slots whose fixtures have not
    // been scored contribute NOTHING — not zero — which is why the total is
    // 16.85 and not "16.85 out of a completed weekend". Slots 3 and 4 (SAT_B_1,
    // SAT_B_2) had their fixture scored WITHOUT a line for them: that is a
    // resolved, honest 0 (N5), so they count as scored and add nothing.
    expect(score.total).toBe(16.85);
    expect(score.scoredSlots).toBe(6);
    expect(score.awaitingSlots).toBe(7);
    expect(score.emptySlots).toBe(0);
    expect(score.awaiting).toBe(true);
    expect(score.state).toBe("provisional");

    const slot = (index: number) => score.slots.find((s) => s.slotIndex === index)!;
    expect(slot(0).points).toBe(8.5);
    expect(slot(1).points).toBe(7.6);
    expect(slot(2).points).toBe(0);
    expect(slot(3).points).toBe(0);
    expect(slot(3).zeroReason).toBe("did not appear");
    expect(slot(5).points).toBe(0.75);
    expect(slot(0).rowState).toBe("provisional");
  });

  it("distinguishes an honest zero from awaiting data, slot by slot", async () => {
    await buildSquad();
    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    const score = await squadScoreNow();
    const zero = score.slots.find((s) => s.slotIndex === 2)!; // played 0 minutes
    const absent = score.slots.find((s) => s.slotIndex === 3)!; // no line in a scored fixture
    const waiting = score.slots.find((s) => s.slotIndex === 6)!; // f-sat-2, unscored

    // The zero is a NUMBER, with a score row behind it.
    expect(zero.state).toBe("scored");
    expect(zero.points).toBe(0);
    expect(zero.awaitingReason).toBeNull();
    expect(zero.zeroReason).toBeNull(); // the row itself explains this 0
    expect(zero.rowState).toBe("provisional");

    // The did-not-appear zero is ALSO a number (N5) — resolved without a row,
    // and `zeroReason` is what says so.
    expect(absent.state).toBe("scored");
    expect(absent.points).toBe(0);
    expect(absent.zeroReason).toBe("did not appear");
    expect(absent.rowState).toBeNull(); // no row behind it
    expect(absent.baseScore).toBeNull();

    // The awaiting slot has NO number at all, and says why.
    expect(waiting.state).toBe("awaiting");
    expect(waiting.points).toBeNull();
    expect(waiting.baseScore).toBeNull();
    expect(waiting.awaitingReason).toBeTruthy();
  });

  it("explains an awaiting slot with the fixture's own situation", async () => {
    await buildSquad();
    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();
    const score = await squadScoreNow();

    // SUN_A_1 (slot 12): his fixture has not kicked off yet.
    expect(score.slots.find((s) => s.slotIndex === 12)!.awaitingReason).toMatch(/scheduled/);

    // SAT_C_1 (slot 6): his fixture is finished but the feed has not been read,
    // so there is no pipeline reason yet — the surface still says something true.
    await finishFixture("f-sat-2", 1, 1);
    const after = await squadScoreNow();
    expect(after.slots.find((s) => s.slotIndex === 6)!.awaitingReason).toMatch(/awaiting data/);
  });

  it("reports an unfilled slot as empty, not as awaiting", async () => {
    const squadId = await buildSquad();
    await setSlot(world.ctx, { squadId, slotIndex: 10, playerId: null });
    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    const score = await squadScoreNow();
    const empty = score.slots.find((s) => s.slotIndex === 10)!;
    expect(empty.state).toBe("empty");
    expect(empty.points).toBeNull();
    expect(score.emptySlots).toBe(1);
    expect(score.awaitingSlots).toBe(6);
    // BUDGET_MODE: "unfilled slots simply score zero" — it costs the total
    // nothing and is not a data failure, so it is not counted as awaiting.
    expect(score.total).toBe(16.85);
  });

  it("honours the FIELDED slot, so re-slotting the same player changes his score", async () => {
    const squadId = await buildSquad();
    // Swap the keeper (slot 0, verdict GK) with a defender (slot 1), before
    // either kicks off — legal, and the §Position mismatch dampener is what makes
    // it cost something. Emptying slot 1 first is not ceremony: setSlot validates
    // after every call, and no intermediate state may hold a player twice.
    await setSlot(world.ctx, { squadId, slotIndex: 1, playerId: null });
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_2 });
    await setSlot(world.ctx, { squadId, slotIndex: 1, playerId: world.players.SAT_A_1 });

    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    const score = await squadScoreNow();

    const keeperInDef = score.slots.find((s) => s.slotIndex === 1)!;
    // The same GK line that scores 8.5 in a GK slot, fielded DEF:
    //   appearance 1 + win 1 + DEF clean sheet 4 = 6, x0.75 = 4.5
    expect(keeperInDef.points).toBe(4.5);
    expect(keeperInDef.mismatch).toBe(true);
    expect(keeperInDef.verdictPosition).toBe("GK");

    const defenderInGoal = score.slots.find((s) => s.slotIndex === 0)!;
    // And the defender (verdict DEF) through the GK template:
    //   appearance 1 + win 1 + GK clean sheet 5 = 7, x0.75 = 5.25
    // He kept no saves, so the GK save term contributes nothing.
    expect(defenderInGoal.points).toBe(5.25);
    expect(defenderInGoal.mismatch).toBe(true);
  });

  it("derives the 'final' label from the settlement stamp — no flicker when the cut moves (N2)", async () => {
    await buildSquad();
    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    const gameweek = world.db.rows("fantasyGameweeks")[0];
    const cut = gameweek.finalityAt as number;
    vi.setSystemTime(cut + 1_000);

    // Past the cut, before the settlement cron: still provisional. The label is
    // allowed to be LATE; it is never allowed to be retractable.
    let score = await squadScoreNow();
    expect(score.state).toBe("provisional");
    expect(score.finalizedAt).toBeNull();

    // FW-2 re-windows the gameweek (a postponed fixture moved the cut a day
    // out). Under the old instant-derived label this is exactly the flicker:
    // final at cut+1s, provisional again now. The stamp-derived label never
    // said final, so there is nothing to revert.
    await world.db.patch(gameweek._id as string, { finalityAt: cut + 86_400_000 });
    score = await squadScoreNow();
    expect(score.state).toBe("provisional");

    // Settle at the NEW cut. Rows flipping alone is not settlement (N3)…
    const newCut = cut + 86_400_000 + 1_000;
    vi.setSystemTime(newCut);
    await finalizeGameweekChunk(world.ctx, { gameweekId: world.gameweekId, now: newCut });
    score = await squadScoreNow();
    expect(score.slots.find((s) => s.slotIndex === 0)!.rowState).toBe("final");
    expect(score.state).toBe("provisional");

    // …the squad stamps completing is, and only then does the label flip.
    await stampSquadFinalTotals(world.ctx, { gameweekId: world.gameweekId, now: newCut });
    score = await squadScoreNow();
    expect(score.state).toBe("final");
    expect(score.finalizedAt).toBe(newCut);
    expect(score.total).toBe(16.85); // unchanged by settling

    // And once stamped, a cut moving again cannot un-say it.
    await world.db.patch(gameweek._id as string, { finalityAt: newCut + 86_400_000 });
    score = await squadScoreNow();
    expect(score.state).toBe("final");
  });

  it("stamps the settled weekend total on the squad, once", async () => {
    const squadId = await buildSquad();
    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();
    const gameweek = world.db.rows("fantasyGameweeks")[0];
    const cut = (gameweek.finalityAt as number) + 1_000;

    const early = (await stampSquadFinalTotals(world.ctx, {
      gameweekId: world.gameweekId,
      now: (gameweek.finalityAt as number) - 1,
    })) as { eligible: boolean; stamped: number };
    expect(early.eligible).toBe(false);
    expect(early.stamped).toBe(0);

    const stamped = (await stampSquadFinalTotals(world.ctx, {
      gameweekId: world.gameweekId,
      now: cut,
    })) as { stamped: number; done: boolean };
    expect(stamped.stamped).toBe(1);
    expect(stamped.done).toBe(true);

    const squad = (await world.db.get(squadId))!;
    expect(squad.finalScore).toEqual({
      total: 16.85,
      scoredSlots: 6, // the two did-not-appear zeros count as resolved (N5)
      awaitingSlots: 7,
      emptySlots: 0,
      at: cut,
    });

    const again = (await stampSquadFinalTotals(world.ctx, {
      gameweekId: world.gameweekId,
      now: cut + 60_000,
    })) as { stamped: number; alreadyStamped: number };
    expect(again.stamped).toBe(0);
    expect(again.alreadyStamped).toBe(1);
    expect((await world.db.get(squadId))!.finalScore).toEqual(squad.finalScore);
  });

  it("resolves a fielded player absent from a scored fixture — the eternal-awaiting scenario (N5)", async () => {
    await buildSquad();
    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    // SAT_B_1 (slot 3) is fielded; f-sat-1 IS scored; the feed carried no line
    // for him — he was not in the matchday squad. Nothing will ever produce his
    // row, so before FW-4R he read "awaiting data" forever and his squad never
    // stopped being incomplete. Now he is a resolved, honest 0.
    let score = await squadScoreNow();
    const absent = score.slots.find((s) => s.slotIndex === 3)!;
    expect(absent.state).toBe("scored");
    expect(absent.points).toBe(0);
    expect(absent.zeroReason).toBe("did not appear");
    expect(score.awaiting).toBe(true); // f-sat-2 and f-sun-1 are still unscored

    // Score the remaining fixtures with lines for NO fielded player at all —
    // the hardest case: every remaining slot must resolve as did-not-appear.
    await finishFixture("f-sat-2", 1, 1);
    await applyFixtureStats(world.ctx, {
      providerFixtureId: "f-sat-2",
      hasPlayerStats: true,
      hasEvents: true,
      now: AFTER_SATURDAY,
      rows: [row("SAT_C_4", "SAT_C", "MID", { minutes: 90 })],
    });
    await finishFixture("f-sun-1", 0, 0);
    await applyFixtureStats(world.ctx, {
      providerFixtureId: "f-sun-1",
      hasPlayerStats: true,
      hasEvents: true,
      now: SUNDAY + 3 * 3_600_000,
      rows: [row("SUN_B_1", "SUN_B", "GK", { minutes: 90 })],
    });

    vi.setSystemTime(SUNDAY + 3 * 3_600_000);
    score = await squadScoreNow();
    // Every fixture this squad fields a player in is scored: the awaiting flag
    // clears, absentees included, and the nine did-not-appear slots add nothing.
    expect(score.scoredSlots).toBe(13);
    expect(score.awaitingSlots).toBe(0);
    expect(score.awaiting).toBe(false);
    expect(score.total).toBe(16.85);

    // Settlement then stamps a COMPLETE record — awaitingSlots 0 — so the crew
    // table's provisional flag has nothing to hang on either.
    const gameweek = world.db.rows("fantasyGameweeks")[0];
    const cut = (gameweek.finalityAt as number) + 1_000;
    await finalizeGameweekChunk(world.ctx, { gameweekId: world.gameweekId, now: cut });
    await stampSquadFinalTotals(world.ctx, { gameweekId: world.gameweekId, now: cut });
    const squad = world.db.rows("fantasySquads")[0];
    expect(squad.finalScore).toEqual({
      total: 16.85,
      scoredSlots: 13,
      awaitingSlots: 0,
      emptySlots: 0,
      at: cut,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("P6 — the crew table", () => {
  const CODE = "CREW01";

  /**
   * A crew with a completed room for the seeded gameweek, and a manned sheet for
   * each member. Stands in for FW-3's draft, which produces exactly these rows
   * and has its own suites.
   */
  async function seedCrew(members: string[]): Promise<{ crewId: string; roomId: string }> {
    const crewId = await world.db.insert("fantasyCrews", {
      code: CODE,
      name: "Test Crew",
      createdBy: world.userId,
      createdAt: THURSDAY,
    });
    for (const userId of members) {
      await world.db.insert("fantasyCrewMembers", {
        crewId,
        userId,
        nameSnapshot: `player-${userId}`,
        active: true,
        joinedAt: THURSDAY,
      });
    }
    const roomId = await world.db.insert("fantasyDraftRooms", {
      crewId,
      gameweekId: world.gameweekId,
      status: "completed",
      createdBy: world.userId,
      createdAt: THURSDAY,
      seats: members.map((userId) => ({
        userId,
        nameSnapshot: `player-${userId}`,
        ready: true,
        joinedAt: THURSDAY,
        bankMs: 390_000,
      })),
      expiresAt: THURSDAY + 3_600_000,
      completedAt: THURSDAY + 60_000,
    });
    return { crewId, roomId };
  }

  /** One crew sheet: 13 slots, manned from `handles`. */
  async function seedCrewSheet(
    userId: string,
    roomId: string,
    handles: readonly string[],
  ): Promise<string> {
    const squadId = await world.db.insert("fantasySquads", {
      userId,
      gameweekId: world.gameweekId,
      context: "crew",
      crewRoomId: roomId,
      contextKey: `crew:${roomId}`,
      favoriteClubAtBuild: null,
      createdAt: THURSDAY,
      arrangedByUser: false,
    });
    const roles = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "ATT", "ATT"];
    for (let slotIndex = 0; slotIndex < 13; slotIndex += 1) {
      await world.db.insert("fantasySquadSlots", {
        squadId,
        slotIndex,
        playerId: world.players[handles[slotIndex]],
        slotRole: slotIndex < 11 ? roles[slotIndex] : "ATT",
        isFinisher: slotIndex >= 11,
      });
    }
    return squadId;
  }

  function crewTable() {
    return getCrewTable(world.ctx, { code: CODE }) as Promise<{
      rows: {
        userId: string;
        name: string;
        cumulativePoints: number | null;
        scoredWeekends: number;
        awaitingWeekends: number;
        provisional: boolean;
        rank: number;
        tied: boolean;
        weekends: { gwNumber: number; points: number | null; state: string; settled: boolean }[];
      }[];
      weekends: { gwNumber: number; anyScored: boolean }[];
      tieBreaksApplied: boolean;
    } | null>;
  }

  it("refuses a non-member, and returns nothing for an unknown code", async () => {
    const stranger = await world.db.insert("users", { username: "stranger" });
    await seedCrew([world.userId]);
    authMock.getAuthUserId.mockImplementation(async () => stranger);
    expect(await crewTable()).toBeNull();
  });

  it("carries real cumulative points, and never a zero for a scoreless weekend", async () => {
    const other = await world.db.insert("users", { username: "other" });
    const { roomId } = await seedCrew([world.userId, other]);
    // Mine holds the two scoring SAT_A players; theirs holds nobody whose
    // fixture has even been scored — all of it is f-sat-2 or f-sun-1, both
    // unscored. (No f-sat-1 club player: under N5 a player absent from a SCORED
    // fixture is a resolved 0, which would make their weekend a number.)
    await seedCrewSheet(world.userId, roomId, SHEET);
    await seedCrewSheet(other, roomId, [
      "SUN_A_1", "SUN_A_2", "SUN_A_3", "SUN_B_1", "SUN_B_2", "SUN_B_3",
      "SAT_C_4", "SAT_C_5", "SAT_C_6", "SAT_D_4", "SAT_D_5", "SAT_D_6", "SUN_A_4",
    ]);

    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    const table = (await crewTable())!;
    expect(table.tieBreaksApplied).toBe(false);
    expect(table.weekends).toHaveLength(1);
    expect(table.weekends[0].anyScored).toBe(true);

    const mine = table.rows.find((r) => r.userId === world.userId)!;
    const theirs = table.rows.find((r) => r.userId === other)!;

    // Mine: the same 16.85 the squad view reports, from the same rows.
    expect(mine.cumulativePoints).toBe(16.85);
    expect(mine.rank).toBe(1);
    expect(mine.provisional).toBe(true);
    expect(mine.weekends[0].points).toBe(16.85);
    expect(mine.weekends[0].settled).toBe(false);

    // Theirs: nothing of their sheet has been scored. That is NOT 0 points —
    // rendering it as 0 would tell them they had a terrible weekend when in fact
    // their weekend has not been counted (R7).
    expect(theirs.cumulativePoints).toBeNull();
    expect(theirs.scoredWeekends).toBe(0);
    expect(theirs.awaitingWeekends).toBe(1);
    // …and it sorts last rather than alongside a genuine zero.
    expect(table.rows[table.rows.length - 1].userId).toBe(other);
  });

  it("sums a settled weekend from the stamped total and shows a tie as tied", async () => {
    const other = await world.db.insert("users", { username: "other" });
    const { crewId, roomId } = await seedCrew([world.userId, other]);
    await seedCrewSheet(world.userId, roomId, SHEET);
    await seedCrewSheet(other, roomId, SHEET);

    // A second, already-settled weekend: its totals are read from the squads'
    // stamped `finalScore`, which is what keeps the table O(members) rather than
    // O(members x weekends x slots).
    const priorGameweekId = await world.db.insert("fantasyGameweeks", {
      season: "2026-2027",
      gwNumber: 2,
      leagueIds: [39],
      status: "final",
      finalityAt: THURSDAY - 86_400_000,
    });
    // A settled gameweek carries the settlement stamp — the fact every "final"
    // label derives from (N2).
    await world.db.insert("fantasyGameweekScoring", {
      gameweekId: priorGameweekId,
      state: "final",
      fixturesTotal: 0,
      fixturesScored: 0,
      finalizedAt: THURSDAY - 86_400_000,
    });
    const priorRoomId = await world.db.insert("fantasyDraftRooms", {
      crewId,
      gameweekId: priorGameweekId,
      status: "completed",
      createdBy: world.userId,
      createdAt: THURSDAY - 7 * 86_400_000,
      seats: [],
      expiresAt: THURSDAY,
    });
    for (const [userId, total] of [
      [world.userId, 12.5],
      [other, 20],
    ] as const) {
      await world.db.insert("fantasySquads", {
        userId,
        gameweekId: priorGameweekId,
        context: "crew",
        crewRoomId: priorRoomId,
        contextKey: `crew:${priorRoomId}`,
        favoriteClubAtBuild: null,
        createdAt: THURSDAY - 7 * 86_400_000,
        finalScore: { total, scoredSlots: 13, awaitingSlots: 0, emptySlots: 0, at: THURSDAY },
      });
    }

    vi.setSystemTime(AFTER_SATURDAY);
    await scoreSaturdayOne();

    const table = (await crewTable())!;
    const mine = table.rows.find((r) => r.userId === world.userId)!;
    const theirs = table.rows.find((r) => r.userId === other)!;

    // Identical sheets score identically this weekend (16.85 each), so the table
    // is decided by the settled one: 20 + 16.85 = 36.85 vs 12.5 + 16.85 = 29.35.
    expect(theirs.cumulativePoints).toBe(36.85);
    expect(mine.cumulativePoints).toBe(29.35);
    expect(theirs.rank).toBe(1);
    expect(mine.rank).toBe(2);
    expect(theirs.tied).toBe(false);
    expect(theirs.weekends.find((w) => w.gwNumber === 2)!.settled).toBe(true);

    // Now make it a dead heat and check the tie is DISPLAYED, not broken: the
    // ladders are ruled but deferred (DRAFT_ROOM_SPEC v1.2.0).
    const mySquad = world.db
      .rows("fantasySquads")
      .find((s) => s.userId === world.userId && s.gameweekId === priorGameweekId)!;
    await world.db.patch(mySquad._id as string, {
      finalScore: { total: 20, scoredSlots: 13, awaitingSlots: 0, emptySlots: 0, at: THURSDAY },
    });

    const tiedTable = (await crewTable())!;
    expect(tiedTable.rows.map((r) => r.cumulativePoints)).toEqual([36.85, 36.85]);
    expect(tiedTable.rows.map((r) => r.rank)).toEqual([1, 1]);
    expect(tiedTable.rows.every((r) => r.tied)).toBe(true);
    expect(tiedTable.tieBreaksApplied).toBe(false);
  });

  it("skips a room that is still drafting — there are no sheets to score", async () => {
    const { crewId } = await seedCrew([world.userId]);
    await world.db.insert("fantasyDraftRooms", {
      crewId,
      gameweekId: world.gameweekId,
      status: "drafting",
      createdBy: world.userId,
      createdAt: THURSDAY,
      seats: [],
      expiresAt: THURSDAY + 3_600_000,
    });
    const table = (await crewTable())!;
    expect(table.weekends).toHaveLength(1); // the completed room only
  });
});
