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

// Auth-aware "link opened" — fired from duels.getByLinkCode once a recipient
// reaches the duel screen. The challenger-self branch throws upstream, so a
// captain opening their own link never produces one (the open-stage
// self-exclusion M1/M2 need). Deduped per (actor, linkCode) so a refresh does
// not inflate opens. Distinct from link_tap (the anon /s/d/ HTTP hit that
// feeds dropTestMetrics); dropLoopMetrics counts link_opened only, so the two
// never double-count. Returns whether a row was inserted.
export async function recordLinkOpened(
  ctx: Pick<MutationCtx, "db">,
  args: { actor: string; duel: Doc<"duels">; now: number },
) {
  const existing = await ctx.db
    .query("funnelEvents")
    .withIndex("by_actor_type", (q) =>
      q.eq("actor", args.actor).eq("type", "link_opened"),
    )
    .collect();
  if (existing.some((e) => e.refLinkCode === args.duel.linkCode)) return false;
  await ctx.db.insert("funnelEvents", {
    type: "link_opened",
    actor: args.actor,
    refLinkCode: args.duel.linkCode,
    refChallengerId: args.duel.challengerId,
    ts: args.now,
    meta: { duelId: args.duel._id },
  });
  return true;
}

// Fires at most once per actor (account or hashed guest) when a link-duel
// recipient submits their FIRST answer — the "play started" signal. Mirrors
// recordFirstMatchComplete's once-per-actor dedupe so play-rate and
// completion-rate share the same population. Returns whether a row was
// inserted.
export async function recordGuestPlayStarted(
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
      q.eq("actor", args.actor).eq("type", "guest_play_started"),
    )
    .first();
  if (existing) return false;
  await ctx.db.insert("funnelEvents", {
    type: "guest_play_started",
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

// ── Cold-entry taste round ──
// The cold landing's taste round is 100% client-side (no Convex session) — so
// unlike the duel-loop events, which fire from internal helpers inside duel
// mutations, it has NO server handler to piggyback on. This thin public
// mutation is the cold path's only entry point. It does NOT add a new write
// path: it reuses the same funnelEvents insert + by_actor_type dedupe pattern
// as recordGuestPlayStarted, just reachable from the client.
//
// The session id is an anonymous tab-local token (see src/lib/coldSession.ts).
// We hash it into the guest: actor namespace so cold events share the shape of
// every other guest actor (no raw token stored; no PII). ts is server time,
// like all other events.

// Mirrors duels.ts hashString — a pure, deterministic non-crypto hash, copied
// (not imported) so funnel.ts keeps zero dependency on duels.ts. Cold tokens
// never collide with duel-guest tokens, so byte-identical hashing isn't needed.
function hashString(value: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export const recordTasteRoundEvent = mutation({
  args: {
    // Anonymous tab-local session token (never an email/account id).
    sessionToken: v.string(),
    stage: v.union(v.literal("started"), v.literal("completed")),
    // Coarse traffic source captured on "started" only: utm_source ?? ref.
    source: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, stage, source }) => {
    const trimmed = sessionToken.trim();
    // Mirrors the duel guest-token minimum; a too-short token is ignored
    // rather than throwing, so instrumentation never breaks the taste round.
    if (trimmed.length < 16) return { ok: false, recorded: false };

    const type =
      stage === "started" ? "taste_round_started" : "taste_round_completed";
    const actor = guestActorKey(hashString(`cold-taste:${trimmed}`));

    // At most one started + one completed per session — same once-per-actor
    // dedupe as recordGuestPlayStarted / recordFirstMatchComplete.
    const existing = await ctx.db
      .query("funnelEvents")
      .withIndex("by_actor_type", (q) => q.eq("actor", actor).eq("type", type))
      .first();
    if (existing) return { ok: true, recorded: false };

    await ctx.db.insert("funnelEvents", {
      type,
      actor,
      ts: Date.now(),
      ...(stage === "started" && source ? { meta: { source } } : {}),
    });
    return { ok: true, recorded: true };
  },
});

// ── Career Path top-of-funnel ──
// Career Path is the marketed mode (guest-playable, the target of the /play
// short link and the promo videos), so it needs the same top-of-funnel
// instrumentation as the taste round: did a visitor who landed there start a
// round, did they finish one, and which source brought them. Mirrors
// recordTasteRoundEvent exactly — same anonymous cold-session token, own hash
// namespace so the two surfaces never collapse into one actor. Fired for
// EVERY visitor (guest or signed-in): the once-per-actor dedupe makes the
// counts unique browsers either way, and a signed-in arrival from a promo
// link is still a converted visit.
export const recordCareerPathEvent = mutation({
  args: {
    // Anonymous tab-local session token (never an email/account id).
    sessionToken: v.string(),
    stage: v.union(v.literal("started"), v.literal("completed")),
    // Coarse traffic source captured on "started" only: utm_source ?? ref.
    source: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, stage, source }) => {
    const trimmed = sessionToken.trim();
    // Mirrors the duel guest-token minimum; a too-short token is ignored
    // rather than throwing, so instrumentation never breaks play.
    if (trimmed.length < 16) return { ok: false, recorded: false };

    const type =
      stage === "started" ? "career_path_started" : "career_path_completed";
    const actor = guestActorKey(hashString(`cold-career:${trimmed}`));

    // At most one started + one completed per visitor, ever — same
    // once-per-actor dedupe as recordTasteRoundEvent.
    const existing = await ctx.db
      .query("funnelEvents")
      .withIndex("by_actor_type", (q) => q.eq("actor", actor).eq("type", type))
      .first();
    if (existing) return { ok: true, recorded: false };

    await ctx.db.insert("funnelEvents", {
      type,
      actor,
      ts: Date.now(),
      ...(stage === "started" && source ? { meta: { source } } : {}),
    });
    return { ok: true, recorded: true };
  },
});

// ── Synthetic test actors ──
// Smoke runs and QA create accounts under these username prefixes; their
// activity must never count toward Drop-Test numbers. Events are synthetic
// when their actor is such an account OR they hang off a synthetic
// challenger's duel (covers anon link_taps and guest-side events on smoke
// links, whose actors carry no username).
// "coldqa" deliberately stops short of the bare "cold" — usernames are
// user-chosen and a "cold" prefix could swallow real players.
export const SYNTHETIC_USERNAME_PREFIXES = ["drop_smoke_", "qa_", "coldqa"];

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
// Synthetic test actors (drop_smoke_*, qa_*, coldqa*) are excluded throughout.
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

// ── Drop-Test loop readout (M1–M4) ──
// Finer-grained companion to dropTestMetrics that walks the share → play →
// loop funnel stage by stage, so a leak is locatable (not just whether one
// exists). Maps the S0–S5 spec onto the existing event vocabulary — the only
// added event is guest_play_started:
//   S0 link_created         → challenge_issued, viaLink, organic (no recruiter)
//   S1 link_opened          → link_opened (auth-aware; captain self-opens
//                             excluded — see schema funnelEvents comment)
//   S2 guest_play_started   → guest_play_started            ← added event
//   S3 guest_play_completed → first_match_complete, side=opponent
//   S5 loop_link_created    → challenge_issued, viaLink, with a recruiter
//                             (the issuer was themselves a recruited recipient,
//                             so refChallengerId proves the loop-back)
// The share link is the unit of the loop: every stage is counted as DISTINCT
// refLinkCode, and M1–M3 are scoped to the organic seed links so the funnel is
// monotonic. M4 (the k-factor) compares gen-2 links spawned against seed-link
// completions. Synthetic test actors are excluded throughout. S4/signupRate is
// intentionally omitted — the loop-back is already encoded by refChallengerId,
// so no account_claimed event is needed (see schema funnelEvents comment).
//   npx convex run funnel:dropLoopMetrics '{}'
//   npx convex run funnel:dropLoopMetrics '{"sinceDaysAgo":14}'
export const dropLoopMetrics = internalQuery({
  args: {
    sinceTs: v.optional(v.number()),
    sinceDaysAgo: v.optional(v.number()),
  },
  handler: async (ctx, { sinceTs, sinceDaysAgo }) => {
    const now = Date.now();
    const since =
      sinceTs ?? (sinceDaysAgo ? now - sinceDaysAgo * DAY_MS : 0);
    const syntheticUserIds = await collectSyntheticUserIds(ctx);
    const eventsOf = async (
      type:
        | "link_opened"
        | "challenge_issued"
        | "guest_play_started"
        | "first_match_complete",
    ) =>
      (
        await ctx.db
          .query("funnelEvents")
          .withIndex("by_type_ts", (q) => q.eq("type", type).gte("ts", since))
          .take(10000)
      ).filter((e) => !isSyntheticEvent(e, syntheticUserIds));

    const challenges = await eventsOf("challenge_issued");
    const openEvents = await eventsOf("link_opened");
    const starts = await eventsOf("guest_play_started");
    const completes = await eventsOf("first_match_complete");

    const distinctLinks = (
      events: FunnelEventLike[],
      pred: (e: FunnelEventLike) => boolean = () => true,
    ) =>
      new Set(
        events
          .filter(pred)
          .map((e) => e.refLinkCode)
          .filter((c): c is string => !!c),
      );

    const isViaLink = (e: FunnelEventLike) =>
      ((e as { meta?: { viaLink?: boolean } }).meta?.viaLink ?? false) === true;
    const isOpponentSide = (e: FunnelEventLike) =>
      (e as { meta?: { side?: string } }).meta?.side === "opponent";

    // Seeds: organic captain links only (a recruited issuer's link is a gen-2
    // loop link, counted separately below — never as a seed).
    const seedLinks = distinctLinks(
      challenges,
      (e) => isViaLink(e) && !e.refChallengerId,
    );
    // Gen-2 links: viaLink challenges whose issuer had a recruiter.
    const loopLinks = distinctLinks(
      challenges,
      (e) => isViaLink(e) && !!e.refChallengerId,
    );

    // M1–M3 stages scoped to the seed links so the funnel can't widen.
    const inSeed = (s: Set<string>) =>
      new Set([...s].filter((code) => seedLinks.has(code)));
    const openLinks = inSeed(distinctLinks(openEvents));
    const playLinks = inSeed(distinctLinks(starts));
    const completeLinks = inSeed(distinctLinks(completes, isOpponentSide));

    const seeds = seedLinks.size;
    const opens = openLinks.size;
    const plays = playLinks.size;
    const completions = completeLinks.size;
    const loops = loopLinks.size;
    const ratio = (num: number, den: number) => (den ? num / den : null);

    return {
      window: { since, now },
      excludedSyntheticActors: syntheticUserIds.size,
      seeds,
      opens,
      plays,
      completions,
      loopLinks: loops,
      M1_openRate: ratio(opens, seeds),
      M2_playRate: ratio(plays, opens),
      M3_completionRate: ratio(completions, plays),
      M4_loopRate: ratio(loops, completions),
    };
  },
});

// ── Cold-entry taste-round readout ──
// Read-only rollup of the cold landing's taste round (see
// funnel.recordTasteRoundEvent): how many anonymous visitors started vs.
// finished it, and where the starters came from. Mirrors dropLoopMetrics —
// optional ts window via the by_type_ts index, and a ratio() that never
// divides by zero. Cold-taste actors are anonymous guest: sessions that can't
// be synthetic (no username, no smoke linkCode), so no synthetic filtering is
// needed here. source is meta.source (utm_source ?? ref); a starter with no
// source is bucketed as "direct".
//   npx convex run funnel:coldEntryMetrics '{}'
//   npx convex run funnel:coldEntryMetrics '{"startMs":...,"endMs":...}'
async function startedCompletedRollup(
  ctx: Pick<QueryCtx, "db">,
  types: {
    started: "taste_round_started" | "career_path_started";
    completed: "taste_round_completed" | "career_path_completed";
  },
  { startMs, endMs }: { startMs?: number; endMs?: number },
) {
  const now = Date.now();
  const start = startMs ?? 0;
  const end = endMs ?? now;
  const eventsOf = async (
    type:
      | "taste_round_started"
      | "taste_round_completed"
      | "career_path_started"
      | "career_path_completed",
  ) =>
    await ctx.db
      .query("funnelEvents")
      .withIndex("by_type_ts", (q) =>
        q.eq("type", type).gte("ts", start).lte("ts", end),
      )
      .take(10000);

  const startedEvents = await eventsOf(types.started);
  const completedEvents = await eventsOf(types.completed);

  const started = startedEvents.length;
  const completed = completedEvents.length;
  const ratio = (num: number, den: number) => (den ? num / den : null);

  // Starters grouped by traffic source; missing/undefined → "direct".
  const bySource: Record<string, number> = {};
  for (const e of startedEvents) {
    const source =
      (e as { meta?: { source?: string } }).meta?.source ?? "direct";
    bySource[source] = (bySource[source] ?? 0) + 1;
  }

  return {
    window: { startMs: start, endMs: end },
    started,
    completed,
    completionRate: ratio(completed, started),
    bySource,
  };
}

export const coldEntryMetrics = internalQuery({
  args: {
    startMs: v.optional(v.number()),
    endMs: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    startedCompletedRollup(
      ctx,
      { started: "taste_round_started", completed: "taste_round_completed" },
      args,
    ),
});

// ── Career Path top-of-funnel readout ──
// Same rollup for the Career Path surface (see funnel.recordCareerPathEvent):
// unique visitors who started vs. finished a round, and where the starters
// came from. Because both surfaces dedupe once-per-visitor and bucket source
// the same way, this reads side-by-side with coldEntryMetrics — the promo →
// /play → career-path funnel vs. the bare-/ → taste-round funnel.
//   npx convex run funnel:careerPathMetrics '{}'
//   npx convex run funnel:careerPathMetrics '{"startMs":...,"endMs":...}'
export const careerPathMetrics = internalQuery({
  args: {
    startMs: v.optional(v.number()),
    endMs: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    startedCompletedRollup(
      ctx,
      { started: "career_path_started", completed: "career_path_completed" },
      args,
    ),
});
