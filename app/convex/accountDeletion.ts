/**
 * Self-serve account deletion (Google Play policy: in-app deletion of the
 * account and its data).
 *
 * deleteMyAccount, in one transaction:
 *  - removes every way back in: password accounts (+ verification codes),
 *    sessions and refresh tokens, the username claim;
 *  - replaces the user doc with an empty tombstone ({ deletedAt } and the
 *    anonymous flags): no name, email, streaks or settings remain. The doc is
 *    kept, not deleted, so shared records other players see (duels,
 *    rivalries, Weekend crews and votes) keep a valid id; every reader of
 *    those already falls back to "Unknown"/"Opponent" with no username.
 *  - schedules purgeUserData, which deletes the player's own data in batches
 *    and replaces the name snapshots stored in shared records.
 *
 * A JWT issued before deletion stays valid until it expires (Convex Auth does
 * not check the session on every call), so the purge runs once more later to
 * catch anything written in that window.
 */
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import type { Id, TableNames } from "./_generated/dataModel";

const BATCH = 200;
const DELETED_NAME = "Deleted player";
/** Longer than an access token lives, so the second pass sees every write. */
const SECOND_PASS_DELAY_MS = 2 * 60 * 60 * 1000;

/** The player's own rows: deleted outright. [table, index on the user field]. */
const OWN_ROWS: ReadonlyArray<readonly [TableNames, string, string]> = [
  ["userRatings", "by_user_sport_mode", "userId"],
  ["gameSessions", "by_user", "userId"],
  ["userAchievements", "by_user", "userId"],
  ["quizSessions", "by_user_completed_expiresAt", "userId"],
  ["rankedPendingQuestions", "by_user_key", "userId"],
  ["survivalSessions", "by_user_gameOver_expiresAt", "userId"],
  ["dailyAttempts", "by_user_date_sport_mode", "userId"],
  ["blitzSessions", "by_user", "userId"],
  ["blitzScores", "by_user", "userId"],
  ["higherLowerSessions", "by_user", "userId"],
  ["verveGridSessions", "by_user", "userId"],
  ["careerPathSessions", "by_user", "userId"],
  ["whosOlderSessions", "by_user_kind_date", "userId"],
  ["missingLettersSessions", "by_user_kind_date", "userId"],
  ["learnMastery", "by_user_node", "userId"],
  ["learnSessions", "by_user", "userId"],
  ["learnRungReviews", "by_user_rung", "userId"],
  ["arenaRecentlySeenQuestions", "by_user_seen_at", "userId"],
  ["challengeNotifications", "by_user_created", "userId"],
  ["decayNotifications", "by_user_dismissed", "userId"],
  ["questionFeedbackVotes", "by_user_checksum", "userId"],
  ["dailyStreakLinks", "by_user", "userId"],
  ["whosOlderReminderLinks", "by_user_game", "userId"],
  ["whosOlderReminders", "by_creator_game_created", "createdByUserId"],
  ["drawRuns", "by_user_date", "userId"],
  ["drawStreaks", "by_user", "userId"],
  ["funnelDefeatMarks", "by_user", "userId"],
  ["anonymousOnboardingAttempts", "by_user_time", "userId"],
  ["seasonHistory", "by_user", "userId"],
  ["fantasyWaitlist", "by_userId", "userId"],
  ["fantasyCrowdRaterStats", "by_user", "userId"],
];

/** Shared tables whose rows embed the player's name: scanned, name replaced. */
const SNAPSHOT_SCANS = ["arenas", "fantasyDraftRooms", "fantasyDraftLog"] as const;
type ScanTable = (typeof SNAPSHOT_SCANS)[number];

// Purge steps, in order: own rows, reminders by email, indexed name
// snapshots, then the scans.
const STEP_EMAIL = OWN_ROWS.length;
const STEP_DUELS = STEP_EMAIL + 1;
const STEP_CREWS = STEP_DUELS + 1;
const STEP_SCANS = STEP_CREWS + 1;
const STEP_DONE = STEP_SCANS + SNAPSHOT_SCANS.length;

// Index ranges built from a field name are typed loosely on purpose: the
// table list above is the single source of truth for which index to use.
type LooseQuery = {
  withIndex: (
    name: string,
    range: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
  ) => { take: (n: number) => Promise<Array<{ _id: Id<TableNames> } & Record<string, unknown>>> };
};

async function signOutEverywhere(ctx: MutationCtx, userId: Id<"users">) {
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();
  for (const account of accounts) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const code of codes) await ctx.db.delete(code._id);
    await ctx.db.delete(account._id);
  }
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of tokens) await ctx.db.delete(token._id);
    await ctx.db.delete(session._id);
  }
}

export const deleteMyAccount = mutation({
  args: { confirm: v.literal("DELETE") },
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Account not found");
    if (user.deletedAt) return { deleted: true };

    const email = user.email;
    await signOutEverywhere(ctx, userId);
    const claims = await ctx.db
      .query("usernameClaims")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const claim of claims) await ctx.db.delete(claim._id);

    const now = Date.now();
    await ctx.db.replace(userId, { isAnonymous: true, isGuest: true, deletedAt: now });

    await ctx.scheduler.runAfter(0, internal.accountDeletion.purgeUserData, {
      userId,
      email,
      step: 0,
      secondPass: false,
    });
    return { deleted: true };
  },
});

async function scrubScanPage(
  ctx: MutationCtx,
  table: ScanTable,
  userId: Id<"users">,
  cursor: string | null,
) {
  const page = await ctx.db.query(table).paginate({ cursor, numItems: BATCH });
  for (const doc of page.page) {
    if (table === "arenas") {
      const arena = doc as { _id: Id<"arenas">; players: Array<{ userId: Id<"users">; nameSnapshot: string }> };
      if (arena.players.some((p) => p.userId === userId && p.nameSnapshot !== DELETED_NAME)) {
        await ctx.db.patch(arena._id, {
          players: arena.players.map((p) => (p.userId === userId ? { ...p, nameSnapshot: DELETED_NAME } : p)),
        } as never);
      }
    } else if (table === "fantasyDraftRooms") {
      const room = doc as { _id: Id<"fantasyDraftRooms">; seats: Array<{ userId: Id<"users">; nameSnapshot: string }> };
      if (room.seats.some((s) => s.userId === userId && s.nameSnapshot !== DELETED_NAME)) {
        await ctx.db.patch(room._id, {
          seats: room.seats.map((s) => (s.userId === userId ? { ...s, nameSnapshot: DELETED_NAME } : s)),
        } as never);
      }
    } else {
      const entry = doc as { _id: Id<"fantasyDraftLog"> } & Record<string, unknown>;
      const scrubbed = scrubNames(entry, userId);
      if (scrubbed.changed) await ctx.db.replace(entry._id, scrubbed.value as never);
    }
  }
  return page;
}

/** Replaces nameSnapshot in any object (at any depth) that carries this userId. */
function scrubNames(value: unknown, userId: Id<"users">): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const r = scrubNames(item, userId);
      changed ||= r.changed;
      return r.value;
    });
    return { value: out, changed };
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v2] of Object.entries(obj)) {
      if (k === "_id" || k === "_creationTime") continue;
      const r = scrubNames(v2, userId);
      changed ||= r.changed;
      out[k] = r.value;
    }
    if (obj.userId === userId && typeof obj.nameSnapshot === "string" && obj.nameSnapshot !== DELETED_NAME) {
      out.nameSnapshot = DELETED_NAME;
      changed = true;
    }
    return { value: out, changed };
  }
  return { value, changed: false };
}

export const purgeUserData = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.optional(v.string()),
    step: v.number(),
    cursor: v.optional(v.union(v.string(), v.null())),
    secondPass: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId, email, step, secondPass } = args;
    const next = (patch: { step: number; cursor?: string | null }) =>
      ctx.scheduler.runAfter(0, internal.accountDeletion.purgeUserData, {
        userId,
        email,
        secondPass,
        ...patch,
      });

    if (step < OWN_ROWS.length) {
      const [table, index, field] = OWN_ROWS[step];
      const rows = await (ctx.db.query(table) as unknown as LooseQuery)
        .withIndex(index, (q) => q.eq(field, userId))
        .take(BATCH);
      for (const row of rows) {
        if (table === "higherLowerSessions" && row.deckId && (await ctx.db.get(row.deckId as Id<"higherLowerDecks">))) {
          await ctx.db.delete(row.deckId as Id<"higherLowerDecks">);
        }
        await ctx.db.delete(row._id);
      }
      await next({ step: rows.length === BATCH ? step : step + 1 });
      return;
    }

    if (step === STEP_EMAIL) {
      // Reminders signed up with the account's email but no login.
      if (email) {
        const rows = await ctx.db
          .query("whosOlderReminders")
          .withIndex("by_email_game", (q) => q.eq("email", email))
          .take(BATCH);
        for (const row of rows) await ctx.db.delete(row._id);
        if (rows.length === BATCH) return void (await next({ step }));
      }
      await next({ step: step + 1 });
      return;
    }

    if (step === STEP_DUELS) {
      const page = await ctx.db
        .query("duels")
        .withIndex("by_opponent_status", (q) => q.eq("opponentId", userId))
        .paginate({ cursor: args.cursor ?? null, numItems: BATCH });
      for (const duel of page.page) {
        if (duel.opponentUsernameSnapshot !== undefined) {
          await ctx.db.patch(duel._id, { opponentUsernameSnapshot: undefined });
        }
      }
      await next(page.isDone ? { step: step + 1 } : { step, cursor: page.continueCursor });
      return;
    }

    if (step === STEP_CREWS) {
      const members = await ctx.db
        .query("fantasyCrewMembers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const m of members) {
        if (m.nameSnapshot !== DELETED_NAME) await ctx.db.patch(m._id, { nameSnapshot: DELETED_NAME });
      }
      await next({ step: step + 1 });
      return;
    }

    if (step < STEP_DONE) {
      const table = SNAPSHOT_SCANS[step - STEP_SCANS];
      const page = await scrubScanPage(ctx, table, userId, args.cursor ?? null);
      await next(page.isDone ? { step: step + 1 } : { step, cursor: page.continueCursor });
      return;
    }

    // Done. Run once more after any pre-deletion token has expired.
    if (!secondPass) {
      await ctx.scheduler.runAfter(SECOND_PASS_DELAY_MS, internal.accountDeletion.purgeUserData, {
        userId,
        email,
        step: 0,
        secondPass: true,
      });
    }
  },
});
