/**
 * Weekend Fantasy FW-1 — the lock engine, at the handler level.
 *
 * Runs the REAL convex/fantasySquads.ts and convex/fantasyLocks.ts handlers
 * against the in-memory harness (test/support/fantasyFakeConvex.ts), with the
 * real pure rule modules underneath. Only the database and the auth check are
 * faked, so what passes here is the shipped engine.
 *
 * Covers the ticket's required cases: the lock boundary either side of
 * kickoff, the budget invariant across a partial lock (Saturday locked, Sunday
 * edited), the club cap with and without the favorite exemption, the favorite
 * cooldown end to end, a formation change that would orphan a locked slot, and
 * the finisher-count invariant. Plus lockSweep idempotency and late-run safety.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import * as fantasyLocks from "../../convex/fantasyLocks";
import {
  PLAYER_ALREADY_STARTED,
  SLOT_LOCKED,
} from "../../convex/fantasySquads";
import { SQUAD_BUDGET } from "../../convex/lib/fantasyConstants";

const createSquad = handlerOf(fantasySquads.createSquad);
const setSlot = handlerOf(fantasySquads.setSlot);
const setFormation = handlerOf(fantasySquads.setFormation);
const setFavoriteClub = handlerOf(fantasySquads.setFavoriteClub);
const getSquad = handlerOf(fantasySquads.getSquad);
const lockSweep = handlerOf(fantasyLocks.lockSweep);

const THURSDAY = SATURDAY - 2 * 86_400_000;

let world: World;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(THURSDAY);
  world = await seedWorld();
  authMock.getAuthUserId.mockImplementation(async () => world.userId);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── helpers ──

async function newBudgetSquad(): Promise<string> {
  const { squadId } = (await createSquad(world.ctx, {
    gameweekId: world.gameweekId,
    context: "budget",
    formation: FOUR_FOUR_TWO,
    finisherRoles: [...TWO_ATT_FINISHERS],
  })) as { squadId: string };
  return squadId;
}

/** Set a player's price directly, bypassing the (non-existent) pricing pass. */
async function setPrice(handle: string, price: number | null): Promise<void> {
  await world.db.patch(world.players[handle], { price });
}

async function slotsOf(squadId: string) {
  const rows = world.db.rows("fantasySquadSlots").filter((r) => r.squadId === squadId);
  return rows.sort((a, b) => (a.slotIndex as number) - (b.slotIndex as number));
}

/**
 * Fill all 13 slots legally: three players each from SAT_A, SAT_B, SUN_A and
 * SUN_B, then one from SAT_C — 13 players, no club over the cap of 3.
 */
async function fillSquad(squadId: string): Promise<string[]> {
  const handles = [
    ...["SAT_A_1", "SAT_A_2", "SAT_A_3"],
    ...["SAT_B_1", "SAT_B_2", "SAT_B_3"],
    ...["SUN_A_1", "SUN_A_2", "SUN_A_3"],
    ...["SUN_B_1", "SUN_B_2", "SUN_B_3"],
    "SAT_C_1",
  ];
  for (const [index, handle] of handles.entries()) {
    await setSlot(world.ctx, {
      squadId,
      slotIndex: index,
      playerId: world.players[handle],
    });
  }
  return handles;
}

// ── lock boundary ──

describe("lock boundary — a slot is mutable iff its fixture kickoff is in the future", () => {
  it("allows an edit at kickoff minus 1 second", async () => {
    const squadId = await newBudgetSquad();
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_1 });

    vi.setSystemTime(SATURDAY - 1000);
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_2 }),
    ).resolves.toEqual({ ok: true });

    const slots = await slotsOf(squadId);
    expect(slots[0].playerId).toBe(world.players.SAT_A_2);
  });

  it("rejects an edit at kickoff plus 1 second", async () => {
    const squadId = await newBudgetSquad();
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_1 });

    vi.setSystemTime(SATURDAY + 1000);
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_2 }),
    ).rejects.toThrow(SLOT_LOCKED);

    const slots = await slotsOf(squadId);
    expect(slots[0].playerId).toBe(world.players.SAT_A_1); // unchanged
  });

  it("locks at exactly kickoff — the whistle belongs to the match", async () => {
    const squadId = await newBudgetSquad();
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_1 });

    vi.setSystemTime(SATURDAY);
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_2 }),
    ).rejects.toThrow(SLOT_LOCKED);
  });

  it("rejects the edit WITHOUT any sweep having run — live fixture data is the authority", async () => {
    const squadId = await newBudgetSquad();
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_1 });

    vi.setSystemTime(SATURDAY + 1000);
    const slots = await slotsOf(squadId);
    expect(slots[0].lockedAt).toBeUndefined(); // nothing stamped it

    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_2 }),
    ).rejects.toThrow(SLOT_LOCKED);
  });

  it("keeps a Sunday slot editable while Saturday is locked", async () => {
    const squadId = await newBudgetSquad();
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_1 });
    await setSlot(world.ctx, { squadId, slotIndex: 1, playerId: world.players.SUN_A_1 });

    vi.setSystemTime(SATURDAY + 3_600_000);
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 1, playerId: world.players.SUN_A_2 }),
    ).resolves.toEqual({ ok: true });
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_2 }),
    ).rejects.toThrow(SLOT_LOCKED);
  });

  it("rejects selecting a player whose own match has already kicked off", async () => {
    const squadId = await newBudgetSquad();
    vi.setSystemTime(SATURDAY + 1000);

    // Slot 5 is empty and therefore unlocked, but SAT_A_1 is already playing.
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 5, playerId: world.players.SAT_A_1 }),
    ).rejects.toThrow(PLAYER_ALREADY_STARTED);
  });

  it("leaves an unfilled slot editable all weekend — it simply scores zero", async () => {
    const squadId = await newBudgetSquad();
    vi.setSystemTime(SUNDAY - 1000);
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 7, playerId: world.players.SUN_A_1 }),
    ).resolves.toEqual({ ok: true });
  });
});

// ── budget invariant across a partial lock ──

describe("budget invariant across a partial lock (BUDGET_MODE §Deadlines & editing)", () => {
  it("prices locked Saturday slots at their committed cost while Sunday is edited", async () => {
    const squadId = await newBudgetSquad();
    // Saturday keeper at 5.0; the rest cheap so the squad has headroom.
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_1 });
    await setSlot(world.ctx, { squadId, slotIndex: 1, playerId: world.players.SUN_A_1 });

    vi.setSystemTime(SATURDAY + 1000);
    await lockSweep(world.ctx, { gameweekId: world.gameweekId });

    const afterSweep = await slotsOf(squadId);
    expect(afterSweep[0].lockedAt).toBe(SATURDAY);
    expect(afterSweep[0].committedPrice).toBe(5.0);
    expect(afterSweep[1].lockedAt).toBeUndefined();

    // The Saturday player's price is now irrelevant to the invariant: raise it
    // to something unaffordable and the Sunday edit still succeeds, because
    // the locked slot is priced at its COMMITTED 5.0.
    await setPrice("SAT_A_1", 500);
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 1, playerId: world.players.SUN_A_2 }),
    ).resolves.toEqual({ ok: true });
  });

  it("counts committed cost against the budget when editing an unlocked slot", async () => {
    const squadId = await newBudgetSquad();
    // Spend all but 1.0 of the budget on the Saturday slot, then lock it. Stated
    // against SQUAD_BUDGET rather than the number of the day: what is under test
    // is that committed cost counts, not what the budget happens to be.
    const remaining = 1.0;
    await setPrice("SAT_A_1", SQUAD_BUDGET - remaining);
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_1 });

    vi.setSystemTime(SATURDAY + 1000);
    await lockSweep(world.ctx, { gameweekId: world.gameweekId });

    // A Sunday pick that overshoots what is left goes over the budget ⇒ rejected…
    await setPrice("SUN_A_1", remaining + 1.0);
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 1, playerId: world.players.SUN_A_1 }),
    ).rejects.toThrow(/budget/i);

    // …while one that lands exactly on the budget is accepted.
    await setPrice("SUN_A_2", remaining);
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 1, playerId: world.players.SUN_A_2 }),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects an unpriced player in budget context and accepts him in crew context", async () => {
    await setPrice("SUN_A_1", null);

    const budgetSquad = await newBudgetSquad();
    await expect(
      setSlot(world.ctx, { squadId: budgetSquad, slotIndex: 0, playerId: world.players.SUN_A_1 }),
    ).rejects.toThrow(/no editorial price/i);

    const { squadId: crewSquad } = (await createSquad(world.ctx, {
      gameweekId: world.gameweekId,
      context: "crew",
      crewRoomId: "room-1",
      formation: FOUR_FOUR_TWO,
      finisherRoles: [...TWO_ATT_FINISHERS],
    })) as { squadId: string };

    await expect(
      setSlot(world.ctx, { squadId: crewSquad, slotIndex: 0, playerId: world.players.SUN_A_1 }),
    ).resolves.toEqual({ ok: true });
  });
});

// ── club cap ──

describe("per-club cap and the favorite-club exemption, end to end", () => {
  it("rejects a 4th player from a non-favorite club", async () => {
    const squadId = await newBudgetSquad();
    for (const [i, handle] of ["SAT_A_1", "SAT_A_2", "SAT_A_3"].entries()) {
      await setSlot(world.ctx, { squadId, slotIndex: i, playerId: world.players[handle] });
    }
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 3, playerId: world.players.SAT_A_4 }),
    ).rejects.toThrow(/At most 3 players from one club/);
  });

  it("allows a 4th when that club is the favorite in force at build time", async () => {
    await setFavoriteClub(world.ctx, { clubId: "SAT_A" });
    const squadId = await newBudgetSquad();

    const squad = world.db.rows("fantasySquads").find((r) => r._id === squadId);
    expect(squad?.favoriteClubAtBuild).toBe("SAT_A");

    for (const [i, handle] of ["SAT_A_1", "SAT_A_2", "SAT_A_3", "SAT_A_4"].entries()) {
      await expect(
        setSlot(world.ctx, { squadId, slotIndex: i, playerId: world.players[handle] }),
      ).resolves.toEqual({ ok: true });
    }
  });

  it("uses the snapshot, not the live user doc — a later favorite change cannot legalize a squad", async () => {
    const squadId = await newBudgetSquad(); // built with no favorite
    for (const [i, handle] of ["SAT_A_1", "SAT_A_2", "SAT_A_3"].entries()) {
      await setSlot(world.ctx, { squadId, slotIndex: i, playerId: world.players[handle] });
    }

    // Setting SAT_A as favorite now applies immediately at profile level…
    await setFavoriteClub(world.ctx, { clubId: "SAT_A" });
    // …but this squad was built before it, so its snapshot is still null.
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 3, playerId: world.players.SAT_A_4 }),
    ).rejects.toThrow(/At most 3 players from one club/);
  });
});

// ── favorite cooldown, end to end ──

describe("favorite-club cooldown, end to end (DRAFT_ROOM v1.0.2 ledger 7 / STOP-F)", () => {
  const DAY = 86_400_000;

  async function gameweek(gwNumber: number): Promise<string> {
    return await world.db.insert("fantasyGameweeks", {
      season: "2026-2027",
      gwNumber,
      leagueIds: [39],
      status: "upcoming",
      finalityAt: SUNDAY,
    });
  }

  /**
   * The cooldown is wall-clock time and the handler reads `Date.now()`, so
   * these tests MOVE the clock rather than incrementing a gameweek number.
   * That is the whole point of STOP-F: the gameweek a squad belongs to no
   * longer has any bearing on whether a favorite change has landed.
   *
   * The clock is already faked by `beforeEach` (pinned to THURSDAY) and
   * restored by `afterEach`. These tests only call `setSystemTime` — installing
   * and tearing down their own fake timers would disable the harness's clock
   * for whatever ran next in the file.
   */
  it("leaves the old club in force for 28 days, then lands", async () => {
    const t0 = THURSDAY;

    await setFavoriteClub(world.ctx, { clubId: "SAT_A" });
    const result = (await setFavoriteClub(world.ctx, { clubId: "SAT_B" })) as {
      inForce: string;
      pending: string;
      effectiveFrom: number;
    };

    expect(result).toMatchObject({
      inForce: "SAT_A",
      pending: "SAT_B",
      effectiveFrom: t0 + 28 * DAY,
    });

    // Day 27 — still the OLD club, regardless of which gameweek we build in.
    vi.setSystemTime(t0 + 27 * DAY);
    const early = await gameweek(6);
    const { squadId: sixth } = (await createSquad(world.ctx, {
      gameweekId: early,
      context: "budget",
      formation: FOUR_FOUR_TWO,
      finisherRoles: [...TWO_ATT_FINISHERS],
    })) as { squadId: string };
    expect(
      world.db.rows("fantasySquads").find((r) => r._id === sixth)?.favoriteClubAtBuild,
    ).toBe("SAT_A");

    // Day 28 — the change has landed.
    vi.setSystemTime(t0 + 28 * DAY);
    const late = await gameweek(7);
    const { squadId: seventh } = (await createSquad(world.ctx, {
      gameweekId: late,
      context: "budget",
      formation: FOUR_FOUR_TWO,
      finisherRoles: [...TWO_ATT_FINISHERS],
    })) as { squadId: string };
    expect(
      world.db.rows("fantasySquads").find((r) => r._id === seventh)?.favoriteClubAtBuild,
    ).toBe("SAT_B");
  });

  it("does not land early just because many gameweeks have passed", async () => {
    // The regression STOP-F exists to prevent: under the old 4-gameweek rule a
    // congested fortnight (weekend + midweek + weekend + midweek) satisfied the
    // cooldown in about 14 days. Elapsed time is now the only thing that counts.
    const t0 = THURSDAY;

    await setFavoriteClub(world.ctx, { clubId: "SAT_A" });
    await setFavoriteClub(world.ctx, { clubId: "SAT_B" });

    vi.setSystemTime(t0 + 14 * DAY);
    for (const gwNumber of [4, 5, 6, 7]) await gameweek(gwNumber);
    const gw = await gameweek(8);
    const { squadId } = (await createSquad(world.ctx, {
      gameweekId: gw,
      context: "budget",
      formation: FOUR_FOUR_TWO,
      finisherRoles: [...TWO_ATT_FINISHERS],
    })) as { squadId: string };
    expect(
      world.db.rows("fantasySquads").find((r) => r._id === squadId)?.favoriteClubAtBuild,
    ).toBe("SAT_A");
  });
});

// ── formation ──

describe("formation changes", () => {
  const rolesFor = (formation: Record<string, number>, finishers: string[]) => {
    const slots: Array<{ slotIndex: number; slotRole: string; isFinisher: boolean }> = [];
    let index = 0;
    for (const role of ["GK", "DEF", "MID", "ATT"]) {
      for (let i = 0; i < (formation[role] ?? 0); i += 1) {
        slots.push({ slotIndex: index++, slotRole: role, isFinisher: false });
      }
    }
    for (const role of finishers) {
      slots.push({ slotIndex: index++, slotRole: role, isFinisher: true });
    }
    return slots;
  };

  it("accepts a legal reshape while nothing is locked", async () => {
    const squadId = await newBudgetSquad();
    await expect(
      setFormation(world.ctx, {
        squadId,
        slots: rolesFor({ GK: 1, DEF: 3, MID: 5, ATT: 2 }, ["ATT", "ATT"]),
      }),
    ).resolves.toEqual({ ok: true });

    const slots = await slotsOf(squadId);
    expect(slots.filter((s) => !s.isFinisher && s.slotRole === "DEF")).toHaveLength(3);
    expect(slots.filter((s) => !s.isFinisher && s.slotRole === "MID")).toHaveLength(5);
  });

  it("rejects a reshape that would re-role a LOCKED slot (orphaning it)", async () => {
    const squadId = await newBudgetSquad();
    // Slot 4 is the last DEF in 4-4-2; fill it with a Saturday player.
    await setSlot(world.ctx, { squadId, slotIndex: 4, playerId: world.players.SAT_A_1 });

    vi.setSystemTime(SATURDAY + 1000);

    // 4-4-2 -> 3-5-2 turns slot 4 from DEF into MID. Slot 4 is locked, so the
    // whole reshape is refused rather than partially applied.
    await expect(
      setFormation(world.ctx, {
        squadId,
        slots: rolesFor({ GK: 1, DEF: 3, MID: 5, ATT: 2 }, ["ATT", "ATT"]),
      }),
    ).rejects.toThrow(SLOT_LOCKED);

    const slots = await slotsOf(squadId);
    expect(slots[4].slotRole).toBe("DEF"); // nothing moved
    expect(slots.filter((s) => !s.isFinisher && s.slotRole === "MID")).toHaveLength(4);
  });

  it("allows a reshape that leaves every locked slot's role untouched", async () => {
    const squadId = await newBudgetSquad();
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_1 }); // GK

    vi.setSystemTime(SATURDAY + 1000);

    // The keeper stays a GK in every legal shape, so moving DEF/MID around is fine.
    await expect(
      setFormation(world.ctx, {
        squadId,
        slots: rolesFor({ GK: 1, DEF: 3, MID: 5, ATT: 2 }, ["ATT", "ATT"]),
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects an illegal target shape", async () => {
    const squadId = await newBudgetSquad();
    await expect(
      setFormation(world.ctx, {
        squadId,
        slots: rolesFor({ GK: 1, DEF: 6, MID: 3, ATT: 1 }, ["ATT", "ATT"]),
      }),
    ).rejects.toThrow(/3–5 DEF/);
  });
});

// ── finisher invariant ──

describe("finisher-count invariant", () => {
  it("rejects promoting a third slot to finisher", async () => {
    const squadId = await newBudgetSquad();
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 0, isFinisher: true }),
    ).rejects.toThrow(/exactly 2 finishers/);
  });

  it("rejects demoting a finisher, which would leave only one", async () => {
    const squadId = await newBudgetSquad();
    await expect(
      setSlot(world.ctx, { squadId, slotIndex: 12, isFinisher: false }),
    ).rejects.toThrow(/exactly 2 finishers/);
  });

  it("allows swapping a starter and a finisher in one atomic reshape", async () => {
    const squadId = await newBudgetSquad();
    const slots = (await slotsOf(squadId)).map((s) => ({
      slotIndex: s.slotIndex as number,
      slotRole: s.slotRole as string,
      isFinisher: s.slotIndex === 10 ? true : s.slotIndex === 12 ? false : (s.isFinisher as boolean),
    }));
    await expect(setFormation(world.ctx, { squadId, slots })).resolves.toEqual({ ok: true });

    // Slot 10 was promoted, slot 12 demoted; slot 11 was already a finisher.
    // The XI is now slots 0–9 plus 12, still a legal 4-4-2.
    const after = await slotsOf(squadId);
    expect(after.filter((s) => s.isFinisher).map((s) => s.slotIndex)).toEqual([10, 11]);
  });

  it("keeps exactly 13 slots and 2 finishers on a fresh squad", async () => {
    const squadId = await newBudgetSquad();
    const slots = await slotsOf(squadId);
    expect(slots).toHaveLength(13);
    expect(slots.filter((s) => s.isFinisher)).toHaveLength(2);
    expect(slots.map((s) => s.slotIndex)).toEqual([...Array(13).keys()]);
  });
});

// ── lockSweep ──

describe("lockSweep is idempotent and late-safe", () => {
  it("stamps lockedAt with the FIXTURE kickoff, not the sweep's own clock", async () => {
    const squadId = await newBudgetSquad();
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_1 });

    // Run it three hours late.
    vi.setSystemTime(SATURDAY + 3 * 3_600_000);
    await lockSweep(world.ctx, {});

    const slots = await slotsOf(squadId);
    expect(slots[0].lockedAt).toBe(SATURDAY);
    expect(slots[0].committedPrice).toBe(5.0);
  });

  it("writes nothing on a second run — byte-identical rows", async () => {
    const squadId = await newBudgetSquad();
    await fillSquad(squadId);

    vi.setSystemTime(SATURDAY + 1000);
    const first = (await lockSweep(world.ctx, {})) as { stamped: number };
    const afterFirst = JSON.stringify(await slotsOf(squadId));

    const second = (await lockSweep(world.ctx, {})) as { stamped: number };
    const afterSecond = JSON.stringify(await slotsOf(squadId));

    expect(first.stamped).toBeGreaterThan(0);
    expect(second.stamped).toBe(0);
    expect(afterSecond).toBe(afterFirst);
  });

  it("produces the same rows whether run on time or hours late", async () => {
    const punctualSquad = await newBudgetSquad();
    await setSlot(world.ctx, {
      squadId: punctualSquad,
      slotIndex: 0,
      playerId: world.players.SAT_A_1,
    });
    vi.setSystemTime(SATURDAY + 1000);
    await lockSweep(world.ctx, {});
    const punctual = await slotsOf(punctualSquad);

    // A second world, swept only on Sunday.
    const late = await seedWorld();
    authMock.getAuthUserId.mockImplementation(async () => late.userId);
    vi.setSystemTime(SATURDAY - 86_400_000);
    const { squadId: lateSquad } = (await createSquad(late.ctx, {
      gameweekId: late.gameweekId,
      context: "budget",
      formation: FOUR_FOUR_TWO,
      finisherRoles: [...TWO_ATT_FINISHERS],
    })) as { squadId: string };
    await setSlot(late.ctx, {
      squadId: lateSquad,
      slotIndex: 0,
      playerId: late.players.SAT_A_1,
    });
    vi.setSystemTime(SUNDAY + 6 * 3_600_000);
    await lockSweep(late.ctx, {});

    const lateSlots = late.db
      .rows("fantasySquadSlots")
      .filter((r) => r.squadId === lateSquad)
      .sort((a, b) => (a.slotIndex as number) - (b.slotIndex as number));

    expect(lateSlots[0].lockedAt).toBe(punctual[0].lockedAt);
    expect(lateSlots[0].committedPrice).toBe(punctual[0].committedPrice);
  });

  it("stamps Saturday slots and leaves Sunday slots alone", async () => {
    const squadId = await newBudgetSquad();
    await fillSquad(squadId);

    vi.setSystemTime(SATURDAY + 1000);
    await lockSweep(world.ctx, {});

    const slots = await slotsOf(squadId);
    const stamped = slots.filter((s) => s.lockedAt !== undefined);
    const open = slots.filter((s) => s.lockedAt === undefined);

    // 6 Saturday players (3 SAT_A + 3 SAT_B) + 1 SAT_C = 7 stamped.
    expect(stamped).toHaveLength(7);
    // 6 Sunday players + 0 unfilled (all 13 filled) = 6 open.
    expect(open).toHaveLength(6);
    expect(stamped.every((s) => s.lockedAt === SATURDAY)).toBe(true);
  });

  it("never stamps an unfilled slot", async () => {
    const squadId = await newBudgetSquad();
    vi.setSystemTime(SUNDAY + 3_600_000);
    await lockSweep(world.ctx, {});

    const slots = await slotsOf(squadId);
    expect(slots.every((s) => s.lockedAt === undefined)).toBe(true);
  });

  it("stamps lockedAt but no committedPrice for a crew squad (crew has no budget)", async () => {
    const { squadId } = (await createSquad(world.ctx, {
      gameweekId: world.gameweekId,
      context: "crew",
      crewRoomId: "room-9",
      formation: FOUR_FOUR_TWO,
      finisherRoles: [...TWO_ATT_FINISHERS],
    })) as { squadId: string };
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_1 });

    vi.setSystemTime(SATURDAY + 1000);
    await lockSweep(world.ctx, {});

    const slots = await slotsOf(squadId);
    expect(slots[0].lockedAt).toBe(SATURDAY);
    expect(slots[0].committedPrice).toBeUndefined();
  });
});

// ── read surface ──

describe("getSquad", () => {
  it("reports live lock state per slot", async () => {
    const squadId = await newBudgetSquad();
    await setSlot(world.ctx, { squadId, slotIndex: 0, playerId: world.players.SAT_A_1 });
    await setSlot(world.ctx, { squadId, slotIndex: 1, playerId: world.players.SUN_A_1 });

    vi.setSystemTime(SATURDAY + 1000);
    const view = (await getSquad(world.ctx, {
      gameweekId: world.gameweekId,
      context: "budget",
    })) as { slots: Array<{ slotIndex: number; locked: boolean }> };

    expect(view.slots[0].locked).toBe(true);
    expect(view.slots[1].locked).toBe(false);
  });

  it("returns null for a signed-out caller", async () => {
    authMock.getAuthUserId.mockImplementation(async () => null);
    const view = await getSquad(world.ctx, {
      gameweekId: world.gameweekId,
      context: "budget",
    });
    expect(view).toBeNull();
  });
});

// ── one squad per (user, gameweek, context) ──

describe("squad uniqueness", () => {
  it("rejects a second budget squad for the same gameweek", async () => {
    await newBudgetSquad();
    await expect(newBudgetSquad()).rejects.toThrow(/already have a squad/);
  });

  it("allows a budget squad and a crew squad side by side", async () => {
    await newBudgetSquad();
    await expect(
      createSquad(world.ctx, {
        gameweekId: world.gameweekId,
        context: "crew",
        crewRoomId: "room-1",
        formation: FOUR_FOUR_TWO,
        finisherRoles: [...TWO_ATT_FINISHERS],
      }),
    ).resolves.toMatchObject({ squadId: expect.any(String) });
  });

  it("allows squads in two different crew rooms", async () => {
    for (const crewRoomId of ["room-1", "room-2"]) {
      await expect(
        createSquad(world.ctx, {
          gameweekId: world.gameweekId,
          context: "crew",
          crewRoomId,
          formation: FOUR_FOUR_TWO,
          finisherRoles: [...TWO_ATT_FINISHERS],
        }),
      ).resolves.toMatchObject({ squadId: expect.any(String) });
    }
  });
});
