import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// ── One-off FW-SHIP P6 smoke-artifact cleanup (Ticket FW-DOCS) ──
// The post-ship live verification created exactly three things on prod: guest
// `wkndsmoke93199`, that guest's GW1 budget squad, and the crew "Weekend
// Smoke". This module removes them and NOTHING else, on the dropTestPurge
// pattern — deliberately two-step and fail-closed:
//   1. npx convex run fwShipSmokePurge:dryRun '{}' --prod  → the EXACT rows
//   2. review, then call fwShipSmokePurge:purge with those exact ids
// purge re-derives the artifact set and throws (deleting nothing — mutations
// are transactional) on any id that is not provably a smoke artifact, on a
// crew that has grown members beyond the smoke guest, or on any draft room
// under the crew. It never deletes by pattern, only by id.

const SMOKE_USERNAME = "wkndsmoke93199";
const SMOKE_CREW_NAME = "Weekend Smoke";

type SmokeArtifacts = {
  user: Doc<"users"> | null;
  crews: Doc<"fantasyCrews">[];
  crewMembers: Doc<"fantasyCrewMembers">[];
  squads: Doc<"fantasySquads">[];
  squadSlots: Doc<"fantasySquadSlots">[];
  authAccounts: Doc<"authAccounts">[];
  authSessions: Doc<"authSessions">[];
  refreshTokens: Doc<"authRefreshTokens">[];
  /** Anything that makes deletion unsafe. Non-empty ⇒ purge refuses. */
  blockers: string[];
};

async function collectSmokeArtifacts(ctx: QueryCtx): Promise<SmokeArtifacts> {
  const blockers: string[] = [];

  const user = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", SMOKE_USERNAME))
    .unique();

  const crews: Doc<"fantasyCrews">[] = [];
  const crewMembers: Doc<"fantasyCrewMembers">[] = [];
  const squads: Doc<"fantasySquads">[] = [];
  const squadSlots: Doc<"fantasySquadSlots">[] = [];
  const authAccounts: Doc<"authAccounts">[] = [];
  const authSessions: Doc<"authSessions">[] = [];
  const refreshTokens: Doc<"authRefreshTokens">[] = [];

  if (user !== null) {
    // The crew: named exactly, created by the smoke guest. Full scan is fine —
    // the crews table is hours old; a name says nothing without the creator.
    for (const crew of await ctx.db.query("fantasyCrews").collect()) {
      if (crew.name !== SMOKE_CREW_NAME || crew.createdBy !== user._id) continue;
      crews.push(crew);

      const members = await ctx.db
        .query("fantasyCrewMembers")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .collect();
      for (const member of members) {
        if (member.userId !== user._id) {
          blockers.push(
            `crew ${crew._id} has a member besides the smoke guest — no longer a pure smoke artifact`,
          );
        }
      }
      crewMembers.push(...members);

      const rooms = await ctx.db
        .query("fantasyDraftRooms")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .collect();
      if (rooms.length > 0) {
        blockers.push(`crew ${crew._id} has ${rooms.length} draft room(s) — not authorized`);
      }
    }

    const userSquads = await ctx.db
      .query("fantasySquads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const squad of userSquads) {
      if (squad.context !== "budget") {
        blockers.push(`squad ${squad._id} is not a budget squad — not authorized`);
        continue;
      }
      squads.push(squad);
      const slots = await ctx.db
        .query("fantasySquadSlots")
        .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
        .collect();
      for (const slot of slots) {
        if (slot.lockedAt !== undefined) {
          blockers.push(`squad ${squad._id} has a locked slot — history, not smoke`);
        }
      }
      squadSlots.push(...slots);
    }

    authAccounts.push(
      ...(await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
        .take(100)),
    );
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .take(100);
    authSessions.push(...sessions);
    for (const session of sessions) {
      refreshTokens.push(
        ...(await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
          .take(100)),
      );
    }
  }

  return {
    user,
    crews,
    crewMembers,
    squads,
    squadSlots,
    authAccounts,
    authSessions,
    refreshTokens,
    blockers,
  };
}

export const dryRun = internalQuery({
  args: {},
  handler: async (ctx) => {
    const a = await collectSmokeArtifacts(ctx);
    return {
      blockers: a.blockers,
      counts: {
        user: a.user === null ? 0 : 1,
        crews: a.crews.length,
        crewMembers: a.crewMembers.length,
        squads: a.squads.length,
        squadSlots: a.squadSlots.length,
        authAccounts: a.authAccounts.length,
        authSessions: a.authSessions.length,
        authRefreshTokens: a.refreshTokens.length,
      },
      user: a.user === null ? null : { _id: a.user._id, username: a.user.username },
      crews: a.crews.map((c) => ({ _id: c._id, name: c.name, code: c.code })),
      crewMemberIds: a.crewMembers.map((m) => m._id),
      squads: a.squads.map((s) => ({ _id: s._id, context: s.context, contextKey: s.contextKey })),
      squadSlotIds: a.squadSlots.map((s) => s._id),
      authAccountIds: a.authAccounts.map((r) => r._id),
      authSessionIds: a.authSessions.map((r) => r._id),
      authRefreshTokenIds: a.refreshTokens.map((r) => r._id),
    };
  },
});

// Deletes ONLY the explicit ids passed in, after re-deriving the artifact set
// and checking every id is in it and no blocker exists. Any mismatch throws,
// which (mutations being transactional) aborts the whole purge.
export const purge = internalMutation({
  args: {
    userId: v.id("users"),
    crewIds: v.array(v.id("fantasyCrews")),
    crewMemberIds: v.array(v.id("fantasyCrewMembers")),
    squadIds: v.array(v.id("fantasySquads")),
    squadSlotIds: v.array(v.id("fantasySquadSlots")),
    authAccountIds: v.array(v.id("authAccounts")),
    authSessionIds: v.array(v.id("authSessions")),
    authRefreshTokenIds: v.array(v.id("authRefreshTokens")),
  },
  handler: async (ctx, args) => {
    const a = await collectSmokeArtifacts(ctx);
    if (a.blockers.length > 0) {
      throw new Error(`Refusing purge: ${a.blockers.join("; ")}`);
    }
    if (a.user === null || a.user._id !== args.userId) {
      throw new Error(`Refusing purge: userId is not the ${SMOKE_USERNAME} row`);
    }
    const assertSubset = (
      label: TableNames,
      requested: readonly string[],
      derived: ReadonlySet<string>,
    ) => {
      for (const id of requested) {
        if (!derived.has(id)) {
          throw new Error(
            `Refusing purge: ${label} id ${id} is not a verified smoke artifact`,
          );
        }
      }
    };
    assertSubset("fantasyCrews", args.crewIds, new Set(a.crews.map((c) => c._id)));
    assertSubset(
      "fantasyCrewMembers",
      args.crewMemberIds,
      new Set(a.crewMembers.map((m) => m._id)),
    );
    assertSubset("fantasySquads", args.squadIds, new Set(a.squads.map((s) => s._id)));
    assertSubset(
      "fantasySquadSlots",
      args.squadSlotIds,
      new Set(a.squadSlots.map((s) => s._id)),
    );
    assertSubset(
      "authAccounts",
      args.authAccountIds,
      new Set(a.authAccounts.map((r) => r._id)),
    );
    assertSubset(
      "authSessions",
      args.authSessionIds,
      new Set(a.authSessions.map((r) => r._id)),
    );
    assertSubset(
      "authRefreshTokens",
      args.authRefreshTokenIds,
      new Set(a.refreshTokens.map((r) => r._id)),
    );

    const deletions: Array<[TableNames, readonly string[]]> = [
      ["authRefreshTokens", args.authRefreshTokenIds],
      ["authSessions", args.authSessionIds],
      ["authAccounts", args.authAccountIds],
      ["fantasySquadSlots", args.squadSlotIds],
      ["fantasySquads", args.squadIds],
      ["fantasyCrewMembers", args.crewMemberIds],
      ["fantasyCrews", args.crewIds],
      ["users", [args.userId]],
    ];
    let deleted = 0;
    for (const [, ids] of deletions) {
      for (const id of ids) {
        await ctx.db.delete(id as Id<TableNames>);
        deleted += 1;
      }
    }
    return { deleted };
  },
});
