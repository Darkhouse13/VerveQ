/**
 * Name moderation, run by hand from the CLI:
 *
 *   npx convex run opsModeration:auditBlockedNames --prod
 *   npx convex run opsModeration:renameBlockedUser '{"userId":"…"}' --prod
 *
 * Usernames and display names are read live from `users` by every public
 * surface (leaderboards, duels, crews), so renaming the user doc removes a
 * blocked name everywhere at once. New claims are already filtered in
 * lib/usernames.claimUsernameForUser; this module cleans names that predate
 * the filter.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { isBlockedName } from "./lib/usernameBlocklist";

export const auditBlockedNames = internalQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users
      .filter(
        (u) =>
          (typeof u.username === "string" && isBlockedName(u.username)) ||
          (typeof u.displayName === "string" && isBlockedName(u.displayName)),
      )
      .map((u) => ({
        userId: u._id,
        username: u.username ?? null,
        displayName: u.displayName ?? null,
      }));
  },
});

export const renameBlockedUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("No such user");
    const usernameBlocked =
      typeof user.username === "string" && isBlockedName(user.username);
    const displayBlocked =
      typeof user.displayName === "string" && isBlockedName(user.displayName);
    if (!usernameBlocked && !displayBlocked) {
      return { changed: false as const, username: user.username ?? null };
    }

    let username = user.username ?? null;
    if (usernameBlocked) {
      // A neutral name derived from the id; bump a suffix until it is free.
      const base = `player_${String(userId).slice(-6).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      let candidate = base;
      for (let n = 2; ; n++) {
        const taken = await ctx.db
          .query("usernameClaims")
          .withIndex("by_key", (q) => q.eq("key", candidate))
          .filter((q) => q.eq(q.field("releasedAt"), undefined))
          .first();
        const owner = await ctx.db
          .query("users")
          .withIndex("by_username", (q) => q.eq("username", candidate))
          .first();
        if (!taken && !owner) break;
        candidate = `${base}_${n}`;
      }
      const now = Date.now();
      const claims = await ctx.db
        .query("usernameClaims")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const claim of claims) {
        if (claim.releasedAt === undefined) {
          await ctx.db.patch(claim._id, { releasedAt: now });
        }
      }
      await ctx.db.insert("usernameClaims", {
        key: candidate,
        username: candidate,
        userId,
        claimedAt: now,
      });
      username = candidate;
    }

    const displayName =
      displayBlocked || user.displayName === user.username
        ? (username ?? undefined)
        : user.displayName;
    await ctx.db.patch(userId, {
      ...(usernameBlocked ? { username: username ?? undefined } : {}),
      displayName,
    });
    return { changed: true as const, from: user.username ?? null, username };
  },
});
