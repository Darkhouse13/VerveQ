/**
 * Weekend Fantasy FW-3 — the draft-room engine at the handler level.
 *
 * Runs the REAL convex/fantasyDraftRooms.ts handlers on the in-memory harness
 * (support/fantasyDraftWorld.ts): only the database, auth, and the scheduler
 * are faked, and the scheduler is a capture the tests drive by hand — which
 * is exactly what makes the LM8 idempotency claims testable (fire a hop
 * twice, prove the second is a no-op).
 *
 * Ticket P5 coverage: state-machine transitions, snake correctness across
 * crew sizes (pure suite covers 2–8; here 2–4 end-to-end), clock/bank math,
 * auto-pick determinism given a seed, crew-internal exclusivity, the R6
 * default sheet on materialized squads, idempotent timeout sweep, and the
 * deterministic-replay gate (same seed + same picks → identical log).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  handlerOf,
  type Row,
} from "./support/fantasyFakeConvex";
import {
  DRAFT_LOBBY_NOW,
  seedDraftWorld,
  type DraftWorld,
} from "./support/fantasyDraftWorld";

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

import * as draftRooms from "../../convex/fantasyDraftRooms";
import {
  CLUB_CAP_REACHED,
  NOT_ALL_READY,
  NOT_ROOM_CREATOR,
  NOT_YOUR_TURN,
  PLAYER_TAKEN,
  ROOM_ALREADY_OPEN,
} from "../../convex/fantasyDraftRooms";
import {
  DRAFT_BANK_MS,
  SQUAD_SIZE,
} from "../../convex/lib/fantasyConstants";
import {
  reconstructDraft,
  seatIndexForPick,
  snakeOrderFor,
  totalPicks,
} from "../../convex/lib/fantasyDraftEngine";
import {
  formationOf,
  validateFormation,
  validateSquadShape,
  type SlotSnapshot,
} from "../../convex/lib/fantasySquadRules";

const createCrew = handlerOf(draftRooms.createCrew);
const joinCrew = handlerOf(draftRooms.joinCrew);
const createRoom = handlerOf(draftRooms.createRoom);
const joinRoom = handlerOf(draftRooms.joinRoom);
const setSeatReady = handlerOf(draftRooms.setSeatReady);
const armDraft = handlerOf(draftRooms.armDraft);
const beginDrafting = handlerOf(draftRooms.beginDrafting);
const makePick = handlerOf(draftRooms.makePick);
const turnTimeout = handlerOf(draftRooms.turnTimeout);
const draftRoomSweep = handlerOf(draftRooms.draftRoomSweep);

let world: DraftWorld;

function asUser(userId: string) {
  authMock.getAuthUserId.mockResolvedValue(userId);
}

/**
 * Drive captured scheduled hops, oldest first (optionally filtered).
 * `dueOnly` drives only hops whose delay has elapsed on the fake clock —
 * needed wherever an early-fired turnTimeout would legitimately re-arm
 * itself forever against a frozen clock.
 */
async function drainScheduled(
  pred: (args: Record<string, unknown>) => boolean = () => true,
  opts: { dueOnly?: boolean } = {},
) {
  const due = (s: { delayMs: number; scheduledAt: number }) =>
    opts.dueOnly !== true || s.scheduledAt + s.delayMs <= Date.now();
  // Newly scheduled hops during draining join the queue and get driven too.
  for (let guard = 0; guard < 500; guard += 1) {
    const index = world.scheduled.findIndex((s) => pred(s.args) && due(s));
    if (index === -1) return;
    const [entry] = world.scheduled.splice(index, 1);
    if ("expectedPickIndex" in entry.args) {
      await turnTimeout(world.ctx, entry.args);
    } else {
      await beginDrafting(world.ctx, entry.args);
    }
  }
  throw new Error("drainScheduled: runaway scheduling");
}

function room(roomId: string): Row {
  const doc = world.db.rows("fantasyDraftRooms").find((r) => r._id === roomId);
  if (!doc) throw new Error("room vanished");
  return doc;
}

function logEntries(roomId: string): Row[] {
  return world.db
    .rows("fantasyDraftLog")
    .filter((e) => e.roomId === roomId)
    .sort((a, b) => (a.seq as number) - (b.seq as number));
}

/** Create crew + room, seat `count` users, ready everyone, arm, begin. */
async function armedRoom(count: number): Promise<{ roomId: string; snakeOrder: number[] }> {
  asUser(world.userIds[0]);
  const { crewId } = (await createCrew(world.ctx, { name: "Test Crew" })) as {
    crewId: string;
    code: string;
  };
  const crewCode = (world.db.rows("fantasyCrews").find((c) => c._id === crewId)!).code as string;
  for (let i = 1; i < count; i += 1) {
    asUser(world.userIds[i]);
    await joinCrew(world.ctx, { code: crewCode });
  }
  asUser(world.userIds[0]);
  const { roomId } = (await createRoom(world.ctx, { crewId })) as { roomId: string };
  for (let i = 1; i < count; i += 1) {
    asUser(world.userIds[i]);
    await joinRoom(world.ctx, { roomId });
    await setSeatReady(world.ctx, { roomId, ready: true });
  }
  asUser(world.userIds[0]);
  await setSeatReady(world.ctx, { roomId, ready: true });
  await armDraft(world.ctx, { roomId });
  await drainScheduled((args) => !("expectedPickIndex" in args)); // the reveal hop
  const snakeOrder = room(roomId).snakeOrder as number[];
  return { roomId, snakeOrder };
}

/** The seat whose turn it is, and its user id. */
function onClock(roomId: string): { seatIndex: number; userId: string } {
  const doc = room(roomId);
  const seatIndex = seatIndexForPick(
    doc.snakeOrder as number[],
    doc.currentPickIndex as number,
  );
  const seats = doc.seats as Array<{ userId: string; bankMs: number }>;
  return { seatIndex, userId: seats[seatIndex].userId };
}

/** Best still-available player for the seat on the clock (fixture-having). */
function availablePlayerFor(roomId: string, opts: { clubId?: string } = {}): string {
  const taken = new Set(
    logEntries(roomId)
      .filter((e) => e.entryType === "pick")
      .map((e) => e.playerId as string),
  );
  const candidates = world.db
    .rows("fantasyPlayers")
    .filter(
      (p) =>
        !taken.has(p._id) &&
        p.clubId !== world.noFixtureClub &&
        (opts.clubId === undefined || p.clubId === opts.clubId),
    );
  if (candidates.length === 0) throw new Error("no available player");
  return candidates[0]._id;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(DRAFT_LOBBY_NOW);
  world = await seedDraftWorld({ users: 8 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── lifecycle ──

describe("lifecycle: lobby → order_reveal → drafting → completed", () => {
  it("arms only for the creator, only all-ready, only 2+ seats (R3)", async () => {
    asUser(world.userIds[0]);
    const { crewId, code } = (await createCrew(world.ctx, { name: "Crew" })) as {
      crewId: string;
      code: string;
    };
    const { roomId } = (await createRoom(world.ctx, { crewId })) as { roomId: string };

    await setSeatReady(world.ctx, { roomId, ready: true });
    await expect(armDraft(world.ctx, { roomId })).rejects.toThrow(/at least 2/);

    asUser(world.userIds[1]);
    await joinCrew(world.ctx, { code });
    await joinRoom(world.ctx, { roomId });
    await expect(armDraft(world.ctx, { roomId })).rejects.toThrow(NOT_ROOM_CREATOR);

    asUser(world.userIds[0]);
    await expect(armDraft(world.ctx, { roomId })).rejects.toThrow(NOT_ALL_READY);

    asUser(world.userIds[1]);
    await setSeatReady(world.ctx, { roomId, ready: true });
    asUser(world.userIds[0]);
    await armDraft(world.ctx, { roomId });
    expect(room(roomId).status).toBe("order_reveal");

    // The reveal hop is idempotent: driving it twice starts drafting once.
    const hop = world.scheduled.find((s) => !("expectedPickIndex" in s.args))!;
    await beginDrafting(world.ctx, hop.args);
    const startedAt = room(roomId).turnStartedAt;
    await beginDrafting(world.ctx, hop.args);
    expect(room(roomId).turnStartedAt).toBe(startedAt);
    expect(room(roomId).status).toBe("drafting");
    expect(room(roomId).currentPickIndex).toBe(0);
  });

  it("records the seed as log entry 0, and the logged order is what the seed generates (R4)", async () => {
    const { roomId, snakeOrder } = await armedRoom(3);
    const [head] = logEntries(roomId);
    expect(head.entryType).toBe("seed");
    expect(head.seq).toBe(0);
    expect(head.seed).toBe(room(roomId).seed);
    expect(snakeOrderFor(3, head.seed as string)).toEqual(snakeOrder);
  });

  it("freezes seats at arm (R7): no joining an armed room", async () => {
    const { roomId } = await armedRoom(2);
    asUser(world.userIds[2]);
    const crewCode = (world.db.rows("fantasyCrews")[0]).code as string;
    await joinCrew(world.ctx, { code: crewCode });
    await expect(joinRoom(world.ctx, { roomId })).rejects.toThrow(/already started/);
  });

  it("rejects a second room for the same crew and gameweek", async () => {
    asUser(world.userIds[0]);
    const { crewId } = (await createCrew(world.ctx, { name: "Crew" })) as { crewId: string };
    await createRoom(world.ctx, { crewId });
    await expect(createRoom(world.ctx, { crewId })).rejects.toThrow(ROOM_ALREADY_OPEN);
  });
});

// ── picking ──

describe("picking: turn order, clock, exclusivity, club cap", () => {
  it("only the seat on the clock may pick, and picks drain the bank by elapsed time", async () => {
    const { roomId } = await armedRoom(2);
    const { seatIndex, userId } = onClock(roomId);
    const other = world.userIds.find((u) => u !== userId)!;

    asUser(other);
    await expect(
      makePick(world.ctx, { roomId, playerId: availablePlayerFor(roomId) }),
    ).rejects.toThrow(NOT_YOUR_TURN);

    vi.setSystemTime(DRAFT_LOBBY_NOW + 12_000);
    asUser(userId);
    await makePick(world.ctx, { roomId, playerId: availablePlayerFor(roomId) });

    const pick = logEntries(roomId).find((e) => e.entryType === "pick")!;
    expect(pick.seatIndex).toBe(seatIndex);
    expect(pick.auto).toBe(false);
    expect(pick.elapsedMs).toBe(12_000);
    expect(pick.bankAfterMs).toBe(DRAFT_BANK_MS - 12_000);
    const seats = room(roomId).seats as Array<{ bankMs: number }>;
    expect(seats[seatIndex].bankMs).toBe(DRAFT_BANK_MS - 12_000);
  });

  it("enforces crew-internal exclusivity: a drafted player is gone", async () => {
    const { roomId } = await armedRoom(2);
    const target = availablePlayerFor(roomId);
    asUser(onClock(roomId).userId);
    await makePick(world.ctx, { roomId, playerId: target });
    asUser(onClock(roomId).userId);
    await expect(makePick(world.ctx, { roomId, playerId: target })).rejects.toThrow(
      PLAYER_TAKEN,
    );
  });

  it("caps a seat at 3 per club, exempting the arm-time favorite", async () => {
    // User 0's favorite is C00, in force before the room arms.
    const user0 = world.db.rows("users").find((u) => u._id === world.userIds[0])!;
    await world.db.patch(user0._id, { favoriteClub: "C00" });

    const { roomId, snakeOrder } = await armedRoom(2);
    const seats = room(roomId).seats as Array<{ userId: string; favoriteClubAtArm: string | null }>;
    const favSeat = seats.findIndex((s) => s.userId === world.userIds[0]);
    expect(seats[favSeat].favoriteClubAtArm).toBe("C00");
    const otherSeat = 1 - favSeat;

    // Each seat takes players from "its" club on its turns: the favorite seat
    // from C00 (cap-exempt), the other from C02 (capped at 3).
    const clubFor = (seat: number) => (seat === favSeat ? "C00" : "C02");
    for (let pickIndex = 0; pickIndex < 8; pickIndex += 1) {
      const seatIndex = seatIndexForPick(snakeOrder, pickIndex);
      asUser(seats[seatIndex].userId);
      const clubId = clubFor(seatIndex);
      const wouldBeFourth =
        seatIndex === otherSeat &&
        logEntries(roomId).filter(
          (e) =>
            e.entryType === "pick" &&
            e.seatIndex === seatIndex &&
            world.db.rows("fantasyPlayers").find((p) => p._id === e.playerId)?.clubId === clubId,
        ).length >= 3;
      if (wouldBeFourth) {
        await expect(
          makePick(world.ctx, { roomId, playerId: availablePlayerFor(roomId, { clubId }) }),
        ).rejects.toThrow(CLUB_CAP_REACHED);
        // Take an uncapped club instead so the draft advances.
        await makePick(world.ctx, {
          roomId,
          playerId: availablePlayerFor(roomId, { clubId: "C04" }),
        });
      } else {
        await makePick(world.ctx, {
          roomId,
          playerId: availablePlayerFor(roomId, { clubId }),
        });
      }
    }

    // The favorite seat holds 4 from C00; the capped seat 3 from C02 + 1 from C04.
    const byClub = (seat: number, club: string) =>
      logEntries(roomId).filter(
        (e) =>
          e.entryType === "pick" &&
          e.seatIndex === seat &&
          world.db.rows("fantasyPlayers").find((p) => p._id === e.playerId)?.clubId === club,
      ).length;
    expect(byClub(favSeat, "C00")).toBe(4);
    expect(byClub(otherSeat, "C02")).toBe(3);
  });

  it("lets a human pick a no-fixture player (R5) but never a started one", async () => {
    const { roomId } = await armedRoom(2);
    const noFixture = world.players[`${world.noFixtureClub}_1`];
    asUser(onClock(roomId).userId);
    await makePick(world.ctx, { roomId, playerId: noFixture });
    expect(
      logEntries(roomId).some((e) => e.playerId === noFixture),
    ).toBe(true);

    // A kickoff passes mid-draft while the bank is still alive: pull C00's
    // fixture to 5s from now, step 6s — that seat's players become hindsight
    // picks while everything else stays draftable.
    const fixture = world.db
      .rows("fantasyFixtures")
      .find((f) => f.homeClubId === "C00")!;
    await world.db.patch(fixture._id, { kickoffAt: Date.now() + 5_000 });
    vi.setSystemTime(Date.now() + 6_000);
    asUser(onClock(roomId).userId);
    await expect(
      makePick(world.ctx, { roomId, playerId: world.players.C00_1 }),
    ).rejects.toThrow(/kicked off/);
  });
});

// ── timeouts and R2 ──

describe("chess-clock timeout and the R2 zero-bank rule", () => {
  it("auto-picks on bank exhaustion, and the sweep hop is idempotent (LM8)", async () => {
    const { roomId } = await armedRoom(2);
    vi.setSystemTime(DRAFT_LOBBY_NOW + DRAFT_BANK_MS + 1);

    await turnTimeout(world.ctx, { roomId, expectedPickIndex: 0 });
    const picks = logEntries(roomId).filter((e) => e.entryType === "pick");
    expect(picks).toHaveLength(1);
    expect(picks[0].auto).toBe(true);
    expect(picks[0].elapsedMs).toBe(DRAFT_BANK_MS);
    expect(picks[0].bankAfterMs).toBe(0);

    // Fire the same hop again: the cursor moved, so it must do nothing.
    await turnTimeout(world.ctx, { roomId, expectedPickIndex: 0 });
    expect(logEntries(roomId).filter((e) => e.entryType === "pick")).toHaveLength(1);
  });

  it("re-arms instead of picking when fired early", async () => {
    const { roomId } = await armedRoom(2);
    vi.setSystemTime(DRAFT_LOBBY_NOW + 10_000); // bank far from empty
    world.scheduled.length = 0;
    await turnTimeout(world.ctx, { roomId, expectedPickIndex: 0 });
    expect(logEntries(roomId).filter((e) => e.entryType === "pick")).toHaveLength(0);
    expect(world.scheduled).toHaveLength(1);
    expect(world.scheduled[0].delayMs).toBe(DRAFT_BANK_MS - 10_000);
  });

  it("R2: once a bank is empty, every later turn of that seat auto-picks instantly", async () => {
    const { roomId, snakeOrder } = await armedRoom(2);
    const zeroSeat = seatIndexForPick(snakeOrder, 0);

    // Seat 1 of the snake drains its whole bank on pick 0.
    vi.setSystemTime(DRAFT_LOBBY_NOW + DRAFT_BANK_MS + 1);
    await turnTimeout(world.ctx, { roomId, expectedPickIndex: 0 });

    // Snake round 1: the OTHER seat now has picks 1 AND (via the fold) 2 —
    // wait: with 2 drafters the order is [a, b, b, a, a, b, ...]. After a's
    // timeout at pick 0, b picks at 1 and 2; a's empty bank then auto-picks
    // pick 3 INSTANTLY inside b's second mutation — no timeout hop needed.
    const seats = room(roomId).seats as Array<{ userId: string }>;
    const otherSeatIndex = 1 - zeroSeat;
    for (const expectedPick of [1, 2]) {
      expect(room(roomId).currentPickIndex).toBe(expectedPick);
      asUser(seats[otherSeatIndex].userId);
      await makePick(world.ctx, { roomId, playerId: availablePlayerFor(roomId) });
    }

    const picks = logEntries(roomId).filter((e) => e.entryType === "pick");
    // Picks 0 (timeout), 1, 2 (human), 3 (chained instant auto) — and pick 4
    // belongs to the zero-bank seat too? No: [a,b],[b,a],[a,b] — pick 4 is a
    // again → also chained. The cursor must now sit on pick 5 (b's turn).
    expect(picks.length).toBe(5);
    const chained = picks.filter((p) => p.auto === true && p.elapsedMs === 0);
    expect(chained.map((p) => p.pickNumber)).toEqual([4, 5]);
    expect(chained.every((p) => p.seatIndex === zeroSeat)).toBe(true);
    expect(room(roomId).currentPickIndex).toBe(5);
  });

  it("auto-pick skips no-fixture players (R5) and is deterministic", async () => {
    const { roomId } = await armedRoom(2);
    vi.setSystemTime(DRAFT_LOBBY_NOW + DRAFT_BANK_MS + 1);
    await turnTimeout(world.ctx, { roomId, expectedPickIndex: 0 });
    const [pick] = logEntries(roomId).filter((e) => e.entryType === "pick");
    const player = world.db.rows("fantasyPlayers").find((p) => p._id === pick.playerId)!;
    expect(player.clubId).not.toBe(world.noFixtureClub);
    // Best available under R1 in this seeded world is the 13.0 topfive player
    // with the highest proxy; recompute expectation directly from the pool.
    const best = world.db
      .rows("fantasyPlayers")
      .filter((p) => p.clubId !== world.noFixtureClub)
      .sort((a, b) => (b.price as number) - (a.price as number))
      .filter((p, _, all) => p.price === all[0].price);
    expect(best.map((p) => p._id)).toContain(pick.playerId);
  });
});

// ── sweep cron ──

describe("draftRoomSweep (the LM4 consumer)", () => {
  it("expires dead lobbies and re-kicks an overdue turn", async () => {
    // A lobby left alone past its TTL:
    asUser(world.userIds[5]);
    const { crewId } = (await createCrew(world.ctx, { name: "Ghost Crew" })) as {
      crewId: string;
    };
    const { roomId: lobbyId } = (await createRoom(world.ctx, { crewId })) as { roomId: string };

    // A drafting room whose timeout hop was "lost" (we just never drive it):
    const { roomId } = await armedRoom(2);
    world.scheduled.length = 0;

    // 4 hours on: the lobby is past its 3h TTL and the turn is long overdue.
    vi.setSystemTime(DRAFT_LOBBY_NOW + 4 * 60 * 60 * 1000);
    await draftRoomSweep(world.ctx, {});
    expect(room(lobbyId).status).toBe("abandoned");

    // The sweep scheduled a guarded re-kick; driving it makes the auto-pick.
    await drainScheduled(() => true, { dueOnly: true });
    expect(
      logEntries(roomId).filter((e) => e.entryType === "pick" && e.auto === true).length,
    ).toBeGreaterThan(0);

    // Sweeping again finds nothing to do (idempotent).
    const before = logEntries(roomId).length;
    await draftRoomSweep(world.ctx, {});
    await drainScheduled(() => true, { dueOnly: true });
    expect(logEntries(roomId).length).toBe(before);
  });
});

// ── the full draft ──

describe("a full draft, end to end (2, 3 and 4 drafters)", () => {
  async function runFullDraft(count: number): Promise<string> {
    const { roomId, snakeOrder } = await armedRoom(count);
    const seats = room(roomId).seats as Array<{ userId: string }>;
    const total = totalPicks(count);
    let clock = DRAFT_LOBBY_NOW;
    for (let pickIndex = 0; pickIndex < total; pickIndex += 1) {
      if (room(roomId).status !== "drafting") break; // chained autos finished it
      if ((room(roomId).currentPickIndex as number) !== pickIndex) continue;
      const seatIndex = seatIndexForPick(snakeOrder, pickIndex);
      clock += 1_000;
      vi.setSystemTime(clock);
      asUser(seats[seatIndex].userId);
      await makePick(world.ctx, { roomId, playerId: availablePlayerFor(roomId) });
    }
    return roomId;
  }

  for (const count of [2, 3, 4]) {
    it(`completes a ${count}-drafter draft, materializes R6 sheets, log reconstructs`, async () => {
      const roomId = await runFullDraft(count);
      const doc = room(roomId);
      expect(doc.status).toBe("completed");

      const entries = logEntries(roomId);
      expect(entries.filter((e) => e.entryType === "pick")).toHaveLength(totalPicks(count));

      // The log alone reconstructs the draft (ticket gate).
      const rebuilt = reconstructDraft(
        entries.map((e) => ({
          seq: e.seq as number,
          entryType: e.entryType as "seed" | "pick",
          seed: e.seed as string | undefined,
          snakeOrder: e.snakeOrder as number[] | undefined,
          pickNumber: e.pickNumber as number | undefined,
          round: e.round as number | undefined,
          seatIndex: e.seatIndex as number | undefined,
          playerId: e.playerId as string | undefined,
          auto: e.auto as boolean | undefined,
          elapsedMs: e.elapsedMs as number | undefined,
          bankAfterMs: e.bankAfterMs as number | undefined,
        })),
        DRAFT_BANK_MS,
      );
      expect(rebuilt.problems).toEqual([]);
      expect([...rebuilt.picksBySeat.values()].every((l) => l.length === SQUAD_SIZE)).toBe(true);

      // Every seat got a materialized crew squad on the R6 default sheet.
      const squads = world.db
        .rows("fantasySquads")
        .filter((s) => s.crewRoomId === roomId);
      expect(squads).toHaveLength(count);
      for (const squad of squads) {
        const slots = world.db
          .rows("fantasySquadSlots")
          .filter((s) => s.squadId === squad._id);
        expect(slots).toHaveLength(SQUAD_SIZE);
        expect(slots.every((s) => s.playerId !== undefined)).toBe(true);
        const snapshots: SlotSnapshot[] = slots.map((s) => ({
          slotIndex: s.slotIndex as number,
          slotRole: s.slotRole as SlotSnapshot["slotRole"],
          isFinisher: s.isFinisher as boolean,
          playerId: (s.playerId as string | undefined) ?? null,
          lockedAt: null,
          committedPrice: null,
        }));
        expect(validateSquadShape(snapshots).ok).toBe(true);
        expect(validateFormation(formationOf(snapshots)).ok).toBe(true);
        expect(formationOf(snapshots)).toEqual({ GK: 1, DEF: 4, MID: 4, ATT: 2 });

        // R6: the two finishers are the two lowest-priced of the 13 that are
        // not the keeper (the keeper is pinned to the GK slot first).
        const priceOf = (playerId: string) =>
          world.db.rows("fantasyPlayers").find((p) => p._id === playerId)!.price as number;
        const keeper = slots.find((s) => s.slotRole === "GK" && s.isFinisher === false)!;
        const nonKeeper = slots.filter((s) => s._id !== keeper._id);
        const cheapestTwo = [...nonKeeper]
          .sort((a, b) => priceOf(a.playerId as string) - priceOf(b.playerId as string))
          .slice(0, 2)
          .map((s) => priceOf(s.playerId as string));
        const finisherPrices = slots
          .filter((s) => s.isFinisher)
          .map((s) => priceOf(s.playerId as string))
          .sort((a, b) => a - b);
        expect(finisherPrices).toEqual(cheapestTwo.sort((a, b) => a - b));
      }
    });
  }

  it("deterministic replay: same seed + same pick inputs → identical log", async () => {
    // Pin the two nondeterminism sources: the clock (fake timers, same
    // script) and the crew-code RNG (zeroed bytes), so both worlds arm with
    // the SAME hashString seed — then the whole draft must transcribe
    // identically, pick for pick, bank for bank.
    const runOnce = async (): Promise<string[]> => {
      vi.setSystemTime(DRAFT_LOBBY_NOW);
      world = await seedDraftWorld({ users: 4 });
      vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(
        <T extends ArrayBufferView | null>(view: T): T => {
          if (view instanceof Uint8Array) view.fill(7);
          return view;
        },
      );
      const roomId = await runFullDraft(4);
      return logEntries(roomId).map((e) =>
        [
          e.seq,
          e.entryType,
          e.seed ?? "",
          (e.snakeOrder as number[] | undefined)?.join("-") ?? "",
          e.pickNumber ?? "",
          e.seatIndex ?? "",
          // Provider id, not convex id, so the digest is world-independent.
          e.playerId === undefined
            ? ""
            : world.db.rows("fantasyPlayers").find((p) => p._id === e.playerId)!
                .providerPlayerId,
          e.auto ?? "",
          e.elapsedMs ?? "",
          e.bankAfterMs ?? "",
        ].join("|"),
      );
    };

    const first = await runOnce();
    const second = await runOnce();
    expect(second).toEqual(first);
    expect(first.length).toBe(totalPicks(4) + 1);
  });
});
