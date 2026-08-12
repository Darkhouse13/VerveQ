/**
 * Weekend Fantasy FW-POLISH-3 O2 — crew deletion, at the handler level.
 *
 * The owner ruling under test: a crew's CREATOR may delete it ONLY while it
 * has zero completed drafts. Deletion cancels an open lobby/order_reveal room
 * and removes crew + membership + the cancelled room's rows; a DRAFTING room
 * blocks deletion outright; a completed draft protects the crew's record
 * forever (no delete path — "leave crew" is the exit). Server-enforced: every
 * guard here is proven against the real handlers on the in-memory harness,
 * with cleanup verified by table inspection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handlerOf } from "./support/fantasyFakeConvex";
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
  CREW_DRAFT_IN_PROGRESS,
  CREW_HAS_COMPLETED_DRAFT,
  NOT_CREW_CREATOR,
} from "../../convex/fantasyDraftRooms";
import { seatIndexForPick } from "../../convex/lib/fantasyDraftEngine";

const createCrew = handlerOf(draftRooms.createCrew);
const joinCrew = handlerOf(draftRooms.joinCrew);
const createRoom = handlerOf(draftRooms.createRoom);
const joinRoom = handlerOf(draftRooms.joinRoom);
const setSeatReady = handlerOf(draftRooms.setSeatReady);
const armDraft = handlerOf(draftRooms.armDraft);
const beginDrafting = handlerOf(draftRooms.beginDrafting);
const makePick = handlerOf(draftRooms.makePick);
const materializeRoomSquads = handlerOf(draftRooms.materializeRoomSquads);
const deleteCrew = handlerOf(draftRooms.deleteCrew);
const getCrew = handlerOf(draftRooms.getCrew);

let world: DraftWorld;

function asUser(userId: string) {
  authMock.getAuthUserId.mockResolvedValue(userId);
}

async function drainScheduled(pred: (fn: string) => boolean) {
  for (let guard = 0; guard < 500; guard += 1) {
    const index = world.scheduled.findIndex((s) => pred(s.fn));
    if (index === -1) return;
    const [entry] = world.scheduled.splice(index, 1);
    const name = entry.fn.split(":").pop();
    const hop =
      name === "beginDrafting"
        ? beginDrafting
        : name === "materializeRoomSquads"
          ? materializeRoomSquads
          : null;
    if (hop === null) throw new Error(`unknown hop ${entry.fn}`);
    await hop(world.ctx, entry.args);
  }
  throw new Error("drainScheduled: runaway scheduling");
}

/** Crew of `count` seated users; returns ids. Room left in `lobby`. */
async function crewWithLobby(count: number) {
  asUser(world.userIds[0]);
  const { crewId, code } = (await createCrew(world.ctx, { name: "Doomed Crew" })) as {
    crewId: string;
    code: string;
  };
  for (let i = 1; i < count; i += 1) {
    asUser(world.userIds[i]);
    await joinCrew(world.ctx, { code });
  }
  asUser(world.userIds[0]);
  const { roomId } = (await createRoom(world.ctx, { crewId })) as { roomId: string };
  for (let i = 1; i < count; i += 1) {
    asUser(world.userIds[i]);
    await joinRoom(world.ctx, { roomId });
  }
  return { crewId, code, roomId };
}

/** Ready everyone and arm — leaves the room in `order_reveal`. */
async function armRoom(roomId: string, count: number) {
  for (let i = 1; i < count; i += 1) {
    asUser(world.userIds[i]);
    await setSeatReady(world.ctx, { roomId, ready: true });
  }
  asUser(world.userIds[0]);
  await setSeatReady(world.ctx, { roomId, ready: true });
  await armDraft(world.ctx, { roomId });
}

function roomDoc(roomId: string) {
  return world.db.rows("fantasyDraftRooms").find((r) => r._id === roomId);
}

/** Draft the room out to `completed` with deliberate picks. */
async function draftToCompletion(roomId: string) {
  let clock = Date.now();
  for (let guard = 0; guard < 200; guard += 1) {
    const doc = roomDoc(roomId)!;
    if (doc.status !== "drafting") return;
    const seatIndex = seatIndexForPick(
      doc.snakeOrder as number[],
      doc.currentPickIndex as number,
    );
    const seats = doc.seats as Array<{ userId: string }>;
    const taken = new Set(
      world.db
        .rows("fantasyDraftLog")
        .filter((e) => e.roomId === roomId && e.entryType === "pick")
        .map((e) => e.playerId as string),
    );
    const player = world.db
      .rows("fantasyPlayers")
      .find((p) => !taken.has(p._id) && p.clubId !== world.noFixtureClub);
    if (!player) throw new Error("no available player");
    clock += 1_000;
    vi.setSystemTime(clock);
    asUser(seats[seatIndex].userId);
    await makePick(world.ctx, { roomId, playerId: player._id });
  }
  throw new Error("draft never completed");
}

function crewFootprint(crewId: string, roomId: string) {
  return {
    crew: world.db.rows("fantasyCrews").filter((c) => c._id === crewId).length,
    members: world.db.rows("fantasyCrewMembers").filter((m) => m.crewId === crewId).length,
    rooms: world.db.rows("fantasyDraftRooms").filter((r) => r.crewId === crewId).length,
    logRows: world.db.rows("fantasyDraftLog").filter((e) => e.roomId === roomId).length,
  };
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

describe("deleteCrew — the guard, both ways", () => {
  it("creator deletes a crew with an open lobby: every row gone, lobby counted cancelled", async () => {
    const { crewId, roomId } = await crewWithLobby(3);
    expect(crewFootprint(crewId, roomId)).toEqual({
      crew: 1,
      members: 3,
      rooms: 1,
      logRows: 0,
    });

    asUser(world.userIds[0]);
    const result = (await deleteCrew(world.ctx, { crewId })) as {
      ok: true;
      cancelledRooms: number;
    };
    expect(result).toEqual({ ok: true, cancelledRooms: 1 });
    expect(crewFootprint(crewId, roomId)).toEqual({
      crew: 0,
      members: 0,
      rooms: 0,
      logRows: 0,
    });
  });

  it("creator deletes a crew with no room at all", async () => {
    asUser(world.userIds[0]);
    const { crewId } = (await createCrew(world.ctx, { name: "Roomless" })) as {
      crewId: string;
    };
    const result = (await deleteCrew(world.ctx, { crewId })) as {
      cancelledRooms: number;
    };
    expect(result.cancelledRooms).toBe(0);
    expect(world.db.rows("fantasyCrews").filter((c) => c._id === crewId)).toEqual([]);
    expect(world.db.rows("fantasyCrewMembers").filter((m) => m.crewId === crewId)).toEqual([]);
  });

  it("cancels an order_reveal room too, wiping its log rows", async () => {
    const { crewId, roomId } = await crewWithLobby(2);
    await armRoom(roomId, 2);
    expect(roomDoc(roomId)!.status).toBe("order_reveal");

    asUser(world.userIds[0]);
    const result = (await deleteCrew(world.ctx, { crewId })) as {
      cancelledRooms: number;
    };
    expect(result.cancelledRooms).toBe(1);
    expect(crewFootprint(crewId, roomId)).toEqual({
      crew: 0,
      members: 0,
      rooms: 0,
      logRows: 0,
    });
  });

  it("rejects a non-creator, leaving every row intact", async () => {
    const { crewId, roomId } = await crewWithLobby(3);
    asUser(world.userIds[1]);
    await expect(deleteCrew(world.ctx, { crewId })).rejects.toThrow(NOT_CREW_CREATOR);
    expect(crewFootprint(crewId, roomId)).toEqual({
      crew: 1,
      members: 3,
      rooms: 1,
      logRows: 0,
    });
  });

  it("a DRAFTING room blocks deletion until it terminates", async () => {
    const { crewId, roomId } = await crewWithLobby(2);
    await armRoom(roomId, 2);
    await drainScheduled((fn) => fn.endsWith(":beginDrafting"));
    expect(roomDoc(roomId)!.status).toBe("drafting");

    asUser(world.userIds[0]);
    await expect(deleteCrew(world.ctx, { crewId })).rejects.toThrow(CREW_DRAFT_IN_PROGRESS);
    expect(crewFootprint(crewId, roomId).crew).toBe(1);
  });

  it("a completed draft protects the record forever — no delete path, even for the creator", async () => {
    const { crewId, roomId } = await crewWithLobby(2);
    await armRoom(roomId, 2);
    await drainScheduled((fn) => fn.endsWith(":beginDrafting"));
    await draftToCompletion(roomId);
    await drainScheduled((fn) => fn.endsWith(":materializeRoomSquads"));
    expect(roomDoc(roomId)!.status).toBe("completed");
    const squadCount = world.db
      .rows("fantasySquads")
      .filter((s) => s.crewRoomId === roomId).length;
    expect(squadCount).toBe(2);

    asUser(world.userIds[0]);
    await expect(deleteCrew(world.ctx, { crewId })).rejects.toThrow(
      CREW_HAS_COMPLETED_DRAFT,
    );
    // The record is untouched: crew, members, room, log and squads all live.
    const footprint = crewFootprint(crewId, roomId);
    expect(footprint.crew).toBe(1);
    expect(footprint.members).toBe(2);
    expect(footprint.rooms).toBe(1);
    expect(footprint.logRows).toBeGreaterThan(0);
    expect(
      world.db.rows("fantasySquads").filter((s) => s.crewRoomId === roomId).length,
    ).toBe(2);
  });
});

describe("getCrew.canDelete mirrors the server guard", () => {
  it("true only for the creator of an undrafted crew", async () => {
    const { code } = await crewWithLobby(2);

    asUser(world.userIds[0]);
    const forCreator = (await getCrew(world.ctx, { code })) as { canDelete: boolean };
    expect(forCreator.canDelete).toBe(true);

    asUser(world.userIds[1]);
    const forMember = (await getCrew(world.ctx, { code })) as { canDelete: boolean };
    expect(forMember.canDelete).toBe(false);
  });

  it("false while drafting and false forever after completion", async () => {
    const { code, roomId } = await crewWithLobby(2);
    await armRoom(roomId, 2);
    await drainScheduled((fn) => fn.endsWith(":beginDrafting"));

    asUser(world.userIds[0]);
    const during = (await getCrew(world.ctx, { code })) as { canDelete: boolean };
    expect(during.canDelete).toBe(false);

    await draftToCompletion(roomId);
    asUser(world.userIds[0]);
    const after = (await getCrew(world.ctx, { code })) as { canDelete: boolean };
    expect(after.canDelete).toBe(false);
  });
});
