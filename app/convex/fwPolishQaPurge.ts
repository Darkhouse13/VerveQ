import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, TableNames } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// ── FW-POLISH-3 O6: QA-guest cleanup (the fwShipSmokePurge pattern) ──
// Sweeps the named QA guests and ONLY what they own: their budget squads
// (with slots), their auth rows, and the user docs. Two-step and fail-closed
// like fwShipSmokePurge/dropTestPurge:
//   1. npx convex run fwPolishQaPurge:dryRun '{"usernames":[...]}' --prod
//   2. review the EXACT rows, then call purge with those exact ids
// purge re-derives the set and throws (deleting nothing — mutations are
// transactional) on any id that is not provably a QA artifact. Blockers make
// it refuse outright: a username outside the QA prefixes, a surviving crew
// the guest created, a membership in a still-existing crew, a non-budget
// squad, or a squad slot that has locked (locked slots are history).
// It never deletes by pattern, only by id.

const ALLOWED_PREFIXES = ["fwpolish", "fwp3smoke", "wkndsmoke"] as const;

type QaArtifacts = {
  users: Doc<"users">[];
  squads: Doc<"fantasySquads">[];
  squadSlots: Doc<"fantasySquadSlots">[];
  crewMembers: Doc<"fantasyCrewMembers">[];
  authAccounts: Doc<"authAccounts">[];
  authSessions: Doc<"authSessions">[];
  refreshTokens: Doc<"authRefreshTokens">[];
  blockers: string[];
};

async function collectQaArtifacts(
  ctx: QueryCtx,
  usernames: string[],
): Promise<QaArtifacts> {
  const blockers: string[] = [];
  const users: Doc<"users">[] = [];
  const squads: Doc<"fantasySquads">[] = [];
  const squadSlots: Doc<"fantasySquadSlots">[] = [];
  const crewMembers: Doc<"fantasyCrewMembers">[] = [];
  const authAccounts: Doc<"authAccounts">[] = [];
  const authSessions: Doc<"authSessions">[] = [];
  const refreshTokens: Doc<"authRefreshTokens">[] = [];

  const allCrews = await ctx.db.query("fantasyCrews").collect();

  for (const username of usernames) {
    if (!ALLOWED_PREFIXES.some((p) => username.startsWith(p))) {
      blockers.push(`${username} is outside the QA prefixes — not authorized`);
      continue;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (user === null) continue; // already gone — nothing to purge for it
    users.push(user);

    const created = allCrews.filter((c) => c.createdBy === user._id);
    for (const crew of created) {
      blockers.push(
        `${username} still owns crew "${crew.name}" (${crew._id}) — delete it through the product flow first`,
      );
    }

    const memberships = await ctx.db
      .query("fantasyCrewMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const membership of memberships) {
      const crew = await ctx.db.get(membership.crewId);
      if (crew !== null) {
        blockers.push(
          `${username} is a member of live crew "${crew.name}" — entangled, human review`,
        );
      }
      crewMembers.push(membership); // dangling rows (crew gone) are sweepable
    }

    const userSquads = await ctx.db
      .query("fantasySquads")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const squad of userSquads) {
      if (squad.context !== "budget") {
        blockers.push(`squad ${squad._id} of ${username} is not a budget squad`);
        continue;
      }
      squads.push(squad);
      const slots = await ctx.db
        .query("fantasySquadSlots")
        .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
        .collect();
      for (const slot of slots) {
        if (slot.lockedAt !== undefined) {
          blockers.push(`squad ${squad._id} of ${username} has a locked slot — history`);
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
    users,
    squads,
    squadSlots,
    crewMembers,
    authAccounts,
    authSessions,
    refreshTokens,
    blockers,
  };
}

export const dryRun = internalQuery({
  args: { usernames: v.array(v.string()) },
  handler: async (ctx, { usernames }) => {
    const a = await collectQaArtifacts(ctx, usernames);
    return {
      blockers: a.blockers,
      users: a.users.map((u) => ({ _id: u._id, username: u.username })),
      squads: a.squads.map((s) => ({ _id: s._id, contextKey: s.contextKey })),
      squadSlotIds: a.squadSlots.map((s) => s._id),
      crewMemberIds: a.crewMembers.map((m) => m._id),
      authAccountIds: a.authAccounts.map((r) => r._id),
      authSessionIds: a.authSessions.map((r) => r._id),
      authRefreshTokenIds: a.refreshTokens.map((r) => r._id),
    };
  },
});

export const purge = internalMutation({
  args: {
    usernames: v.array(v.string()),
    userIds: v.array(v.id("users")),
    squadIds: v.array(v.id("fantasySquads")),
    squadSlotIds: v.array(v.id("fantasySquadSlots")),
    crewMemberIds: v.array(v.id("fantasyCrewMembers")),
    authAccountIds: v.array(v.id("authAccounts")),
    authSessionIds: v.array(v.id("authSessions")),
    authRefreshTokenIds: v.array(v.id("authRefreshTokens")),
  },
  handler: async (ctx, args) => {
    const a = await collectQaArtifacts(ctx, args.usernames);
    if (a.blockers.length > 0) {
      throw new Error(`Refusing purge: ${a.blockers.join("; ")}`);
    }
    const assertSubset = (
      label: TableNames,
      requested: readonly string[],
      derived: ReadonlySet<string>,
    ) => {
      for (const id of requested) {
        if (!derived.has(id)) {
          throw new Error(`Refusing purge: ${label} id ${id} is not a verified QA artifact`);
        }
      }
    };
    assertSubset("users", args.userIds, new Set(a.users.map((u) => u._id)));
    assertSubset("fantasySquads", args.squadIds, new Set(a.squads.map((s) => s._id)));
    assertSubset(
      "fantasySquadSlots",
      args.squadSlotIds,
      new Set(a.squadSlots.map((s) => s._id)),
    );
    assertSubset(
      "fantasyCrewMembers",
      args.crewMemberIds,
      new Set(a.crewMembers.map((m) => m._id)),
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

    let deleted = 0;
    for (const id of args.authRefreshTokenIds) {
      await ctx.db.delete(id);
      deleted += 1;
    }
    for (const id of args.authSessionIds) {
      await ctx.db.delete(id);
      deleted += 1;
    }
    for (const id of args.authAccountIds) {
      await ctx.db.delete(id);
      deleted += 1;
    }
    for (const id of args.squadSlotIds) {
      await ctx.db.delete(id);
      deleted += 1;
    }
    for (const id of args.squadIds) {
      await ctx.db.delete(id);
      deleted += 1;
    }
    for (const id of args.crewMemberIds) {
      await ctx.db.delete(id);
      deleted += 1;
    }
    for (const id of args.userIds) {
      await ctx.db.delete(id);
      deleted += 1;
    }
    return { deleted };
  },
});
