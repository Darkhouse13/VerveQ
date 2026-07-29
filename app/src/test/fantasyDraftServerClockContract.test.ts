/**
 * Weekend Fantasy FW-3S — the draft room is server-clocked, and stays that way.
 *
 * DRAFT_ROOM_SPEC v1.2.0 §Lifecycle: "Arena-derived, **server-clocked
 * throughout**". The engine honours that today — no mutation accepts a
 * timestamp, elapsed clock is computed from a server-written `turnStartedAt`
 * against a server `Date.now()`, and read models carry `serverNow` for client
 * offset correction rather than a countdown the client owns.
 *
 * FW-3R put one seam in that surface: `armDraftFor` and `makePickFor` take a
 * `now` parameter (defaulted to the server clock) so fantasyDraftSim can drain
 * a 390s bank inside a single transaction, where Convex freezes the wall
 * clock. That seam is legitimate and internal — but it is exactly the shape a
 * later ticket could wire through to the public mutation "to make testing
 * easier", and the moment it is, a client can name the time its own pick was
 * made. Which is LM12 (client clock authority) with better manners.
 *
 * This file is the guard. It asserts no behaviour change of its own: it pins
 * the boundary, so a future change that opens it fails here first.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handlerOf, type Row } from "./support/fantasyFakeConvex";
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
import { makePickFor } from "../../convex/fantasyDraftRooms";
import { DRAFT_BANK_MS } from "../../convex/lib/fantasyConstants";
import { seatIndexForPick } from "../../convex/lib/fantasyDraftEngine";

const createCrew = handlerOf(draftRooms.createCrew);
const joinCrew = handlerOf(draftRooms.joinCrew);
const createRoom = handlerOf(draftRooms.createRoom);
const joinRoom = handlerOf(draftRooms.joinRoom);
const setSeatReady = handlerOf(draftRooms.setSeatReady);
const armDraft = handlerOf(draftRooms.armDraft);
const beginDrafting = handlerOf(draftRooms.beginDrafting);
const makePick = handlerOf(draftRooms.makePick);

let world: DraftWorld;

function asUser(userId: string) {
  authMock.getAuthUserId.mockResolvedValue(userId);
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

/** A two-seat room, armed and drafting, with the reveal hop driven. */
async function armedRoom(): Promise<string> {
  asUser(world.userIds[0]);
  const { crewId, code } = (await createCrew(world.ctx, { name: "Clock Crew" })) as {
    crewId: string;
    code: string;
  };
  asUser(world.userIds[1]);
  await joinCrew(world.ctx, { code });
  asUser(world.userIds[0]);
  const { roomId } = (await createRoom(world.ctx, { crewId })) as { roomId: string };
  asUser(world.userIds[1]);
  await joinRoom(world.ctx, { roomId });
  await setSeatReady(world.ctx, { roomId, ready: true });
  asUser(world.userIds[0]);
  await setSeatReady(world.ctx, { roomId, ready: true });
  await armDraft(world.ctx, { roomId });
  await beginDrafting(world.ctx, { roomId });
  return roomId;
}

function onClockUser(roomId: string): string {
  const doc = room(roomId);
  const seatIndex = seatIndexForPick(
    doc.snakeOrder as number[],
    doc.currentPickIndex as number,
  );
  return (doc.seats as Array<{ userId: string }>)[seatIndex].userId;
}

function anyAvailablePlayer(roomId: string): string {
  const taken = new Set(
    logEntries(roomId)
      .filter((e) => e.entryType === "pick")
      .map((e) => e.playerId as string),
  );
  const player = world.db
    .rows("fantasyPlayers")
    .find((p) => !taken.has(p._id) && p.clubId !== world.noFixtureClub);
  if (player === undefined) throw new Error("no available player");
  return player._id;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(DRAFT_LOBBY_NOW);
  world = await seedDraftWorld({ users: 4 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── the declared argument surface ──

/**
 * Anything a caller could plausibly name a clock with. Deliberately broad: the
 * point is to catch a future `now`/`at`/`clientTime` argument by shape, before
 * anyone has to reason about whether it is load-bearing.
 */
const TIME_SHAPED = /now|time|clock|instant|elapsed|timestamp|_at$|^at$|ms$/i;

interface ArgSpec {
  type: string;
  value?: Record<string, unknown>;
}

/** Every public function this module exposes, with its declared arg names. */
function publicFunctionArgs(): Array<{ name: string; args: string[] }> {
  const out: Array<{ name: string; args: string[] }> = [];
  for (const [name, fn] of Object.entries(draftRooms)) {
    if (fn === null || (typeof fn !== "object" && typeof fn !== "function")) continue;
    const marked = fn as {
      isPublic?: boolean;
      isMutation?: boolean;
      isQuery?: boolean;
      exportArgs?: () => string;
    };
    if (marked.isPublic !== true) continue;
    if (marked.isMutation !== true && marked.isQuery !== true) continue;
    const spec = JSON.parse(marked.exportArgs!()) as ArgSpec;
    out.push({ name, args: Object.keys(spec.value ?? {}) });
  }
  return out;
}

describe("the public draft surface accepts no caller-supplied time", () => {
  it("declares no time-shaped argument on any public mutation or query", () => {
    const surface = publicFunctionArgs();
    // Guard the guard: if the module stops exposing functions, this file has
    // quietly stopped testing anything.
    expect(surface.length).toBeGreaterThanOrEqual(8);
    expect(surface.map((f) => f.name)).toContain("makePick");
    expect(surface.map((f) => f.name)).toContain("armDraft");

    const offenders = surface.flatMap((fn) =>
      fn.args.filter((arg) => TIME_SHAPED.test(arg)).map((arg) => `${fn.name}(${arg})`),
    );
    expect(offenders).toEqual([]);
  });

  it("declares exactly the arguments the spec's write path needs", () => {
    const byName = new Map(publicFunctionArgs().map((f) => [f.name, f.args]));
    // Pinned rather than merely filtered, so ADDING an argument to a pick is a
    // decision someone has to make here too.
    expect(byName.get("makePick")).toEqual(["roomId", "playerId"]);
    expect(byName.get("armDraft")).toEqual(["roomId"]);
    expect(byName.get("setSeatReady")).toEqual(["roomId", "ready"]);
  });
});

// ── the behavioural half: an injected time is ignored ──

describe("a caller-supplied time changes nothing", () => {
  it("clocks a pick from the server, not from an injected now", async () => {
    const roomId = await armedRoom();
    expect(room(roomId).turnStartedAt).toBe(DRAFT_LOBBY_NOW);

    // 12s of real turn, and a caller claiming 300s — the sort of argument a
    // wired-through seam would accept.
    vi.setSystemTime(DRAFT_LOBBY_NOW + 12_000);
    asUser(onClockUser(roomId));
    await makePick(world.ctx, {
      roomId,
      playerId: anyAvailablePlayer(roomId),
      now: DRAFT_LOBBY_NOW + 300_000,
    } as unknown as Record<string, unknown>);

    const pick = logEntries(roomId).find((e) => e.entryType === "pick")!;
    expect(pick.elapsedMs).toBe(12_000);
    expect(pick.bankAfterMs).toBe(DRAFT_BANK_MS - 12_000);
    expect(pick.at).toBe(DRAFT_LOBBY_NOW + 12_000);
  });

  it("stamps the arm from the server, not from an injected now", async () => {
    vi.setSystemTime(DRAFT_LOBBY_NOW + 5_000);
    asUser(world.userIds[0]);
    const { crewId, code } = (await createCrew(world.ctx, { name: "Arm Crew" })) as {
      crewId: string;
      code: string;
    };
    asUser(world.userIds[1]);
    await joinCrew(world.ctx, { code });
    asUser(world.userIds[0]);
    const { roomId } = (await createRoom(world.ctx, { crewId })) as { roomId: string };
    asUser(world.userIds[1]);
    await joinRoom(world.ctx, { roomId });
    await setSeatReady(world.ctx, { roomId, ready: true });
    asUser(world.userIds[0]);
    await setSeatReady(world.ctx, { roomId, ready: true });

    await armDraft(world.ctx, {
      roomId,
      now: DRAFT_LOBBY_NOW + 999_999,
    } as unknown as Record<string, unknown>);

    expect(room(roomId).orderRevealedAt).toBe(DRAFT_LOBBY_NOW + 5_000);
    expect(logEntries(roomId)[0].at).toBe(DRAFT_LOBBY_NOW + 5_000);
  });

  /**
   * The other side of the boundary, asserted so this file documents WHY the
   * seam exists rather than just forbidding it: the internal core does honour
   * an explicit instant. That is what lets the DEV sim spend a 390s bank in
   * one transaction. It is reachable only from server code.
   */
  it("keeps the seam working internally, where the sim needs it", async () => {
    const roomId = await armedRoom();
    vi.setSystemTime(DRAFT_LOBBY_NOW + 12_000);

    const userId = onClockUser(roomId);
    await makePickFor(
      world.ctx as never,
      userId as never,
      roomId as never,
      anyAvailablePlayer(roomId) as never,
      DRAFT_LOBBY_NOW + 5_000, // a virtual clock, behind the wall clock
    );

    const pick = logEntries(roomId).find((e) => e.entryType === "pick")!;
    expect(pick.elapsedMs).toBe(5_000);
    expect(pick.at).toBe(DRAFT_LOBBY_NOW + 5_000);
  });
});
