/**
 * Weekend Fantasy — crew draft rooms (FW-3).
 *
 * DRAFT_ROOM_SPEC v1.1.0 + the seven FW-3 owner rulings (2026-07-29). State
 * machine derived from the Arena pattern (challengeArenas.ts): one room doc,
 * embedded seats, share-code join, scheduled internal mutations guarded by
 * expected-state args. The rules themselves live in lib/fantasyDraftEngine.ts
 * (pure); this module is authorization, persistence and scheduling.
 *
 * ── The LiveMatches failures, made structurally impossible here ──
 *
 * LM8 (double-schedule): every scheduled function re-checks the state it was
 * scheduled FOR (expectedPickIndex / status guards) and exits silently when
 * the work is already done. Scheduling twice is therefore harmless, and the
 * sweep cron re-kicks lost schedules for free.
 *
 * LM12 (client clock authority): the client never tells the server anything
 * about time. The chess clock is (turnStartedAt, seats[i].bankMs), both
 * server-written; every read model carries serverNow for offset correction.
 *
 * LM4 (dead heartbeat): no liveness is persisted anywhere in this module. A
 * disconnected drafter is not a state — their bank drains on their turns and
 * the timeout auto-picks, which is the whole disconnect story (spec
 * §Auto-pick, disconnects). The one TTL we do persist (lobby expiresAt) is
 * consumed by the draftRoomSweep cron.
 *
 * LM7 (resume gaps): getRoom serves a complete render model for EVERY status,
 * derived only from persisted fields — a cold page load mid-draft
 * reconstructs the board, the clock and the turn from one query.
 */

import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertUsernameRequiredUser } from "./lib/authz";
import {
  CREW_MAX_DRAFTERS,
  CREW_MIN_DRAFTERS,
  DRAFT_BANK_MS,
  DRAFT_ROOM_LOBBY_TTL_MS,
  ORDER_REVEAL_MS,
  SQUAD_SIZE,
} from "./lib/fantasyConstants";
import { resolveFavoriteClub } from "./lib/fantasyFavoriteClub";
import {
  bankExhausted,
  clubCapBlocks,
  defaultSheetAssignment,
  elapsedOnTurn,
  hashString,
  seatIndexForPick,
  selectAutoPick,
  snakeOrderFor,
  totalPicks,
  type DraftPoolPlayer,
} from "./lib/fantasyDraftEngine";

export const SIGN_IN_REQUIRED = "Sign in to draft with a crew.";
export const CREW_NOT_FOUND = "Crew not found — check the code.";
export const CREW_FULL = `A crew holds at most ${CREW_MAX_DRAFTERS} drafters.`;
export const NOT_A_MEMBER = "You are not a member of this crew.";
export const ROOM_NOT_FOUND = "Draft room not found.";
export const ROOM_NOT_LOBBY = "The draft has already started.";
export const NOT_ROOM_CREATOR = "Only the room's creator can do that.";
export const NOT_ALL_READY = "Everyone seated must be ready before the draft arms.";
export const NOT_ENOUGH_DRAFTERS = `A draft needs at least ${CREW_MIN_DRAFTERS} drafters.`;
export const NOT_YOUR_TURN = "It is not your turn to pick.";
export const PLAYER_TAKEN = "That player is already drafted in this room.";
export const PLAYER_STARTED =
  "That player's match has already kicked off; he can no longer be picked.";
export const CLUB_CAP_REACHED =
  "You already have 3 players from that club (your favorite club is exempt).";
export const ROOM_ALREADY_OPEN =
  "This crew already has a draft room for this gameweek.";
export const NO_OPEN_GAMEWEEK = "No gameweek is open for drafting right now.";

/**
 * How late a scheduled hop must be before the sweep treats it as lost and
 * re-drives the machine itself. Operational tolerance, not a spec rule —
 * generous enough that a healthy scheduler never trips it.
 */
const SWEEP_SLACK_MS = 10_000;
const SWEEP_BATCH = 50;

type Ctx = MutationCtx | QueryCtx;
type Room = Doc<"fantasyDraftRooms">;
type Seat = Room["seats"][number];

// ── crew helpers ──

/** Arena's code alphabet (no 0/O/1/I), on the crew because the crew is the
 *  persistent thing the code names (§Founding shape: "same code, same people"). */
function randomCrewCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

async function generateUniqueCrewCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomCrewCode();
    const clash = await ctx.db
      .query("fantasyCrews")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (clash === null) return code;
  }
  throw new Error("Could not allocate a crew code — try again.");
}

async function requireUserId(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error(SIGN_IN_REQUIRED);
  return userId;
}

async function membershipOf(
  ctx: Ctx,
  crewId: Id<"fantasyCrews">,
  userId: Id<"users">,
): Promise<Doc<"fantasyCrewMembers"> | null> {
  return await ctx.db
    .query("fantasyCrewMembers")
    .withIndex("by_crew_user", (q) => q.eq("crewId", crewId).eq("userId", userId))
    .first();
}

async function activeMembers(
  ctx: Ctx,
  crewId: Id<"fantasyCrews">,
): Promise<Doc<"fantasyCrewMembers">[]> {
  const all = await ctx.db
    .query("fantasyCrewMembers")
    .withIndex("by_crew", (q) => q.eq("crewId", crewId))
    .collect();
  return all.filter((m) => m.active);
}

async function requireActiveMember(
  ctx: Ctx,
  crewId: Id<"fantasyCrews">,
  userId: Id<"users">,
): Promise<Doc<"fantasyCrewMembers">> {
  const membership = await membershipOf(ctx, crewId, userId);
  if (membership === null || !membership.active) throw new Error(NOT_A_MEMBER);
  return membership;
}

/**
 * The gameweek a new room drafts for: the open gameweek (upcoming or live)
 * with the earliest finality cut — i.e. THE weekend at hand. "Live" is
 * included on purpose: a crew drafting Saturday morning drafts the running
 * weekend, not the next one; players already underway are then excluded pick
 * by pick (the FW-1 hindsight rule), never the whole gameweek.
 */
async function targetGameweek(ctx: Ctx): Promise<Doc<"fantasyGameweeks">> {
  const candidates: Doc<"fantasyGameweeks">[] = [];
  for (const status of ["upcoming", "live"] as const) {
    candidates.push(
      ...(await ctx.db
        .query("fantasyGameweeks")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect()),
    );
  }
  if (candidates.length === 0) throw new Error(NO_OPEN_GAMEWEEK);
  return candidates.reduce((a, b) => (b.finalityAt < a.finalityAt ? b : a));
}

// ── room helpers ──

function seatIndexOf(room: Room, userId: Id<"users">): number {
  return room.seats.findIndex((seat) => seat.userId === userId);
}

function assertLobby(room: Room): void {
  if (room.status !== "lobby") throw new Error(ROOM_NOT_LOBBY);
}

/** The seat on the clock right now, or null outside DRAFTING. */
function currentSeatIndex(room: Room): number | null {
  if (
    room.status !== "drafting" ||
    room.snakeOrder === undefined ||
    room.currentPickIndex === undefined
  ) {
    return null;
  }
  return seatIndexForPick(room.snakeOrder, room.currentPickIndex);
}

async function lastLogSeq(ctx: Ctx, roomId: Id<"fantasyDraftRooms">): Promise<number> {
  const last = await ctx.db
    .query("fantasyDraftLog")
    .withIndex("by_room_seq", (q) => q.eq("roomId", roomId))
    .order("desc")
    .first();
  return last === null ? -1 : last.seq;
}

export async function pickEntries(
  ctx: Ctx,
  roomId: Id<"fantasyDraftRooms">,
): Promise<Doc<"fantasyDraftLog">[]> {
  const entries = await ctx.db
    .query("fantasyDraftLog")
    .withIndex("by_room_seq", (q) => q.eq("roomId", roomId))
    .collect();
  return entries.filter((e) => e.entryType === "pick");
}

/**
 * The full draftable pool for a room's gameweek, as engine snapshots: every
 * active player (R5: all of them, every gameweek), joined with pool metadata
 * and the gameweek's fixture map. Loaded at most once per mutation and shared
 * across a whole auto-pick chain — the reads are the expensive part.
 */
export async function loadPool(
  ctx: Ctx,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<{
  pool: DraftPoolPlayer[];
  playersById: Map<string, Doc<"fantasyPlayers">>;
}> {
  const players = await ctx.db.query("fantasyPlayers").collect();
  const metaRows = await ctx.db.query("fantasyDraftPoolMeta").collect();
  const metaByPlayer = new Map(metaRows.map((m) => [m.playerId as string, m]));

  const fixtures = await ctx.db
    .query("fantasyFixtures")
    .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweekId))
    .collect();
  const kickoffByClub = new Map<string, number>();
  for (const fixture of fixtures) {
    for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
      const seen = kickoffByClub.get(clubId);
      if (seen === undefined || fixture.kickoffAt < seen) {
        kickoffByClub.set(clubId, fixture.kickoffAt);
      }
    }
  }

  const playersById = new Map<string, Doc<"fantasyPlayers">>();
  const pool: DraftPoolPlayer[] = [];
  for (const player of players) {
    playersById.set(player._id, player);
    const meta = metaByPlayer.get(player._id);
    const kickoffAt = kickoffByClub.get(player.clubId) ?? null;
    pool.push({
      _id: player._id,
      providerPlayerId: player.providerPlayerId,
      clubId: player.clubId,
      price: player.price,
      active: player.active,
      pool: meta?.pool ?? null,
      proxy: meta?.proxy ?? null,
      hasFixture: kickoffAt !== null,
      kickoffAt,
    });
  }
  return { pool, playersById };
}

/** A seat's club counts so far, from the pick log. */
export function clubCountsFor(
  seatIndex: number,
  picks: readonly Doc<"fantasyDraftLog">[],
  playersById: ReadonlyMap<string, Doc<"fantasyPlayers">>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of picks) {
    if (entry.seatIndex !== seatIndex || entry.playerId === undefined) continue;
    const player = playersById.get(entry.playerId);
    if (player === undefined) continue;
    counts.set(player.clubId, (counts.get(player.clubId) ?? 0) + 1);
  }
  return counts;
}

// ── the pick applier ──
//
// The single write path every pick goes through, human or auto. It appends
// the log entry, drains the bank, then advances the cursor — auto-picking
// straight through any zero-bank seats it lands on (ruling R2: "every
// subsequent turn auto-picks instantly. No grace.") — and either schedules
// the next turn's timeout or completes the draft.
//
// Every pick patches the room doc, so Convex's per-document serialization
// makes this the room's serialization point: two racing picks conflict on the
// room, the loser re-runs against fresh state and hits a guard. There is no
// LM5-style read-window to reason about.

export interface PickToApply {
  seatIndex: number;
  playerId: Id<"fantasyPlayers">;
  auto: boolean;
  elapsedMs: number;
}

/** Exported (not registered) for fantasyDraftSim, which drives simulated
 *  drafts through the REAL write path rather than a parallel one. */
export async function applyPickAndAdvance(
  ctx: MutationCtx,
  room: Room,
  first: PickToApply,
  now: number,
): Promise<void> {
  if (room.snakeOrder === undefined || room.currentPickIndex === undefined) {
    throw new Error("Internal: drafting room without snake order.");
  }
  const seats: Seat[] = room.seats.map((seat) => ({ ...seat }));
  const total = totalPicks(seats.length);
  const gameweek = await ctx.db.get(room.gameweekId);
  if (gameweek === null) throw new Error("Internal: room without gameweek.");

  // Lazily loaded, at most once, shared across the whole auto-pick chain.
  let poolCache: Awaited<ReturnType<typeof loadPool>> | null = null;
  let picksCache: Doc<"fantasyDraftLog">[] | null = null;
  const loadOnce = async () => {
    poolCache ??= await loadPool(ctx, room.gameweekId);
    picksCache ??= await pickEntries(ctx, room._id);
    return { ...poolCache, picks: picksCache };
  };

  let seq = await lastLogSeq(ctx, room._id);
  let pickIndex = room.currentPickIndex;

  const writePick = async (pick: PickToApply) => {
    seq += 1;
    const seat = seats[pick.seatIndex];
    seat.bankMs = Math.max(0, seat.bankMs - pick.elapsedMs);
    const entry = {
      roomId: room._id,
      seq,
      entryType: "pick" as const,
      at: now,
      pickNumber: pickIndex + 1,
      round: Math.floor(pickIndex / seats.length) + 1,
      seatIndex: pick.seatIndex,
      userId: seats[pick.seatIndex].userId,
      playerId: pick.playerId,
      auto: pick.auto,
      elapsedMs: pick.elapsedMs,
      bankAfterMs: seat.bankMs,
    };
    await ctx.db.insert("fantasyDraftLog", entry);
    picksCache?.push({ ...entry, _id: "" as Id<"fantasyDraftLog">, _creationTime: 0 });
    pickIndex += 1;
  };

  await writePick(first);

  // Advance: skip straight through exhausted banks (R2), stop on a live one.
  while (pickIndex < total) {
    const seatIndex = seatIndexForPick(room.snakeOrder, pickIndex);
    const seat = seats[seatIndex];
    if (seat.bankMs > 0) {
      await ctx.db.patch(room._id, {
        seats,
        currentPickIndex: pickIndex,
        turnStartedAt: now,
      });
      await ctx.scheduler.runAfter(
        seat.bankMs,
        internal.fantasyDraftRooms.turnTimeout,
        { roomId: room._id, expectedPickIndex: pickIndex },
      );
      return;
    }

    const { pool, playersById, picks } = await loadOnce();
    const picked = new Set(
      picks.map((p) => p.playerId as string).filter((id) => id !== undefined),
    );
    const choice = selectAutoPick(pool, {
      pickedPlayerIds: picked,
      clubCounts: clubCountsFor(seatIndex, picks, playersById),
      favoriteClub: seat.favoriteClubAtArm ?? null,
      now,
    });
    if (choice === null) {
      // 2,895 players cannot be exhausted by ≤104 picks; if we are here the
      // pool itself is gone and completing with a short squad would corrupt
      // the sheet handoff. Loudly is the only honest failure.
      throw new Error("Internal: draft pool exhausted mid-draft.");
    }
    await writePick({
      seatIndex,
      playerId: choice._id as Id<"fantasyPlayers">,
      auto: true,
      elapsedMs: 0, // an empty bank spends nothing; the emptying pick spent it
    });
  }

  // Draft complete.
  await ctx.db.patch(room._id, {
    seats,
    currentPickIndex: total,
    turnStartedAt: undefined,
    status: "completed",
    completedAt: now,
  });
  await materializeSquads(ctx, { ...room, seats }, now);
}

/**
 * Timeout path shared by the scheduled hop, the sweep, and a human pick that
 * arrives after its bank died (R2 leaves that pick to the bot either way).
 * Idempotent by guard: wrong status or a moved cursor means the work is done.
 */
async function runTurnTimeout(
  ctx: MutationCtx,
  room: Room,
  expectedPickIndex: number,
  now: number,
): Promise<void> {
  if (room.status !== "drafting") return;
  if (room.currentPickIndex !== expectedPickIndex) return;
  if (room.turnStartedAt === undefined || room.snakeOrder === undefined) return;

  const seatIndex = seatIndexForPick(room.snakeOrder, expectedPickIndex);
  const seat = room.seats[seatIndex];

  if (!bankExhausted(room.turnStartedAt, now, seat.bankMs)) {
    // Fired early (clock jitter, or a sweep double-checking): the turn is
    // still live. Re-arm for the true remainder and step aside.
    const remaining = seat.bankMs - elapsedOnTurn(room.turnStartedAt, now, seat.bankMs);
    await ctx.scheduler.runAfter(remaining, internal.fantasyDraftRooms.turnTimeout, {
      roomId: room._id,
      expectedPickIndex,
    });
    return;
  }

  const { pool, playersById } = await loadPool(ctx, room.gameweekId);
  const picks = await pickEntries(ctx, room._id);
  const picked = new Set(
    picks.map((p) => p.playerId as string).filter((id) => id !== undefined),
  );
  const choice = selectAutoPick(pool, {
    pickedPlayerIds: picked,
    clubCounts: clubCountsFor(seatIndex, picks, playersById),
    favoriteClub: seat.favoriteClubAtArm ?? null,
    now,
  });
  if (choice === null) throw new Error("Internal: draft pool exhausted mid-draft.");

  await applyPickAndAdvance(
    ctx,
    room,
    {
      seatIndex,
      playerId: choice._id as Id<"fantasyPlayers">,
      auto: true,
      elapsedMs: seat.bankMs, // the timeout drains the bank to zero
    },
    now,
  );
}

// ── sheet handoff (P3) ──

/**
 * Materialize every seat's drafted 13 into the FW-1 squad model, with the R6
 * default arrangement. Runs inside the completing mutation, so a completed
 * room and its squads appear atomically — there is no state in which the
 * draft is over but a drafter has no sheet (LM7: every state cold-loads).
 *
 * Inserts rows directly rather than calling fantasySquads.createSquad: that
 * mutation authorizes THE CALLER, and the completing transaction acts for all
 * seats at once (including a leaver's — ruling R7: their squad persists and
 * auto-manages). The rows written are exactly the shape createSquad writes.
 */
async function materializeSquads(ctx: MutationCtx, room: Room, now: number): Promise<void> {
  const picks = await pickEntries(ctx, room._id);
  const contextKey = `crew:${room._id}`;

  for (let seatIndex = 0; seatIndex < room.seats.length; seatIndex += 1) {
    const seat = room.seats[seatIndex];

    // Idempotency: a completed draft materializes once. If a retry of the
    // completing mutation re-runs this, the existing squad is the answer.
    const existing = await ctx.db
      .query("fantasySquads")
      .withIndex("by_user_gameweek_contextKey", (q) =>
        q
          .eq("userId", seat.userId)
          .eq("gameweekId", room.gameweekId)
          .eq("contextKey", contextKey),
      )
      .first();
    if (existing !== null) continue;

    const seatPicks = picks
      .filter((p) => p.seatIndex === seatIndex && p.playerId !== undefined)
      .sort((a, b) => (a.pickNumber ?? 0) - (b.pickNumber ?? 0));
    if (seatPicks.length !== SQUAD_SIZE) {
      throw new Error(
        `Internal: seat ${seatIndex} drafted ${seatPicks.length} players, expected ${SQUAD_SIZE}.`,
      );
    }

    const drafted = [];
    for (const pick of seatPicks) {
      const player = await ctx.db.get(pick.playerId!);
      if (player === null) throw new Error("Internal: drafted player vanished.");
      drafted.push({
        _id: player._id as string,
        providerPlayerId: player.providerPlayerId,
        price: player.price,
        feedPosition: player.feedPosition,
      });
    }

    const squadId = await ctx.db.insert("fantasySquads", {
      userId: seat.userId,
      gameweekId: room.gameweekId,
      context: "crew",
      crewRoomId: room._id,
      contextKey,
      // "The favorite in force when the room arms is the one that counts" —
      // the arm-time snapshot flows through to every club-cap check the
      // FW-1 sheet mutations will ever run on this squad.
      favoriteClubAtBuild: seat.favoriteClubAtArm ?? null,
      createdAt: now,
    });

    for (const slot of defaultSheetAssignment(drafted)) {
      await ctx.db.insert("fantasySquadSlots", {
        squadId,
        slotIndex: slot.slotIndex,
        playerId: slot.playerId as Id<"fantasyPlayers">,
        slotRole: slot.slotRole,
        isFinisher: slot.isFinisher,
      });
    }
  }
}

// ── crew mutations ──

export const createCrew = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireUserId(ctx);
    const user = await assertUsernameRequiredUser(ctx, userId);

    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 32) {
      throw new Error("A crew name is 2–32 characters.");
    }

    const now = Date.now();
    const code = await generateUniqueCrewCode(ctx);
    const crewId = await ctx.db.insert("fantasyCrews", {
      code,
      name: trimmed,
      createdBy: userId,
      createdAt: now,
    });
    await ctx.db.insert("fantasyCrewMembers", {
      crewId,
      userId,
      nameSnapshot: user.username ?? "Host",
      active: true,
      joinedAt: now,
    });
    return { crewId, code };
  },
});

export const joinCrew = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireUserId(ctx);
    const user = await assertUsernameRequiredUser(ctx, userId);

    const crew = await ctx.db
      .query("fantasyCrews")
      .withIndex("by_code", (q) => q.eq("code", normalizeCode(code)))
      .first();
    if (crew === null) throw new Error(CREW_NOT_FOUND);

    const existing = await membershipOf(ctx, crew._id, userId);
    if (existing !== null && existing.active) {
      return { crewId: crew._id, code: crew.code }; // idempotent rejoin
    }

    const members = await activeMembers(ctx, crew._id);
    if (members.length >= CREW_MAX_DRAFTERS) throw new Error(CREW_FULL);

    if (existing !== null) {
      await ctx.db.patch(existing._id, { active: true });
    } else {
      await ctx.db.insert("fantasyCrewMembers", {
        crewId: crew._id,
        userId,
        nameSnapshot: user.username ?? "Drafter",
        active: true,
        joinedAt: Date.now(),
      });
    }
    return { crewId: crew._id, code: crew.code };
  },
});

export const leaveCrew = mutation({
  args: { crewId: v.id("fantasyCrews") },
  handler: async (ctx, { crewId }) => {
    const userId = await requireUserId(ctx);
    const membership = await requireActiveMember(ctx, crewId, userId);
    // Ruling R7 makes this safe mid-draft: an armed room's seats are frozen,
    // so leaving the crew never touches a running or completed draft — the
    // leaver's squad persists and auto-manages via sheet defaults + locks.
    await ctx.db.patch(membership._id, { active: false });
    return { ok: true };
  },
});

// ── room mutations ──

export const createRoom = mutation({
  args: { crewId: v.id("fantasyCrews") },
  handler: async (ctx, { crewId }) => {
    const userId = await requireUserId(ctx);
    const member = await requireActiveMember(ctx, crewId, userId);
    const gameweek = await targetGameweek(ctx);

    const siblings = await ctx.db
      .query("fantasyDraftRooms")
      .withIndex("by_crew_gameweek", (q) =>
        q.eq("crewId", crewId).eq("gameweekId", gameweek._id),
      )
      .collect();
    if (siblings.some((room) => room.status !== "abandoned")) {
      throw new Error(ROOM_ALREADY_OPEN);
    }

    const now = Date.now();
    const roomId = await ctx.db.insert("fantasyDraftRooms", {
      crewId,
      gameweekId: gameweek._id,
      status: "lobby",
      createdBy: userId,
      createdAt: now,
      seats: [
        {
          userId,
          nameSnapshot: member.nameSnapshot,
          ready: false,
          joinedAt: now,
          bankMs: DRAFT_BANK_MS,
        },
      ],
      expiresAt: now + DRAFT_ROOM_LOBBY_TTL_MS,
    });
    return { roomId };
  },
});

export const joinRoom = mutation({
  args: { roomId: v.id("fantasyDraftRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(roomId);
    if (room === null) throw new Error(ROOM_NOT_FOUND);
    const member = await requireActiveMember(ctx, room.crewId, userId);
    assertLobby(room); // R7: seats freeze at arm; joining later is not a thing

    if (seatIndexOf(room, userId) >= 0) return { roomId }; // idempotent
    if (room.seats.length >= CREW_MAX_DRAFTERS) throw new Error(CREW_FULL);

    await ctx.db.patch(roomId, {
      seats: [
        ...room.seats,
        {
          userId,
          nameSnapshot: member.nameSnapshot,
          ready: false,
          joinedAt: Date.now(),
          bankMs: DRAFT_BANK_MS,
        },
      ],
    });
    return { roomId };
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.id("fantasyDraftRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(roomId);
    if (room === null) throw new Error(ROOM_NOT_FOUND);
    assertLobby(room); // past the lobby there is nothing to leave (R7)

    const seatIndex = seatIndexOf(room, userId);
    if (seatIndex < 0) return { ok: true };

    const seats = room.seats.filter((_, i) => i !== seatIndex);
    if (seats.length === 0) {
      await ctx.db.patch(roomId, { seats, status: "abandoned" });
      return { ok: true };
    }
    await ctx.db.patch(roomId, {
      seats,
      // The creator walking out hands the arm switch to the oldest seat —
      // Arena's host-transfer rule, so a lobby is never creator-less.
      createdBy: room.createdBy === userId ? seats[0].userId : room.createdBy,
    });
    return { ok: true };
  },
});

export const setSeatReady = mutation({
  args: { roomId: v.id("fantasyDraftRooms"), ready: v.boolean() },
  handler: async (ctx, { roomId, ready }) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(roomId);
    if (room === null) throw new Error(ROOM_NOT_FOUND);
    assertLobby(room);

    const seatIndex = seatIndexOf(room, userId);
    if (seatIndex < 0) throw new Error(NOT_A_MEMBER);

    const seats = room.seats.map((seat, i) =>
      i === seatIndex ? { ...seat, ready } : seat,
    );
    await ctx.db.patch(roomId, { seats });
    return { ready };
  },
});

/**
 * Arm the draft — ruling R3: creator-initiated, behind an all-ready gate. No
 * scheduled drafts, no force-start. Stamps the R7 freeze (seat list is now
 * immutable), each seat's favorite-in-force (§Favorite-club exemption), the
 * R4 seed + snake order (log entry 0), and schedules the reveal→drafting hop.
 */
export const armDraft = mutation({
  args: { roomId: v.id("fantasyDraftRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(roomId);
    if (room === null) throw new Error(ROOM_NOT_FOUND);
    assertLobby(room);
    if (room.createdBy !== userId) throw new Error(NOT_ROOM_CREATOR);
    if (room.seats.length < CREW_MIN_DRAFTERS) throw new Error(NOT_ENOUGH_DRAFTERS);
    if (!room.seats.every((seat) => seat.ready)) throw new Error(NOT_ALL_READY);

    const now = Date.now();
    const crew = await ctx.db.get(room.crewId);
    if (crew === null) throw new Error(ROOM_NOT_FOUND);

    const seats: Seat[] = [];
    for (const seat of room.seats) {
      const user = await ctx.db.get(seat.userId);
      seats.push({
        ...seat,
        favoriteClubAtArm: user === null ? null : resolveFavoriteClub(user, now),
      });
    }

    const seed = hashString(`${room._id}:${crew.code}:${now}`);
    const snakeOrder = snakeOrderFor(seats.length, seed);

    await ctx.db.insert("fantasyDraftLog", {
      roomId,
      seq: 0,
      entryType: "seed",
      at: now,
      seed,
      snakeOrder,
    });
    await ctx.db.patch(roomId, {
      seats,
      status: "order_reveal",
      seed,
      snakeOrder,
      orderRevealedAt: now,
    });
    await ctx.scheduler.runAfter(ORDER_REVEAL_MS, internal.fantasyDraftRooms.beginDrafting, {
      roomId,
    });
    return { seed, snakeOrder };
  },
});

export const beginDrafting = internalMutation({
  args: { roomId: v.id("fantasyDraftRooms") },
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (room === null) return;
    if (room.status !== "order_reveal") return; // idempotent (LM8)
    if (room.snakeOrder === undefined) return;

    const now = Date.now();
    const firstSeat = room.seats[seatIndexForPick(room.snakeOrder, 0)];
    await ctx.db.patch(roomId, {
      status: "drafting",
      draftStartedAt: now,
      currentPickIndex: 0,
      turnStartedAt: now,
    });
    await ctx.scheduler.runAfter(firstSeat.bankMs, internal.fantasyDraftRooms.turnTimeout, {
      roomId,
      expectedPickIndex: 0,
    });
  },
});

export const makePick = mutation({
  args: {
    roomId: v.id("fantasyDraftRooms"),
    playerId: v.id("fantasyPlayers"),
  },
  handler: async (ctx, { roomId, playerId }) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(roomId);
    if (room === null) throw new Error(ROOM_NOT_FOUND);
    if (room.status !== "drafting") throw new Error(NOT_YOUR_TURN);
    if (
      room.snakeOrder === undefined ||
      room.currentPickIndex === undefined ||
      room.turnStartedAt === undefined
    ) {
      throw new Error(NOT_YOUR_TURN);
    }

    const seatIndex = seatIndexForPick(room.snakeOrder, room.currentPickIndex);
    if (room.seats[seatIndex].userId !== userId) throw new Error(NOT_YOUR_TURN);

    const now = Date.now();
    const seat = room.seats[seatIndex];

    // Bank already dead: ruling R2 gives this pick to the bot, whoever's
    // mutation lands first. Same outcome as the scheduled timeout — the human
    // choice arrived after the clock took the turn away.
    if (bankExhausted(room.turnStartedAt, now, seat.bankMs)) {
      await runTurnTimeout(ctx, room, room.currentPickIndex, now);
      return { auto: true as const };
    }

    const player = await ctx.db.get(playerId);
    if (player === null) throw new Error("Player not found.");
    if (!player.active) throw new Error(`${player.name} is not available this season.`);

    // Crew-internal exclusivity (unique ownership within the room, R7).
    const alreadyPicked = await ctx.db
      .query("fantasyDraftLog")
      .withIndex("by_room_player", (q) => q.eq("roomId", roomId).eq("playerId", playerId))
      .first();
    if (alreadyPicked !== null) throw new Error(PLAYER_TAKEN);

    // R5: a player with NO fixture this gameweek is human-pickable (badged in
    // the UI, skipped only by auto-pick). A player whose fixture has STARTED
    // is not — the FW-1 hindsight rule, same as swapping into a budget squad.
    const fixtures = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_home", (q) =>
        q.eq("gameweekId", room.gameweekId).eq("homeClubId", player.clubId),
      )
      .collect();
    const awayFixtures = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_away", (q) =>
        q.eq("gameweekId", room.gameweekId).eq("awayClubId", player.clubId),
      )
      .collect();
    const kickoffs = [...fixtures, ...awayFixtures].map((f) => f.kickoffAt);
    if (kickoffs.length > 0 && Math.min(...kickoffs) <= now) {
      throw new Error(PLAYER_STARTED);
    }

    // Club cap, against the arm-time favorite snapshot.
    const picks = await pickEntries(ctx, roomId);
    const playersById = new Map<string, Doc<"fantasyPlayers">>();
    for (const entry of picks) {
      if (entry.playerId === undefined) continue;
      if (playersById.has(entry.playerId)) continue;
      const picked = await ctx.db.get(entry.playerId);
      if (picked !== null) playersById.set(picked._id, picked);
    }
    const counts = clubCountsFor(seatIndex, picks, playersById);
    if (clubCapBlocks(player.clubId, counts, seat.favoriteClubAtArm ?? null)) {
      throw new Error(CLUB_CAP_REACHED);
    }

    await applyPickAndAdvance(
      ctx,
      room,
      {
        seatIndex,
        playerId,
        auto: false,
        elapsedMs: elapsedOnTurn(room.turnStartedAt, now, seat.bankMs),
      },
      now,
    );
    return { auto: false as const };
  },
});

export const turnTimeout = internalMutation({
  args: {
    roomId: v.id("fantasyDraftRooms"),
    expectedPickIndex: v.number(),
  },
  handler: async (ctx, { roomId, expectedPickIndex }) => {
    const room = await ctx.db.get(roomId);
    if (room === null) return;
    await runTurnTimeout(ctx, room, expectedPickIndex, Date.now());
  },
});

/**
 * The safety net (cron): expires dead lobbies, and re-drives any room whose
 * scheduled hop was lost — a stuck order_reveal or an overdue turn. Every
 * action delegates to the same guarded functions the scheduler uses, so
 * sweeping a healthy room is a no-op by construction (LM8), and a lost
 * schedule costs at most one sweep interval of stall (LM4's fix: the
 * persisted timers have a consumer).
 */
export const draftRoomSweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let expired = 0;
    let rekicked = 0;

    const lobbies = await ctx.db
      .query("fantasyDraftRooms")
      .withIndex("by_status", (q) => q.eq("status", "lobby"))
      .take(SWEEP_BATCH);
    for (const room of lobbies) {
      if (room.expiresAt <= now) {
        await ctx.db.patch(room._id, { status: "abandoned" });
        expired += 1;
      }
    }

    const revealing = await ctx.db
      .query("fantasyDraftRooms")
      .withIndex("by_status", (q) => q.eq("status", "order_reveal"))
      .take(SWEEP_BATCH);
    for (const room of revealing) {
      if ((room.orderRevealedAt ?? 0) + ORDER_REVEAL_MS + SWEEP_SLACK_MS <= now) {
        await ctx.scheduler.runAfter(0, internal.fantasyDraftRooms.beginDrafting, {
          roomId: room._id,
        });
        rekicked += 1;
      }
    }

    const drafting = await ctx.db
      .query("fantasyDraftRooms")
      .withIndex("by_status", (q) => q.eq("status", "drafting"))
      .take(SWEEP_BATCH);
    for (const room of drafting) {
      if (
        room.turnStartedAt === undefined ||
        room.currentPickIndex === undefined ||
        room.snakeOrder === undefined
      ) {
        continue;
      }
      const seat = room.seats[seatIndexForPick(room.snakeOrder, room.currentPickIndex)];
      if (room.turnStartedAt + seat.bankMs + SWEEP_SLACK_MS <= now) {
        await ctx.scheduler.runAfter(0, internal.fantasyDraftRooms.turnTimeout, {
          roomId: room._id,
          expectedPickIndex: room.currentPickIndex,
        });
        rekicked += 1;
      }
    }

    return { expired, rekicked, now };
  },
});

// ── queries ──

/**
 * The crew page read model: crew, members, rooms (the crew table skeleton).
 * Members only — crews are invite-only and there are no spectator seats.
 */
export const getCrew = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const crew = await ctx.db
      .query("fantasyCrews")
      .withIndex("by_code", (q) => q.eq("code", normalizeCode(code)))
      .first();
    if (crew === null) return null;

    const membership = await membershipOf(ctx, crew._id, userId);
    if (membership === null || !membership.active) return null;

    const members = await ctx.db
      .query("fantasyCrewMembers")
      .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
      .collect();

    const rooms = await ctx.db
      .query("fantasyDraftRooms")
      .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
      .collect();
    const roomSummaries = [];
    for (const room of rooms) {
      if (room.status === "abandoned") continue;
      const gameweek = await ctx.db.get(room.gameweekId);
      roomSummaries.push({
        roomId: room._id,
        status: room.status,
        createdBy: room.createdBy,
        seatCount: room.seats.length,
        seated: seatIndexOf(room, userId) >= 0,
        completedAt: room.completedAt ?? null,
        gameweek:
          gameweek === null
            ? null
            : { gwNumber: gameweek.gwNumber, season: gameweek.season, status: gameweek.status },
      });
    }
    roomSummaries.sort((a, b) => (b.completedAt ?? Infinity) - (a.completedAt ?? Infinity));

    return {
      crewId: crew._id,
      code: crew.code,
      name: crew.name,
      createdBy: crew.createdBy,
      isMe: userId,
      members: members
        .filter((m) => m.active)
        .map((m) => ({ userId: m.userId, name: m.nameSnapshot, joinedAt: m.joinedAt })),
      rooms: roomSummaries,
    };
  },
});

/** Every crew the caller belongs to, for the weekend hub. */
export const listMyCrews = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const memberships = await ctx.db
      .query("fantasyCrewMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const out = [];
    for (const membership of memberships) {
      if (!membership.active) continue;
      const crew = await ctx.db.get(membership.crewId);
      if (crew === null) continue;
      const rooms = await ctx.db
        .query("fantasyDraftRooms")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .collect();
      const live = rooms.find(
        (r) => r.status === "lobby" || r.status === "order_reveal" || r.status === "drafting",
      );
      const memberCount = (await activeMembers(ctx, crew._id)).length;
      out.push({
        crewId: crew._id,
        code: crew.code,
        name: crew.name,
        memberCount,
        liveRoomId: live?._id ?? null,
        liveRoomStatus: live?.status ?? null,
      });
    }
    return out;
  },
});

/**
 * The room read model — complete for every status (LM7), all timer facts as
 * server timestamps plus serverNow for client offset correction (LM12).
 */
export const getRoom = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const roomId = ctx.db.normalizeId("fantasyDraftRooms", args.roomId);
    if (roomId === null) return null;
    const room = await ctx.db.get(roomId);
    if (room === null) return null;

    const membership = await membershipOf(ctx, room.crewId, userId);
    if (membership === null || !membership.active) return null;

    const crew = await ctx.db.get(room.crewId);
    const gameweek = await ctx.db.get(room.gameweekId);
    const entries = await ctx.db
      .query("fantasyDraftLog")
      .withIndex("by_room_seq", (q) => q.eq("roomId", roomId))
      .collect();

    const seatIndex = seatIndexOf(room, userId);
    const turnSeatIndex = currentSeatIndex(room);

    return {
      roomId: room._id,
      status: room.status,
      crew: crew === null ? null : { code: crew.code, name: crew.name },
      gameweek:
        gameweek === null
          ? null
          : { gwNumber: gameweek.gwNumber, season: gameweek.season, status: gameweek.status },
      createdBy: room.createdBy,
      mySeatIndex: seatIndex < 0 ? null : seatIndex,
      seats: room.seats.map((seat) => ({
        userId: seat.userId,
        name: seat.nameSnapshot,
        ready: seat.ready,
        bankMs: seat.bankMs,
        favoriteClubAtArm: seat.favoriteClubAtArm ?? null,
      })),
      seed: room.seed ?? null,
      snakeOrder: room.snakeOrder ?? null,
      orderRevealedAt: room.orderRevealedAt ?? null,
      orderRevealMs: ORDER_REVEAL_MS,
      currentPickIndex: room.currentPickIndex ?? null,
      turnSeatIndex,
      turnStartedAt: room.turnStartedAt ?? null,
      totalPicks: totalPicks(room.seats.length),
      completedAt: room.completedAt ?? null,
      picks: entries
        .filter((e) => e.entryType === "pick")
        .map((e) => ({
          seq: e.seq,
          pickNumber: e.pickNumber ?? 0,
          round: e.round ?? 0,
          seatIndex: e.seatIndex ?? 0,
          playerId: e.playerId ?? null,
          auto: e.auto ?? false,
          elapsedMs: e.elapsedMs ?? 0,
          bankAfterMs: e.bankAfterMs ?? 0,
          at: e.at,
        })),
      serverNow: Date.now(),
    };
  },
});

/**
 * The draftable pool for a room's gameweek: every active player with price,
 * cohort metadata and fixture presence (the R5 no-fixture badge). Static per
 * gameweek — availability is derived client-side from getRoom's picks, so
 * this query does NOT re-run on every pick.
 */
export const getDraftPool = query({
  args: { roomId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const roomId = ctx.db.normalizeId("fantasyDraftRooms", args.roomId);
    if (roomId === null) return null;
    const room = await ctx.db.get(roomId);
    if (room === null) return null;
    const membership = await membershipOf(ctx, room.crewId, userId);
    if (membership === null || !membership.active) return null;

    const { pool, playersById } = await loadPool(ctx, room.gameweekId);
    const metaRows = await ctx.db.query("fantasyDraftPoolMeta").collect();
    const clubNameByPlayer = new Map(
      metaRows.map((m) => [m.playerId as string, m.clubName ?? null]),
    );

    return pool
      .filter((p) => p.active)
      .map((p) => {
        const doc = playersById.get(p._id);
        return {
          playerId: p._id,
          name: doc?.name ?? "",
          clubId: p.clubId,
          clubName: clubNameByPlayer.get(p._id) ?? null,
          position: doc?.feedPosition ?? "MID",
          price: p.price,
          pool: p.pool,
          hasFixture: p.hasFixture,
          kickoffAt: p.kickoffAt,
        };
      });
  },
});

// ── pool-meta seed (FW-3, DEV; pattern of fantasyIngest.upsertPrices) ──

const poolMetaValidator = v.object({
  providerPlayerId: v.string(),
  pool: v.union(v.literal("topfive"), v.literal("promoted"), v.literal("flagged")),
  proxy: v.union(v.number(), v.null()),
  clubName: v.optional(v.string()),
});

/**
 * Write R1 auto-pick metadata (pool cohort, proxy, display club name) from
 * research/fantasy/pricing/price-final.json. Strictly additive side-table
 * upsert — fantasyPlayers is never touched. Idempotent: re-running with the
 * same artifact rewrites identical rows.
 */
export const upsertDraftPoolMeta = internalMutation({
  args: { entries: v.array(poolMetaValidator) },
  handler: async (ctx, { entries }) => {
    let created = 0;
    let updated = 0;
    let missing = 0;

    for (const entry of entries) {
      const player = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) =>
          q.eq("providerPlayerId", entry.providerPlayerId),
        )
        .first();
      if (player === null) {
        missing += 1;
        continue;
      }
      const existing = await ctx.db
        .query("fantasyDraftPoolMeta")
        .withIndex("by_player", (q) => q.eq("playerId", player._id))
        .first();
      if (existing === null) {
        await ctx.db.insert("fantasyDraftPoolMeta", {
          playerId: player._id,
          pool: entry.pool,
          proxy: entry.proxy,
          ...(entry.clubName === undefined ? {} : { clubName: entry.clubName }),
        });
        created += 1;
      } else {
        await ctx.db.patch(existing._id, {
          pool: entry.pool,
          proxy: entry.proxy,
          ...(entry.clubName === undefined ? {} : { clubName: entry.clubName }),
        });
        updated += 1;
      }
    }
    return { requested: entries.length, created, updated, missing };
  },
});
