import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// ── One-off Drop-Test smoke-artifact cleanup ──
// The Drop-Test smoke run created drop_smoke_a_*/drop_smoke_b_* accounts, two
// smoke duels, and the funnel rows they generated, inflating the baseline.
// Workflow is deliberately two-step and fail-closed:
//   1. npx convex run dropTestPurge:dryRun '{}'   → prints the EXACT rows
//   2. review the list, then call dropTestPurge:purge with those exact ids
// purge re-validates every id against the smoke criteria and throws (deleting
// nothing — mutations are transactional) on the first row that is not
// provably a smoke artifact. It never deletes by pattern, only by id.

const PURGE_USERNAME_PREFIXES = ["drop_smoke_a_", "drop_smoke_b_"];

// Exact linkCodes the smoke run tapped that never belonged to any duel (the
// deliberate bogus-code probe). Never a pattern — list codes verbatim.
const KNOWN_SMOKE_LINKCODES = ["DQZZZZZZZZ99"];

function isPurgeableUsername(username: string | undefined | null): boolean {
  if (!username) return false;
  return PURGE_USERNAME_PREFIXES.some((p) => username.startsWith(p));
}

type SmokeArtifacts = {
  users: Doc<"users">[];
  duels: Doc<"duels">[];
  events: Doc<"funnelEvents">[];
  marks: Doc<"funnelDefeatMarks">[];
  cards: Doc<"duelShareCards">[];
  authAccounts: Doc<"authAccounts">[];
  authSessions: Doc<"authSessions">[];
  refreshTokens: Doc<"authRefreshTokens">[];
};

async function collectSmokeArtifacts(ctx: QueryCtx): Promise<SmokeArtifacts> {
  const users: Doc<"users">[] = [];
  for (const prefix of PURGE_USERNAME_PREFIXES) {
    const rows = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.gte("username", prefix).lt("username", prefix + "\uffff"),
      )
      .take(100);
    users.push(...rows);
  }
  const userIds = new Set<string>(users.map((u) => u._id));

  const duels: Doc<"duels">[] = [];
  for (const user of users) {
    const asChallenger = await ctx.db
      .query("duels")
      .withIndex("by_challenger", (q) => q.eq("challengerId", user._id))
      .take(100);
    duels.push(...asChallenger);
    const asOpponent = await ctx.db
      .query("duels")
      .withIndex("by_opponent_status", (q) => q.eq("opponentId", user._id))
      .take(100);
    for (const duel of asOpponent) {
      if (!duels.some((d) => d._id === duel._id)) duels.push(duel);
    }
  }
  const duelIds = new Set<string>(duels.map((d) => d._id));
  const linkCodes = new Set<string>([
    ...duels.map((d) => d.linkCode).filter((c): c is string => !!c),
    ...KNOWN_SMOKE_LINKCODES,
  ]);

  const events = (await ctx.db.query("funnelEvents").take(10000)).filter(
    (e) =>
      (e.actor.startsWith("user:") && userIds.has(e.actor.slice(5))) ||
      (e.refChallengerId && userIds.has(e.refChallengerId)) ||
      (e.refLinkCode && linkCodes.has(e.refLinkCode)) ||
      (typeof (e.meta as { duelId?: string } | undefined)?.duelId === "string" &&
        duelIds.has((e.meta as { duelId: string }).duelId)),
  );

  const marks = (await ctx.db.query("funnelDefeatMarks").take(10000)).filter(
    (m) => userIds.has(m.userId) || duelIds.has(m.duelId),
  );

  const cards: Doc<"duelShareCards">[] = [];
  for (const code of linkCodes) {
    const rows = await ctx.db
      .query("duelShareCards")
      .withIndex("by_link_variant", (q) => q.eq("linkCode", code))
      .take(100);
    cards.push(...rows);
  }

  const authAccounts: Doc<"authAccounts">[] = [];
  const authSessions: Doc<"authSessions">[] = [];
  const refreshTokens: Doc<"authRefreshTokens">[] = [];
  for (const user of users) {
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
    duels,
    events,
    marks,
    cards,
    authAccounts,
    authSessions,
    refreshTokens,
  };
}

export const dryRun = internalQuery({
  args: {},
  handler: async (ctx) => {
    const a = await collectSmokeArtifacts(ctx);
    return {
      counts: {
        users: a.users.length,
        duels: a.duels.length,
        funnelEvents: a.events.length,
        funnelDefeatMarks: a.marks.length,
        duelShareCards: a.cards.length,
        authAccounts: a.authAccounts.length,
        authSessions: a.authSessions.length,
        authRefreshTokens: a.refreshTokens.length,
      },
      users: a.users.map((u) => ({
        _id: u._id,
        username: u.username,
        createdAt: u._creationTime,
      })),
      duels: a.duels.map((d) => ({
        _id: d._id,
        linkCode: d.linkCode ?? null,
        status: d.status,
        challengerId: d.challengerId,
        opponentId: d.opponentId ?? null,
        createdAt: d.createdAt,
      })),
      funnelEvents: a.events.map((e) => ({
        _id: e._id,
        type: e.type,
        actor: e.actor,
        refLinkCode: e.refLinkCode ?? null,
        refChallengerId: e.refChallengerId ?? null,
        ts: e.ts,
      })),
      funnelDefeatMarks: a.marks.map((m) => ({
        _id: m._id,
        userId: m.userId,
        duelId: m.duelId,
      })),
      duelShareCards: a.cards.map((c) => ({
        _id: c._id,
        linkCode: c.linkCode,
        variant: c.variant,
        storageId: c.storageId,
      })),
      authAccounts: a.authAccounts.map((r) => r._id),
      authSessions: a.authSessions.map((r) => r._id),
      authRefreshTokens: a.refreshTokens.map((r) => r._id),
    };
  },
});

// Deletes ONLY the explicit ids passed in, and only after re-deriving the
// smoke-artifact set and checking every id is in it. Any mismatch throws,
// which (mutations being transactional) aborts the whole purge.
export const purge = internalMutation({
  args: {
    userIds: v.array(v.id("users")),
    duelIds: v.array(v.id("duels")),
    funnelEventIds: v.array(v.id("funnelEvents")),
    defeatMarkIds: v.array(v.id("funnelDefeatMarks")),
    shareCardIds: v.array(v.id("duelShareCards")),
    authAccountIds: v.array(v.id("authAccounts")),
    authSessionIds: v.array(v.id("authSessions")),
    refreshTokenIds: v.array(v.id("authRefreshTokens")),
  },
  handler: async (ctx, args) => {
    const a = await collectSmokeArtifacts(ctx);
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
    assertSubset(
      "users",
      args.userIds,
      new Set(
        a.users.filter((u) => isPurgeableUsername(u.username)).map((u) => u._id),
      ),
    );
    assertSubset("duels", args.duelIds, new Set(a.duels.map((d) => d._id)));
    assertSubset(
      "funnelEvents",
      args.funnelEventIds,
      new Set(a.events.map((e) => e._id)),
    );
    assertSubset(
      "funnelDefeatMarks",
      args.defeatMarkIds,
      new Set(a.marks.map((m) => m._id)),
    );
    assertSubset(
      "duelShareCards",
      args.shareCardIds,
      new Set(a.cards.map((c) => c._id)),
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
      args.refreshTokenIds,
      new Set(a.refreshTokens.map((r) => r._id)),
    );

    // Cached card PNGs also occupy file storage; drop the blobs with the rows.
    for (const cardId of args.shareCardIds) {
      const card = await ctx.db.get(cardId);
      if (card) {
        try {
          await ctx.storage.delete(card.storageId);
        } catch {
          // Blob already gone — row deletion below still applies.
        }
      }
    }

    const deletions: Array<[TableNames, readonly string[]]> = [
      ["authRefreshTokens", args.refreshTokenIds],
      ["authSessions", args.authSessionIds],
      ["authAccounts", args.authAccountIds],
      ["funnelEvents", args.funnelEventIds],
      ["funnelDefeatMarks", args.defeatMarkIds],
      ["duelShareCards", args.shareCardIds],
      ["duels", args.duelIds],
      ["users", args.userIds],
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
