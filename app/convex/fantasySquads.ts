/**
 * Weekend Fantasy — squad mutations (FW-1 Phase 2).
 *
 * Server-authoritative throughout, in the house posture (convex/draw.ts): the
 * client submits an intent, the server rebuilds the resulting squad from its
 * own data, validates every invariant against it, and only then writes. No
 * lock state, price, formation or favorite club is ever accepted from a
 * client, and no edit is applied unless the squad it produces is fully legal.
 *
 * Specs: BUDGET_MODE_SPEC.md v1.1.0, DRAFT_ROOM_SPEC.md v1.1.0.
 *
 * Rules live in lib/fantasySquadRules.ts (pure) and lib/fantasyFavoriteClub.ts
 * (pure); locks live in fantasyLocks.ts. This module is the thin authorized
 * wrapper around them.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  FINISHER_COUNT,
  SQUAD_BUDGET,
  SQUAD_SIZE,
  type SlotRole,
} from "./lib/fantasyConstants";
import {
  describeViolations,
  validateBudget,
  validateFormation,
  validateSquad,
  type PlayerSnapshot,
  type SlotSnapshot,
} from "./lib/fantasySquadRules";
import {
  hasPendingFavoriteChange,
  pendingFavoriteEffectiveFrom,
  planFavoriteClubChange,
  resolveFavoriteClub,
} from "./lib/fantasyFavoriteClub";
import {
  FIXTURE_MISSING_MESSAGE,
  fixtureForClub,
  kickoffHasPassed,
  lockStateForSlots,
} from "./fantasyLocks";

export const SIGN_IN_REQUIRED = "Sign in to build a fantasy squad.";
export const SQUAD_NOT_FOUND = "Squad not found.";
export const NOT_YOUR_SQUAD = "That squad belongs to another user.";
export const SLOT_LOCKED =
  "That player's match has kicked off — his slot is locked for this gameweek.";
export const CREW_SQUAD_PLAYERS_FIXED =
  "A crew squad's players are set by the draft — rearrange your sheet, but the 13 are the 13.";
export const CREW_SQUAD_DRAFT_ONLY =
  "Crew squads are created by the draft, not by hand — finish the draft and your sheet appears.";
export const PLAYER_ALREADY_STARTED =
  "That player's match has already kicked off; he can no longer be selected.";
export const GAMEWEEK_CLOSED = "This gameweek is no longer open for edits.";

const slotRoleValidator = v.union(
  v.literal("GK"),
  v.literal("DEF"),
  v.literal("MID"),
  v.literal("ATT"),
);

// ── helpers ──

const slotRole = (role: string): SlotRole => role as SlotRole;

/** A gameweek accepts edits while it is upcoming or live; per-fixture locks do
 *  the fine-grained work. Once settling/final, the weekend is over. */
function gameweekAcceptsEdits(gameweek: Doc<"fantasyGameweeks">): boolean {
  return gameweek.status === "upcoming" || gameweek.status === "live";
}

function toSlotSnapshot(
  slot: Doc<"fantasySquadSlots">,
  override?: Partial<SlotSnapshot>,
): SlotSnapshot {
  return {
    slotIndex: slot.slotIndex,
    slotRole: slot.slotRole,
    isFinisher: slot.isFinisher,
    playerId: slot.playerId ?? null,
    lockedAt: slot.lockedAt ?? null,
    committedPrice: slot.committedPrice ?? null,
    ...override,
  };
}

function toPlayerSnapshot(player: Doc<"fantasyPlayers">): PlayerSnapshot {
  return {
    _id: player._id,
    clubId: player.clubId,
    price: player.price,
    active: player.active,
    name: player.name,
  };
}

async function requireUserId(ctx: MutationCtx | QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error(SIGN_IN_REQUIRED);
  return userId;
}

async function loadOwnedSquad(
  ctx: MutationCtx,
  squadId: Id<"fantasySquads">,
  userId: Id<"users">,
): Promise<{ squad: Doc<"fantasySquads">; gameweek: Doc<"fantasyGameweeks"> }> {
  const squad = await ctx.db.get(squadId);
  if (squad === null) throw new Error(SQUAD_NOT_FOUND);
  if (squad.userId !== userId) throw new Error(NOT_YOUR_SQUAD);

  const gameweek = await ctx.db.get(squad.gameweekId);
  if (gameweek === null) throw new Error(SQUAD_NOT_FOUND);
  if (!gameweekAcceptsEdits(gameweek)) throw new Error(GAMEWEEK_CLOSED);

  return { squad, gameweek };
}

/** Load every player referenced by a slot set, keyed by id. */
async function loadPlayers(
  ctx: MutationCtx | QueryCtx,
  slots: readonly SlotSnapshot[],
): Promise<Map<string, PlayerSnapshot>> {
  const byId = new Map<string, PlayerSnapshot>();
  for (const slot of slots) {
    if (slot.playerId === null || byId.has(slot.playerId)) continue;
    const player = await ctx.db.get(slot.playerId as Id<"fantasyPlayers">);
    if (player !== null) byId.set(player._id, toPlayerSnapshot(player));
  }
  return byId;
}

/**
 * Validate the squad an edit WOULD produce, and throw if it is illegal.
 * Nothing is written before this returns.
 */
/**
 * Item 6: mark a crew sheet as the drafter's own work.
 *
 * The R6 default is applied EAGERLY at materialization (owner ruling: eager
 * is safer for cold loads), which makes a default sheet byte-identical to a
 * deliberate one — so "has this drafter arranged their team?" had no answer
 * at all. This bit is that answer. Set on the first arrangement edit that
 * actually commits, and never unset: a sheet that has been touched stays
 * touched even if the drafter puts everything back.
 *
 * Budget squads do not carry it — they have no server-authored default to be
 * distinguished from.
 */
async function markArranged(
  ctx: MutationCtx,
  squad: Doc<"fantasySquads">,
): Promise<void> {
  if (squad.context !== "crew") return;
  if (squad.arrangedByUser === true) return;
  await ctx.db.patch(squad._id, { arrangedByUser: true });
}

async function assertPostEditSquadLegal(
  ctx: MutationCtx,
  squad: Doc<"fantasySquads">,
  postEdit: readonly SlotSnapshot[],
  lockedByIndex: ReadonlyMap<number, boolean>,
  /**
   * The PRE-EDIT slots, for the FW-T1 R2 club-cap grandfather: a transfer can
   * push a standing squad over the cap, and the edit that must then still work
   * is one that does not raise the over-cap club's count. Players are loaded
   * over BOTH sets — a swapped-out player belongs to the baseline even though
   * no post-edit slot names him.
   */
  priorSlots: readonly SlotSnapshot[],
): Promise<void> {
  const playersById = await loadPlayers(ctx, [...postEdit, ...priorSlots]);
  const result = validateSquad({
    slots: postEdit,
    playersById,
    favoriteClub: squad.favoriteClubAtBuild,
    context: squad.context,
    isLocked: (slot) => lockedByIndex.get(slot.slotIndex) === true,
    budgetLimit: SQUAD_BUDGET,
    priorSlots,
  });
  if (!result.ok) throw new Error(describeViolations(result));
}

// ── createSquad ──

/**
 * Create the caller's BUDGET squad for a gameweek and materialize its 13 slots.
 *
 * `formation` describes the XI; `finisherRoles` gives the two finishers their
 * own slotRoles. Both are required rather than defaulted: FW-1 STOP-3 rules
 * finisher roles free, and DRAFT_ROOM's 4-4-2 default team sheet is explicitly
 * FW-3's to apply, so inventing a default here would pre-empt that ticket.
 *
 * ── F1: crew squads are draft output only ──
 *
 * `context` still accepts the literal so the argument shape is unchanged and
 * a stale client gets a clear message rather than a validator error — but a
 * crew squad is REFUSED here, unconditionally. This path never verified that
 * the caller was seated in `crewRoomId`, or that the room existed; a drafter
 * could mint an empty 13-slot squad at their own live room's contextKey, and
 * materialization would then skip them and discard their entire drafted 13
 * into a sheet no code path could fill (setSlot refuses to man crew squads).
 *
 * The only writer of crew squads is now
 * `fantasyDraftRooms.materializeRoomSquads`, which acts for every seat of a
 * completed draft at once and cannot be reached from a client.
 *
 * The favorite club is resolved ONCE, here, and snapshotted onto the squad —
 * DRAFT_ROOM §Favorite-club exemption: "the favorite in force when the room
 * arms is the one that counts".
 */
export const createSquad = mutation({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    context: v.union(v.literal("budget"), v.literal("crew")),
    crewRoomId: v.optional(v.string()),
    formation: v.object({
      GK: v.number(),
      DEF: v.number(),
      MID: v.number(),
      ATT: v.number(),
    }),
    finisherRoles: v.array(slotRoleValidator),
  },
  handler: async (ctx, { gameweekId, context, crewRoomId, formation, finisherRoles }) => {
    const userId = await requireUserId(ctx);

    assertPublicSquadCreateArgs(context, crewRoomId);

    return createBudgetSquadFor(ctx, userId, { gameweekId, formation, finisherRoles });
  },
});

/**
 * The F1 argument gate, verbatim from the wrapper above (extracted FW-VS1 so
 * the DEV sim can exercise the same throw — a pure refactor, no behavior
 * change): before anything else, including any read, there is no argument
 * combination that makes a crew squad from a public call.
 */
export function assertPublicSquadCreateArgs(
  context: "budget" | "crew",
  crewRoomId: string | undefined,
): void {
  if (context === "crew") throw new Error(CREW_SQUAD_DRAFT_ONLY);
  if (crewRoomId !== undefined) {
    throw new Error("A budget squad has no crew room.");
  }
}

/**
 * The budget-squad creation core, sans authentication — the seam the DEV
 * walkthrough sim drives (fantasyDraftSim precedent: the sim has no sessions,
 * so it calls the core the public mutation delegates to; the authorization
 * wrapper is the only thing it does not exercise).
 */
export async function createBudgetSquadFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  {
    gameweekId,
    formation,
    finisherRoles,
  }: {
    gameweekId: Id<"fantasyGameweeks">;
    formation: Record<SlotRole, number>;
    finisherRoles: SlotRole[];
  },
): Promise<{ squadId: Id<"fantasySquads">; favoriteClubAtBuild: string | null }> {
  {
    const gameweek = await ctx.db.get(gameweekId);
    if (gameweek === null) throw new Error("Gameweek not found.");
    if (!gameweekAcceptsEdits(gameweek)) throw new Error(GAMEWEEK_CLOSED);

    if (finisherRoles.length !== FINISHER_COUNT) {
      throw new Error(`A squad needs exactly ${FINISHER_COUNT} finisher roles.`);
    }

    const shape = validateFormation(formation);
    if (!shape.ok) throw new Error(describeViolations(shape));

    const contextKey = "budget";
    const existing = await ctx.db
      .query("fantasySquads")
      .withIndex("by_user_gameweek_contextKey", (q) =>
        q.eq("userId", userId).eq("gameweekId", gameweekId).eq("contextKey", contextKey),
      )
      .first();
    if (existing !== null) {
      throw new Error("You already have a squad for this gameweek.");
    }

    const user = await ctx.db.get(userId);
    // The cooldown is measured in time, not gameweeks (DRAFT_ROOM v1.0.2
    // ledger 7 / STOP-F), so this resolves against the clock at build time.
    const favoriteClubAtBuild =
      user === null ? null : resolveFavoriteClub(user, Date.now());

    const squadId = await ctx.db.insert("fantasySquads", {
      userId,
      gameweekId,
      context: "budget",
      contextKey,
      favoriteClubAtBuild,
      createdAt: Date.now(),
    });

    // XI slots first (0..10) in formation order, then the finishers (11, 12).
    const xiRoles: SlotRole[] = [];
    for (const role of ["GK", "DEF", "MID", "ATT"] as const) {
      for (let i = 0; i < formation[role]; i += 1) xiRoles.push(role);
    }

    let slotIndex = 0;
    for (const role of xiRoles) {
      await ctx.db.insert("fantasySquadSlots", {
        squadId,
        slotIndex,
        slotRole: role,
        isFinisher: false,
      });
      slotIndex += 1;
    }
    for (const role of finisherRoles) {
      await ctx.db.insert("fantasySquadSlots", {
        squadId,
        slotIndex,
        slotRole: slotRole(role),
        isFinisher: true,
      });
      slotIndex += 1;
    }

    if (slotIndex !== SQUAD_SIZE) {
      // Unreachable while validateFormation passes and finisherRoles is 2 —
      // asserted rather than assumed, because a wrong slot count would corrupt
      // every later invariant silently.
      throw new Error(`Internal: built ${slotIndex} slots, expected ${SQUAD_SIZE}.`);
    }

    return { squadId, favoriteClubAtBuild };
  }
}

// ── setSlot ──

/**
 * Edit one slot: swap the player, move it between XI and finisher, or change
 * its slotRole. Omitted fields are left alone; `playerId: null` empties the
 * slot (legal — BUDGET_MODE lets an unfilled slot ride and score zero).
 *
 * Rejects, in order: a locked target slot; a player whose own fixture has
 * already kicked off; then any squad-level invariant the edit would break.
 */
export const setSlot = mutation({
  args: {
    squadId: v.id("fantasySquads"),
    slotIndex: v.number(),
    playerId: v.optional(v.union(v.id("fantasyPlayers"), v.null())),
    slotRole: v.optional(slotRoleValidator),
    isFinisher: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return setSlotFor(ctx, userId, args);
  },
});

/** The setSlot core, sans authentication — see createBudgetSquadFor. */
export async function setSlotFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    squadId: Id<"fantasySquads">;
    slotIndex: number;
    playerId?: Id<"fantasyPlayers"> | null;
    slotRole?: SlotRole;
    isFinisher?: boolean;
  },
): Promise<{ ok: true }> {
  {
    const { squad, gameweek } = await loadOwnedSquad(ctx, args.squadId, userId);
    const now = Date.now();

    const slots = await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
      .collect();

    const target = slots.find((s) => s.slotIndex === args.slotIndex);
    if (target === undefined) throw new Error(`No slot ${args.slotIndex} in this squad.`);

    // FW-3: a crew squad's 13 players ARE the draft. DRAFT_ROOM locks unique
    // ownership within the room and puts trades out of scope, so the sheet
    // may be rearranged (slotRole, XI/finisher) but never re-manned — and
    // emptying a slot would break the drafted 13-players-13-slots bijection.
    if (squad.context === "crew" && args.playerId !== undefined) {
      throw new Error(CREW_SQUAD_PLAYERS_FIXED);
    }

    const lockedByIndex = await lockStateForSlots(ctx, gameweek._id, slots, now);

    // A locked slot is frozen in player, slot AND position — no exceptions,
    // and this check comes before anything else so a locked slot can never be
    // reached by a formation-shaped argument either.
    if (lockedByIndex.get(target.slotIndex) === true) throw new Error(SLOT_LOCKED);

    // Selecting a player whose match is already underway is rejected too —
    // BUDGET_MODE §Deadlines & editing (v1.0.1): "A player whose own fixture
    // has kicked off cannot be swapped IN (prevents hindsight selection)."
    if (args.playerId !== undefined && args.playerId !== null) {
      const player = await ctx.db.get(args.playerId);
      if (player === null) throw new Error("Player not found.");
      if (!player.active) throw new Error(`${player.name} is not available this gameweek.`);

      const fixture = await fixtureForClub(ctx, gameweek._id, player.clubId);
      if (fixture === null) throw new Error(FIXTURE_MISSING_MESSAGE);
      if (kickoffHasPassed(fixture.kickoffAt, now)) throw new Error(PLAYER_ALREADY_STARTED);
    }

    const postEdit = slots.map((slot) =>
      slot.slotIndex === args.slotIndex
        ? toSlotSnapshot(slot, {
            ...(args.playerId === undefined ? {} : { playerId: args.playerId }),
            ...(args.slotRole === undefined ? {} : { slotRole: slotRole(args.slotRole) }),
            ...(args.isFinisher === undefined ? {} : { isFinisher: args.isFinisher }),
          })
        : toSlotSnapshot(slot),
    );

    await assertPostEditSquadLegal(
      ctx,
      squad,
      postEdit,
      lockedByIndex,
      slots.map((slot) => toSlotSnapshot(slot)),
    );

    await ctx.db.patch(target._id, {
      ...(args.playerId === undefined
        ? {}
        : { playerId: args.playerId === null ? undefined : args.playerId }),
      ...(args.slotRole === undefined ? {} : { slotRole: slotRole(args.slotRole) }),
      ...(args.isFinisher === undefined ? {} : { isFinisher: args.isFinisher }),
    });
    await markArranged(ctx, squad);

    return { ok: true };
  }
}

// ── setFormation ──

/**
 * Reassign slotRole / isFinisher across the whole squad in one atomic call.
 *
 * This exists because a formation change is NOT expressible as a sequence of
 * setSlot calls: every intermediate state of such a sequence violates the
 * structural rule (move one DEF to MID and you momentarily have 4 DEF and 5
 * MID summing to a legal 11 only by luck — and 3-5-3 in the general case), and
 * setSlot validates every call. Requiring atomicity is what keeps "no
 * transiently illegal squad" true without making legal formations unreachable.
 *
 * A locked slot may not have its role or finisher status changed — BUDGET_MODE
 * §Deadlines: "that slot is frozen (player, slot, position)". A formation that
 * would need to re-role a locked slot is therefore rejected outright rather
 * than partially applied.
 */
export const setFormation = mutation({
  args: {
    squadId: v.id("fantasySquads"),
    slots: v.array(
      v.object({
        slotIndex: v.number(),
        slotRole: slotRoleValidator,
        isFinisher: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return setFormationFor(ctx, userId, args);
  },
});

/** The setFormation core, sans authentication — see createBudgetSquadFor. */
export async function setFormationFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    squadId: Id<"fantasySquads">;
    slots: Array<{ slotIndex: number; slotRole: SlotRole; isFinisher: boolean }>;
  },
): Promise<{ ok: true }> {
  {
    const { squad, gameweek } = await loadOwnedSquad(ctx, args.squadId, userId);
    const now = Date.now();

    const slots = await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
      .collect();

    if (args.slots.length !== slots.length) {
      throw new Error(`A formation change must describe all ${slots.length} slots.`);
    }

    const desired = new Map(args.slots.map((s) => [s.slotIndex, s]));
    const lockedByIndex = await lockStateForSlots(ctx, gameweek._id, slots, now);

    for (const slot of slots) {
      const next = desired.get(slot.slotIndex);
      if (next === undefined) throw new Error(`Formation change omits slot ${slot.slotIndex}.`);
      if (lockedByIndex.get(slot.slotIndex) !== true) continue;
      if (next.slotRole !== slot.slotRole || next.isFinisher !== slot.isFinisher) {
        throw new Error(SLOT_LOCKED);
      }
    }

    const postEdit = slots.map((slot) => {
      const next = desired.get(slot.slotIndex)!;
      return toSlotSnapshot(slot, {
        slotRole: slotRole(next.slotRole),
        isFinisher: next.isFinisher,
      });
    });

    await assertPostEditSquadLegal(
      ctx,
      squad,
      postEdit,
      lockedByIndex,
      slots.map((slot) => toSlotSnapshot(slot)),
    );

    let changed = 0;
    for (const slot of slots) {
      const next = desired.get(slot.slotIndex)!;
      if (next.slotRole === slot.slotRole && next.isFinisher === slot.isFinisher) continue;
      await ctx.db.patch(slot._id, {
        slotRole: slotRole(next.slotRole),
        isFinisher: next.isFinisher,
      });
      changed += 1;
    }
    // A formation call that changes nothing is not an arrangement (item 6).
    if (changed > 0) await markArranged(ctx, squad);

    return { ok: true };
  }
}

// ── favorite club ──

/**
 * The signed-in user's favorite club as the hub shows it: the club in force
 * now, any queued change and when it lands, plus the club catalogue to pick
 * from. Anonymous visitors get `signedIn: false` and the catalogue only.
 *
 * The catalogue is derived the way getMarket derives it — there is
 * deliberately no clubs table — from active players and the draft-pool meta
 * names, grouped per league. Names fall back to the provider club id so a
 * club missing its meta row is still pickable rather than invisible.
 */
export const getFavoriteClub = query({
  args: {},
  handler: async (ctx) => {
    const players = await ctx.db.query("fantasyPlayers").collect();
    const metaRows = await ctx.db.query("fantasyDraftPoolMeta").collect();
    const clubNameByPlayer = new Map<string, string>();
    for (const meta of metaRows) {
      if (meta.clubName !== undefined) clubNameByPlayer.set(meta.playerId, meta.clubName);
    }
    const byClub = new Map<string, { clubId: string; name: string; leagueId: number }>();
    for (const player of players) {
      if (!player.active) continue;
      const seen = byClub.get(player.clubId);
      const name = clubNameByPlayer.get(player._id);
      if (seen === undefined) {
        byClub.set(player.clubId, {
          clubId: player.clubId,
          name: name ?? player.clubId,
          leagueId: player.leagueId,
        });
      } else if (seen.name === seen.clubId && name !== undefined) {
        seen.name = name;
      }
    }
    const clubs = [...byClub.values()].sort(
      (a, b) => a.leagueId - b.leagueId || a.name.localeCompare(b.name),
    );

    const userId = await getAuthUserId(ctx);
    const user = userId === null ? null : await ctx.db.get(userId);
    if (user === null) {
      return { signedIn: false as const, inForce: null, pending: null, effectiveFrom: null, clubs };
    }
    const now = Date.now();
    return {
      signedIn: true as const,
      inForce: resolveFavoriteClub(user, now),
      pending: hasPendingFavoriteChange(user, now) ? (user.favoriteClubPending ?? null) : null,
      effectiveFrom: pendingFavoriteEffectiveFrom(user, now),
      clubs,
    };
  },
});

export const FAVORITE_CLUB_PERMANENT =
  "Your favorite club is permanent and cannot be changed.";

/**
 * Set the profile-level favorite club — ONCE.
 *
 * Owner ruling 2026-08-21: the favorite club is permanent. The 28-day cooldown
 * (DRAFT_ROOM v1.0.2 / STOP-F, still implemented in lib/fantasyFavoriteClub)
 * was not enough — a user could still rotate favorites to stack four from
 * whichever club they fancied that month. So a user with a club in force or a
 * change still queued is refused here; only a first-ever selection goes
 * through, and that path is immediate (S2). The lib's cooldown code still
 * settles any change queued before this ruling, which is why getFavoriteClub
 * keeps reporting `pending`.
 *
 * The instant comes from the SERVER clock, never the client.
 */
export const setFavoriteClub = mutation({
  args: { clubId: v.string() },
  handler: async (ctx, { clubId }) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (user === null) throw new Error(SIGN_IN_REQUIRED);

    const now = Date.now();
    if (resolveFavoriteClub(user, now) !== null || hasPendingFavoriteChange(user, now)) {
      throw new Error(FAVORITE_CLUB_PERMANENT);
    }
    const patch = planFavoriteClubChange(user, now, clubId);
    await ctx.db.patch(userId, patch);

    return {
      inForce: patch.favoriteClub ?? null,
      pending: patch.favoriteClubPending ?? null,
      effectiveFrom: patch.favoriteClubEffectiveFrom ?? null,
    };
  },
});

// ── read ──

/**
 * FW-AVAIL — this gameweek's availability report for the players in a sheet.
 *
 * Shared by `getSquad` and `getMyCrewSheet` so the pitch reads the same way in
 * budget and crew context. At most thirteen index lookups, none for an empty
 * sheet.
 *
 * Served on the squad rather than joined client-side off the market: the market
 * the builder subscribes to is fixture-scoped, and a picked player whose
 * fixture was postponed would drop out of it — taking his flag with him, on
 * exactly the sheet that most needs to see it.
 */
export interface SlotAvailability {
  status: "out" | "doubtful";
  category: "injury" | "suspension" | "other";
  reason: string | null;
}

async function loadSlotAvailability(
  ctx: QueryCtx,
  gameweekId: Id<"fantasyGameweeks">,
  slots: ReadonlyArray<{ playerId?: Id<"fantasyPlayers"> }>,
): Promise<Map<Id<"fantasyPlayers">, SlotAvailability>> {
  const byPlayer = new Map<Id<"fantasyPlayers">, SlotAvailability>();
  const playerIds = new Set(
    slots.flatMap((slot) => (slot.playerId === undefined ? [] : [slot.playerId])),
  );
  for (const playerId of playerIds) {
    const row = await ctx.db
      .query("fantasyPlayerAvailability")
      .withIndex("by_gameweek_player", (q) =>
        q.eq("gameweekId", gameweekId).eq("playerId", playerId),
      )
      .first();
    if (row !== null) {
      byPlayer.set(playerId, {
        status: row.status,
        category: row.category,
        reason: row.reason,
      });
    }
  }
  return byPlayer;
}

/**
 * The caller's CREW sheet for one room, resolved from the roomId alone —
 * the sheet screen's entry query (FW-LAUNCH O5: the sheet was writable via
 * setFormation but had no surface). Authorization is ownership: the caller
 * sees a payload only when THEY hold the squad at this room's contextKey.
 */
export const getMyCrewSheet = query({
  args: { roomId: v.id("fantasyDraftRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const room = await ctx.db.get(roomId);
    if (room === null) return null;
    const gameweek = await ctx.db.get(room.gameweekId);
    if (gameweek === null) return null;

    const squad = await ctx.db
      .query("fantasySquads")
      .withIndex("by_user_gameweek_contextKey", (q) =>
        q
          .eq("userId", userId)
          .eq("gameweekId", room.gameweekId)
          .eq("contextKey", `crew:${roomId}`),
      )
      .first();
    if (squad === null) return null;

    const slots = await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
      .collect();
    const lockedByIndex = await lockStateForSlots(ctx, room.gameweekId, slots, Date.now());
    const snapshots = slots.map((slot) => toSlotSnapshot(slot));
    const playersById = await loadPlayers(ctx, snapshots);
    const availabilityByPlayer = await loadSlotAvailability(ctx, room.gameweekId, slots);

    return {
      squadId: squad._id,
      gameweekId: room.gameweekId,
      gwNumber: gameweek.gwNumber,
      gameweekStatus: gameweek.status,
      crewRoomId: roomId as string,
      arrangedByUser: squad.arrangedByUser ?? null,
      slots: slots
        .slice()
        .sort((a, b) => a.slotIndex - b.slotIndex)
        .map((slot) => {
          const player =
            slot.playerId === undefined ? undefined : playersById.get(slot.playerId);
          return {
            slotIndex: slot.slotIndex,
            slotRole: slot.slotRole,
            isFinisher: slot.isFinisher,
            playerId: slot.playerId ?? null,
            playerName: player?.name ?? null,
            playerClubId: player?.clubId ?? null,
            playerPrice: player?.price ?? null,
            locked: lockedByIndex.get(slot.slotIndex) === true,
            committedPrice: slot.committedPrice ?? null,
            /** FW-AVAIL. Null = nothing reported. A locked slot keeps its
             *  flag: the manager can no longer act on it, but the reason his
             *  score is about to be zero is still worth stating. */
            availability:
              slot.playerId === undefined
                ? null
                : (availabilityByPlayer.get(slot.playerId) ?? null),
          };
        }),
    };
  },
});

/** The caller's squad for a gameweek/context, with live lock state per slot. */
export const getSquad = query({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    context: v.union(v.literal("budget"), v.literal("crew")),
    crewRoomId: v.optional(v.string()),
  },
  handler: async (ctx, { gameweekId, context, crewRoomId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const contextKey = context === "budget" ? "budget" : `crew:${crewRoomId}`;
    const squad = await ctx.db
      .query("fantasySquads")
      .withIndex("by_user_gameweek_contextKey", (q) =>
        q.eq("userId", userId).eq("gameweekId", gameweekId).eq("contextKey", contextKey),
      )
      .first();
    if (squad === null) return null;

    const slots = await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
      .collect();

    const lockedByIndex = await lockStateForSlots(ctx, gameweekId, slots, Date.now());

    const snapshots = slots.map((slot) => toSlotSnapshot(slot));
    const playersById = await loadPlayers(ctx, snapshots);
    const availabilityByPlayer = await loadSlotAvailability(ctx, gameweekId, slots);

    // Budget context only: the live spend breakdown (committed + unlocked ≤
    // limit), recomputed from the same inputs every edit is validated against.
    // A stored squad is always legal, so this is display state, not a verdict.
    const budget =
      squad.context === "budget"
        ? (validateBudget(
            snapshots,
            playersById,
            (slot) => lockedByIndex.get(slot.slotIndex) === true,
            SQUAD_BUDGET,
          ).breakdown ?? null)
        : null;

    return {
      squadId: squad._id,
      context: squad.context,
      favoriteClubAtBuild: squad.favoriteClubAtBuild,
      /** Crew sheets only: false while still on the R6 default (item 6). */
      arrangedByUser: squad.arrangedByUser ?? null,
      budget,
      slots: slots
        .slice()
        .sort((a, b) => a.slotIndex - b.slotIndex)
        .map((slot) => {
          const player =
            slot.playerId === undefined ? undefined : playersById.get(slot.playerId);
          return {
            slotIndex: slot.slotIndex,
            slotRole: slot.slotRole,
            isFinisher: slot.isFinisher,
            playerId: slot.playerId ?? null,
            playerName: player?.name ?? null,
            playerClubId: player?.clubId ?? null,
            playerPrice: player?.price ?? null,
            locked: lockedByIndex.get(slot.slotIndex) === true,
            committedPrice: slot.committedPrice ?? null,
            /** FW-AVAIL. Null = nothing reported. A locked slot keeps its
             *  flag: the manager can no longer act on it, but the reason his
             *  score is about to be zero is still worth stating. */
            availability:
              slot.playerId === undefined
                ? null
                : (availabilityByPlayer.get(slot.playerId) ?? null),
          };
        }),
    };
  },
});
