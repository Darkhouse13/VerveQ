import { query, mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Scrypt } from "lucia";
import {
  auditUsernameDuplicates as auditDuplicateUsernames,
  claimUsernameForUser,
  hasUsableUsername,
  isValidUsername,
  normalizeUsername,
} from "./lib/usernames";
import { describePasswordReason, validatePassword } from "./lib/passwordPolicy";

const PASSWORD_PROVIDER_ID = "password";
const USERNAME_ONLY_ATTEMPT_KIND = "username_claim";
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const USERNAME_ONLY_RATE_LIMITS = {
  perUserTenMinutes: { max: 5, windowMs: 10 * MINUTE_MS },
  perUserDay: { max: 20, windowMs: DAY_MS },
  perDeviceHour: { max: 8, windowMs: 60 * MINUTE_MS },
  perDeviceDay: { max: 30, windowMs: DAY_MS },
  perInviteTenMinutes: { max: 25, windowMs: 10 * MINUTE_MS },
} as const;

function usernameDerivedFromEmail(email: string | undefined): string | null {
  if (!email) return null;
  const localPart = email.split("@")[0] ?? "";
  const derived = localPart
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
  return derived || null;
}

function hasPermanentUsername(user: {
  username?: string;
  isGuest?: boolean;
  isAnonymous?: boolean;
} | null): boolean {
  return !!user &&
    user.isGuest !== true &&
    user.isAnonymous !== true &&
    typeof user.username === "string" &&
    isValidUsername(user.username.trim().toLowerCase());
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const ensureProfile = mutation({
  args: {
    username: v.string(),
    displayName: v.optional(v.string()),
    isGuest: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (args.isGuest) {
      throw new Error("Guest sessions are temporary and tab-local. Create an account with a username to store data.");
    }

    const existing = await ctx.db.get(userId);
    // Convex Auth creates the users doc up-front, so `existing` is always
    // non-null here. Pre-BLOCKER-1 fix the handler returned early on any
    // existing doc and therefore never patched username, leaving
    // users.getByUsername unable to find first-time users (audit #7).
    //
    // New behavior: patch the username only when it is missing or empty;
    // leave already-set usernames alone so this stays idempotent across
    // subsequent signIn / ensureProfile calls.
    const hasUsername = hasUsableUsername(existing);
    const requestedCandidate = normalizeUsername(args.username);
    const existingUsername = hasUsername
      ? normalizeUsername(existing.username)
      : null;
    const emailDerivedUsername = usernameDerivedFromEmail(existing?.email);
    const shouldReplaceExistingUsername =
      hasUsername &&
      requestedCandidate !== existingUsername &&
      emailDerivedUsername !== null &&
      existingUsername === emailDerivedUsername;
    const claimTarget =
      hasUsername && !shouldReplaceExistingUsername
        ? existing.username
        : args.username;
    const { username: candidate } = await claimUsernameForUser(
      ctx,
      claimTarget,
      userId,
    );

    if (hasUsername) {
      const updates: {
        username?: string;
        displayName?: string;
        isGuest?: boolean;
        totalGames?: number;
      } = {};
      if (shouldReplaceExistingUsername || candidate !== existingUsername) {
        updates.username = candidate;
      }
      if (existing?.isGuest !== args.isGuest) {
        updates.isGuest = args.isGuest;
      }
      if (!existing?.displayName && args.displayName) {
        updates.displayName = args.displayName;
      }
      if (existing?.totalGames === undefined) {
        updates.totalGames = 0;
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(userId, updates);
      }
      return userId;
    }


    await ctx.db.patch(userId, {
      username: candidate,
      displayName: args.displayName ?? existing?.displayName ?? candidate,
      isGuest: args.isGuest,
      totalGames: existing?.totalGames ?? 0,
    });

    return userId;
  },
});

export const claimUsernameOnly = mutation({
  args: {
    username: v.string(),
    displayName: v.optional(v.string()),
    deviceNonce: v.optional(v.string()),
    inviteCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(userId);
    if (!existing) throw new Error("User not found");
    if (existing.isAnonymous !== true) {
      throw new Error("Username-only onboarding requires an anonymous session.");
    }

    const now = Date.now();
    const deviceNonce = normalizeDeviceNonce(args.deviceNonce);
    const inviteCode = normalizeInviteCode(args.inviteCode);
    await assertUsernameOnlyRateLimits(ctx, {
      userId,
      deviceNonce,
      inviteCode,
      now,
    });
    await ctx.db.insert("anonymousOnboardingAttempts", {
      userId,
      deviceNonce,
      inviteCode,
      kind: USERNAME_ONLY_ATTEMPT_KIND,
      attemptedAt: now,
    });

    const { username } = await claimUsernameForUser(ctx, args.username, userId);
    await ctx.db.patch(userId, {
      username,
      displayName: args.displayName?.trim() || existing.displayName || username,
      isGuest: false,
      totalGames: existing.totalGames ?? 0,
    });

    return {
      userId,
      username,
      isAnonymous: true,
      isGuest: false,
    };
  },
});

function normalizeDeviceNonce(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 128) : undefined;
}

function normalizeInviteCode(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase().slice(0, 64) : undefined;
}

function countAttemptsSince(
  attempts: Array<{ kind?: string; attemptedAt?: number }>,
  since: number,
) {
  return attempts.filter(
    (attempt) =>
      attempt.kind === USERNAME_ONLY_ATTEMPT_KIND &&
      typeof attempt.attemptedAt === "number" &&
      attempt.attemptedAt >= since,
  ).length;
}

async function countRecentUserAttempts(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  since: number,
) {
  const attempts = await ctx.db
    .query("anonymousOnboardingAttempts")
    .withIndex("by_user_time", (q) => q.eq("userId", userId))
    .collect();
  return countAttemptsSince(attempts, since);
}

async function countRecentDeviceAttempts(
  ctx: Pick<MutationCtx, "db">,
  deviceNonce: string,
  since: number,
) {
  const attempts = await ctx.db
    .query("anonymousOnboardingAttempts")
    .withIndex("by_device_time", (q) => q.eq("deviceNonce", deviceNonce))
    .collect();
  return countAttemptsSince(attempts, since);
}

async function countRecentInviteAttempts(
  ctx: Pick<MutationCtx, "db">,
  inviteCode: string,
  since: number,
) {
  const attempts = await ctx.db
    .query("anonymousOnboardingAttempts")
    .withIndex("by_invite_time", (q) => q.eq("inviteCode", inviteCode))
    .collect();
  return countAttemptsSince(attempts, since);
}

async function assertUsernameOnlyRateLimits(
  ctx: Pick<MutationCtx, "db">,
  args: {
    userId: Id<"users">;
    deviceNonce?: string;
    inviteCode?: string;
    now: number;
  },
) {
  const userTenMinuteCount = await countRecentUserAttempts(
    ctx,
    args.userId,
    args.now - USERNAME_ONLY_RATE_LIMITS.perUserTenMinutes.windowMs,
  );
  if (userTenMinuteCount >= USERNAME_ONLY_RATE_LIMITS.perUserTenMinutes.max) {
    throw new Error("Too many username attempts. Try again later.");
  }

  const userDayCount = await countRecentUserAttempts(
    ctx,
    args.userId,
    args.now - USERNAME_ONLY_RATE_LIMITS.perUserDay.windowMs,
  );
  if (userDayCount >= USERNAME_ONLY_RATE_LIMITS.perUserDay.max) {
    throw new Error("Too many username attempts today. Try again later.");
  }

  if (args.deviceNonce) {
    const deviceHourCount = await countRecentDeviceAttempts(
      ctx,
      args.deviceNonce,
      args.now - USERNAME_ONLY_RATE_LIMITS.perDeviceHour.windowMs,
    );
    if (deviceHourCount >= USERNAME_ONLY_RATE_LIMITS.perDeviceHour.max) {
      throw new Error("Too many username attempts from this device. Try again later.");
    }

    const deviceDayCount = await countRecentDeviceAttempts(
      ctx,
      args.deviceNonce,
      args.now - USERNAME_ONLY_RATE_LIMITS.perDeviceDay.windowMs,
    );
    if (deviceDayCount >= USERNAME_ONLY_RATE_LIMITS.perDeviceDay.max) {
      throw new Error("Too many username attempts from this device today. Try again later.");
    }
  }

  if (args.inviteCode) {
    const inviteTenMinuteCount = await countRecentInviteAttempts(
      ctx,
      args.inviteCode,
      args.now - USERNAME_ONLY_RATE_LIMITS.perInviteTenMinutes.windowMs,
    );
    if (inviteTenMinuteCount >= USERNAME_ONLY_RATE_LIMITS.perInviteTenMinutes.max) {
      throw new Error("Too many username attempts for this invite. Try again later.");
    }
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export const upgradeUsernameOnly = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db.get(userId);
    if (!existing) throw new Error("User not found");
    if (existing.isAnonymous !== true || !hasUsableUsername(existing)) {
      throw new Error("Username-only upgrade requires an anonymous user with a username.");
    }

    const email = normalizeEmail(args.email);
    if (!isValidEmail(email)) {
      throw new Error("Enter a valid email address.");
    }
    const passwordResult = validatePassword(args.password);
    if (!passwordResult.ok && passwordResult.reason) {
      throw new Error(describePasswordReason(passwordResult.reason));
    }

    const existingAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", PASSWORD_PROVIDER_ID).eq("providerAccountId", email),
      )
      .unique();
    if (existingAccount) {
      throw new Error("Email is already linked to an account. Sign in instead.");
    }

    const secret = await new Scrypt().hash(args.password);
    const accountId = await ctx.db.insert("authAccounts", {
      userId,
      provider: PASSWORD_PROVIDER_ID,
      providerAccountId: email,
      secret,
    });

    const accountsAfterInsert = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", PASSWORD_PROVIDER_ID).eq("providerAccountId", email),
      )
      .collect();
    if (
      accountsAfterInsert.length !== 1 ||
      accountsAfterInsert[0]._id !== accountId ||
      accountsAfterInsert[0].userId !== userId
    ) {
      await ctx.db.delete(accountId);
      throw new Error("Account upgrade could not be made safely. Sign in instead.");
    }

    await ctx.db.patch(userId, {
      email,
      displayName: args.displayName?.trim() || existing.displayName || existing.username,
      isGuest: false,
      isAnonymous: false,
      totalGames: existing.totalGames ?? 0,
    });

    return {
      userId,
      email,
      username: existing.username,
      isAnonymous: false,
      isGuest: false,
    };
  },
});

export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const normalized = normalizeUsername(username);
    const matches = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .collect();
    const permanentMatches = matches.filter(hasPermanentUsername);
    if (permanentMatches.length === 0) return null;
    if (permanentMatches.length > 1) {
      throw new Error("Username is not unique. Ask the user for their account link or user id.");
    }
    return permanentMatches[0];
  },
});

export const auditUsernameDuplicates = query({
  args: {},
  handler: async (ctx) => {
    return await auditDuplicateUsernames(ctx);
  },
});
