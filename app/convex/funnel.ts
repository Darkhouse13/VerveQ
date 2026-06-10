import {
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── Drop-Test funnel events ──
// Insert-only instrumentation for the duel share loop. Four events:
//   link_tap                — a human opened a /s/d/:linkCode share link
//   challenge_issued        — duels.create / duels.rematch
//   first_match_complete    — an actor completed their side of their first duel
//   defeated_player_return  — a defeated account user started a new session
// No PII: actors are user ids or hashed guest tokens, never emails/raw tokens.

export function userActorKey(userId: Id<"users">) {
  return `user:${userId}`;
}

export function guestActorKey(guestTokenHash: string) {
  return `guest:${guestTokenHash}`;
}

// A heartbeat this long after a defeat counts as the "next session start".
const SESSION_GAP_MS = 30 * 60 * 1000;
// Debounce for users.lastSeenAt writes (heartbeat fires once per app load).
const LAST_SEEN_MIN_INTERVAL_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// The recruiter of a user is the challenger of the earliest duel they joined
// as opponent. Stamped onto challenge_issued as refChallengerId so the
// captain → gen1 → gen2 chain is reconstructable from events alone.
async function findRecruiterChallengerId(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
): Promise<Id<"users"> | undefined> {
  const asOpponent = await ctx.db
    .query("duels")
    .withIndex("by_opponent_status", (q) => q.eq("opponentId", userId))
    .collect();
  const joined = asOpponent
    .filter((duel) => duel.challengerId !== userId)
    .sort((a, b) => a.createdAt - b.createdAt);
  return joined[0]?.challengerId;
}

export async function recordChallengeIssued(
  ctx: Pick<MutationCtx, "db">,
  args: {
    challengerId: Id<"users">;
    duelId: Id<"duels">;
    linkCode?: string;
    viaLink: boolean;
    rematchOfDuelId?: Id<"duels">;
    now: number;
  },
) {
  const recruiterId = await findRecruiterChallengerId(ctx, args.challengerId);
  await ctx.db.insert("funnelEvents", {
    type: "challenge_issued",
    actor: userActorKey(args.challengerId),
    refLinkCode: args.linkCode,
    refChallengerId: recruiterId,
    ts: args.now,
    meta: {
      duelId: args.duelId,
      viaLink: args.viaLink,
      ...(args.rematchOfDuelId ? { rematchOfDuelId: args.rematchOfDuelId } : {}),
    },
  });
}

// Fires at most once per actor (account or hashed guest). Returns whether an
// event was inserted.
export async function recordFirstMatchComplete(
  ctx: Pick<MutationCtx, "db">,
  args: {
    actor: string;
    duel: Doc<"duels">;
    side: "challenger" | "opponent";
    now: number;
  },
) {
  const existing = await ctx.db
    .query("funnelEvents")
    .withIndex("by_actor_type", (q) =>
      q.eq("actor", args.actor).eq("type", "first_match_complete"),
    )
    .first();
  if (existing) return false;
  await ctx.db.insert("funnelEvents", {
    type: "first_match_complete",
    actor: args.actor,
    refLinkCode: args.duel.linkCode,
    refChallengerId: args.duel.challengerId,
    ts: args.now,
    meta: { duelId: args.duel._id, side: args.side },
  });
  return true;
}

// Mark "was defeated" at resolution; the return event fires on the loser's
// next session start (sessionHeartbeat). Deduped per (user, duel).
export async function markDefeat(
  ctx: Pick<MutationCtx, "db">,
  args: { userId: Id<"users">; duelId: Id<"duels">; now: number },
) {
  const existing = await ctx.db
    .query("funnelDefeatMarks")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .collect();
  if (existing.some((mark) => mark.duelId === args.duelId)) return;
  await ctx.db.insert("funnelDefeatMarks", {
    userId: args.userId,
    duelId: args.duelId,
    defeatedAt: args.now,
  });
}

// Called once per app load for signed-in users (AuthContext). Maintains
// users.lastSeenAt (debounced) and converts pending defeat marks into a
// defeated_player_return event once a new session starts.
export const sessionHeartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: true };
    const user = await ctx.db.get(userId);
    if (!user) return { ok: true };

    const now = Date.now();
    if (!user.lastSeenAt || now - user.lastSeenAt >= LAST_SEEN_MIN_INTERVAL_MS) {
      await ctx.db.patch(userId, { lastSeenAt: now });
    }

    const marks = await ctx.db
      .query("funnelDefeatMarks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const pending = marks.filter(
      (mark) => !mark.returnFiredAt && now - mark.defeatedAt >= SESSION_GAP_MS,
    );
    if (pending.length > 0) {
      // One return event per comeback, regardless of how many defeats piled
      // up since the last session; refs come from the most recent defeat.
      const latest = [...pending].sort((a, b) => b.defeatedAt - a.defeatedAt)[0];
      const duel = await ctx.db.get(latest.duelId);
      await ctx.db.insert("funnelEvents", {
        type: "defeated_player_return",
        actor: userActorKey(userId),
        refLinkCode: duel?.linkCode,
        refChallengerId: duel?.challengerId,
        ts: now,
        meta: { duelIds: pending.map((mark) => mark.duelId) },
      });
      for (const mark of pending) {
        await ctx.db.patch(mark._id, { returnFiredAt: now });
      }
    }

    return { ok: true };
  },
});

// ── Synthetic test actors ──
// Smoke runs and QA create accounts under these username prefixes; their
// activity must never count toward Drop-Test numbers. Events are synthetic
// when their actor is such an account OR they hang off a synthetic
// challenger's duel (covers anon link_taps and guest-side events on smoke
// links, whose actors carry no username).
export const SYNTHETIC_USERNAME_PREFIXES = ["drop_smoke_", "qa_"];

// Exact linkCodes smoke runs probed that never belonged to any duel (the
// deliberate bogus-code tap). Codes verbatim, never a pattern.
export const KNOWN_SMOKE_LINKCODES = ["DQZZZZZZZZ99"];

export function isSyntheticUsername(username: string | undefined | null) {
  if (!username) return false;
  return SYNTHETIC_USERNAME_PREFIXES.some((p) => username.startsWith(p));
}

type FunnelEventLike = {
  actor: string;
  refLinkCode?: string;
  refChallengerId?: Id<"users">;
};

export function isSyntheticEvent(
  event: FunnelEventLike,
  syntheticUserIds: ReadonlySet<string>,
) {
  if (event.actor.startsWith("user:")) {
    if (syntheticUserIds.has(event.actor.slice("user:".length))) return true;
  }
  if (event.refLinkCode && KNOWN_SMOKE_LINKCODES.includes(event.refLinkCode)) {
    return true;
  }
  return !!event.refChallengerId && syntheticUserIds.has(event.refChallengerId);
}

async function collectSyntheticUserIds(ctx: Pick<QueryCtx, "db">) {
  const ids = new Set<string>();
  for (const prefix of SYNTHETIC_USERNAME_PREFIXES) {
    const rows = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.gte("username", prefix).lt("username", prefix + "\uffff"),
      )
      .take(1000);
    for (const row of rows) ids.add(row._id);
  }
  return ids;
}

// ── Drop-Test readout ──
// Read-only rollup of the four metrics so the Drop Test is readable without
// log spelunking:  npx convex run funnel:dropTestMetrics '{}'
// Synthetic test actors (drop_smoke_*, qa_*) are excluded throughout.
export const dropTestMetrics = internalQuery({
  args: { sinceTs: v.optional(v.number()) },
  handler: async (ctx, { sinceTs }) => {
    const since = sinceTs ?? 0;
    const now = Date.now();
    const syntheticUserIds = await collectSyntheticUserIds(ctx);
    const eventsOf = async (
      type: "link_tap" | "challenge_issued" | "first_match_complete" | "defeated_player_return",
    ) =>
      (
        await ctx.db
          .query("funnelEvents")
          .withIndex("by_type_ts", (q) => q.eq("type", type).gte("ts", since))
          .take(10000)
      ).filter((e) => !isSyntheticEvent(e, syntheticUserIds));

    const taps = await eventsOf("link_tap");
    const firstMatches = await eventsOf("first_match_complete");
    const challenges = await eventsOf("challenge_issued");
    const returns = await eventsOf("defeated_player_return");

    // 1) link-tap → first-match %: of links that got at least one human tap,
    //    how many had the OPPONENT side reach first_match_complete.
    const tappedLinks = new Set(
      taps.map((e) => e.refLinkCode).filter((c): c is string => !!c),
    );
    const matchedLinks = new Set(
      firstMatches
        .filter(
          (e) =>
            (e.meta as { side?: string } | undefined)?.side === "opponent" &&
            e.refLinkCode,
        )
        .map((e) => e.refLinkCode as string),
    );
    const tappedAndMatched = [...tappedLinks].filter((c) => matchedLinks.has(c));
    const linkTapToFirstMatchPct = tappedLinks.size
      ? (100 * tappedAndMatched.length) / tappedLinks.size
      : null;

    // 2) % of new players (accounts created in-window) issuing ≥1 challenge
    //    within 48h of account creation.
    const newUsers = (await ctx.db.query("users").take(20000)).filter(
      (u) => u._creationTime >= since && !isSyntheticUsername(u.username),
    );
    const firstChallengeAtByActor = new Map<string, number>();
    for (const e of challenges) {
      const prev = firstChallengeAtByActor.get(e.actor);
      if (prev === undefined || e.ts < prev) firstChallengeAtByActor.set(e.actor, e.ts);
    }
    const newPlayersIssuing = newUsers.filter((u) => {
      const at = firstChallengeAtByActor.get(userActorKey(u._id));
      return at !== undefined && at - u._creationTime <= 48 * 60 * 60 * 1000;
    });
    const newPlayersIssuingChallengeWithin48hPct = newUsers.length
      ? (100 * newPlayersIssuing.length) / newUsers.length
      : null;

    // 3) gen-2 per captain. Captains = actors who issued a challenge with no
    //    recruiter (organic). For each captain, gen2Issuers = distinct other
    //    actors whose challenge_issued is attributed to them — i.e. recruits
    //    who turned around and issued their own challenge, creating gen 2.
    const captains = new Set(
      challenges.filter((e) => !e.refChallengerId).map((e) => e.actor),
    );
    const gen2ByCaptain = new Map<string, Set<string>>();
    for (const e of challenges) {
      if (!e.refChallengerId) continue;
      const captainKey = userActorKey(e.refChallengerId);
      if (!captains.has(captainKey)) continue;
      if (e.actor === captainKey) continue;
      if (!gen2ByCaptain.has(captainKey)) gen2ByCaptain.set(captainKey, new Set());
      gen2ByCaptain.get(captainKey)!.add(e.actor);
    }
    const gen2Counts = [...captains].map(
      (c) => gen2ByCaptain.get(c)?.size ?? 0,
    );
    const avgGen2PerCaptain = captains.size
      ? gen2Counts.reduce((a, b) => a + b, 0) / captains.size
      : null;

    // 4) D7 retention of defeated players: of account users defeated ≥7 days
    //    ago (in-window), how many were seen again ≥7 days after the defeat.
    //    Guests are not measurable here — they leave no durable identity.
    const allMarks = (await ctx.db.query("funnelDefeatMarks").take(10000)).filter(
      (mark) => !syntheticUserIds.has(mark.userId),
    );
    const firstDefeatByUser = new Map<Id<"users">, number>();
    for (const mark of allMarks) {
      if (mark.defeatedAt < since) continue;
      const prev = firstDefeatByUser.get(mark.userId);
      if (prev === undefined || mark.defeatedAt < prev) {
        firstDefeatByUser.set(mark.userId, mark.defeatedAt);
      }
    }
    let d7Cohort = 0;
    let d7Retained = 0;
    for (const [defeatedUserId, defeatedAt] of firstDefeatByUser) {
      if (now - defeatedAt < 7 * DAY_MS) continue; // not yet measurable
      d7Cohort += 1;
      const defeated = await ctx.db.get(defeatedUserId);
      if (defeated?.lastSeenAt && defeated.lastSeenAt - defeatedAt >= 7 * DAY_MS) {
        d7Retained += 1;
      }
    }
    const defeatedD7RetentionPct = d7Cohort ? (100 * d7Retained) / d7Cohort : null;

    return {
      window: { sinceTs: since, now },
      excludedSyntheticActors: syntheticUserIds.size,
      counts: {
        link_tap: taps.length,
        challenge_issued: challenges.length,
        first_match_complete: firstMatches.length,
        defeated_player_return: returns.length,
        defeatMarks: allMarks.length,
      },
      linkTapToFirstMatchPct,
      linkTapToFirstMatch: {
        tappedLinks: tappedLinks.size,
        convertedLinks: tappedAndMatched.length,
      },
      newPlayersIssuingChallengeWithin48hPct,
      newPlayersIssuingChallengeWithin48h: {
        newPlayers: newUsers.length,
        issuing: newPlayersIssuing.length,
      },
      avgGen2PerCaptain,
      gen2: {
        captains: captains.size,
        gen2IssuersTotal: gen2Counts.reduce((a, b) => a + b, 0),
      },
      defeatedD7RetentionPct,
      defeatedD7: { cohort: d7Cohort, retained: d7Retained },
    };
  },
});
