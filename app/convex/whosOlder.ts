import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
// IDENTITY-tier, like the daily quiz (FR-1B): no ELO, no username read, so a
// silently-minted anonymous session can play straight off a reel link.
import { assertSessionUser } from "./lib/authz";
import { incrementTotalGames } from "./lib/playCount";
import { getTodayUTC } from "./lib/daily";
import {
  WHOS_OLDER_DAILY_ROUNDS,
  buildDailyPairs,
  editionNumberForDate,
  endlessBandFor,
  gapDays,
  olderSide,
  pickPair,
  type WhosOlderPair,
  type WhosOlderPlayer,
} from "./lib/whosOlder";
import { challengeVerdict, computeDailyStreak } from "./lib/whosOlderRetention";
import {
  displayName,
  finishedDailyDates,
  reminderStatus,
  streakUserIds,
} from "./lib/dailyGames";
import players from "./data/whos_older_players.json";
import type { Doc, Id } from "./_generated/dataModel";

const POOL: WhosOlderPlayer[] = players;

type SessionDoc = Doc<"whosOlderSessions">;
type Round = SessionDoc["rounds"][number];

function toRound(pair: WhosOlderPair): Round {
  return {
    aId: pair.a.id,
    aName: pair.a.name,
    aDob: pair.a.dob,
    bId: pair.b.id,
    bName: pair.b.name,
    bDob: pair.b.dob,
  };
}

function revealOf(round: Round) {
  const pair = { a: { dob: round.aDob }, b: { dob: round.bDob } };
  return {
    a: { name: round.aName, dob: round.aDob },
    b: { name: round.bName, dob: round.bDob },
    older: olderSide(pair),
    gapDays: gapDays(pair.a, pair.b),
    guess: round.guess ?? null,
    correct: round.correct ?? false,
  };
}

/**
 * The only shape a client ever sees. The pending round carries NAMES ONLY;
 * birth dates appear for a round once it has been answered.
 */
function publicView(session: SessionDoc) {
  const pending =
    session.status === "active" ? session.rounds[session.current] ?? null : null;
  return {
    sessionId: session._id,
    kind: session.kind,
    dateKey: session.dateKey,
    edition: editionNumberForDate(session.dateKey),
    status: session.status,
    score: session.score,
    roundIndex: session.current,
    totalRounds: session.kind === "endless" ? null : session.rounds.length,
    pending: pending ? { a: { name: pending.aName }, b: { name: pending.bName } } : null,
    history: session.rounds.slice(0, session.current).map(revealOf),
  };
}

async function loadOwned(
  ctx: Pick<QueryCtx, "db">,
  sessionId: Id<"whosOlderSessions">,
  userId: Id<"users">,
): Promise<SessionDoc> {
  const session = await ctx.db.get(sessionId);
  if (!session || session.userId !== userId) throw new Error("Session not found");
  return session;
}

async function findDaily(ctx: Pick<QueryCtx, "db">, userId: Id<"users">, dateKey: string) {
  return ctx.db
    .query("whosOlderSessions")
    .withIndex("by_user_kind_date", (q) =>
      q.eq("userId", userId).eq("kind", "daily").eq("dateKey", dateKey),
    )
    .first();
}

const CHALLENGE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** The player's challenges from the last week and who took them. */
async function myChallenges(ctx: Pick<QueryCtx, "db">, userId: Id<"users">) {
  const since = Date.now() - CHALLENGE_LOOKBACK_MS;
  const challenges = await ctx.db
    .query("whosOlderChallenges")
    .withIndex("by_from_created", (q) => q.eq("fromUserId", userId).gt("createdAt", since))
    .order("desc")
    .take(10);
  const out = [];
  for (const c of challenges) {
    const results = await ctx.db
      .query("whosOlderChallengeResults")
      .withIndex("by_challenge", (q) => q.eq("challengeId", c._id))
      .take(50);
    if (results.length === 0) continue;
    out.push({
      challengeId: c._id,
      edition: editionNumberForDate(c.dateKey),
      score: c.score,
      total: c.total,
      results: await Promise.all(
        results
          .sort((a, b) => b.createdAt - a.createdAt)
          .map(async (r) => ({
            name: await displayName(ctx, r.userId),
            score: r.score,
            total: r.total,
            // From the SENDER's side: did this friend beat me?
            beatYou: challengeVerdict(r.score, c.score) === "won",
            tie: r.score === c.score,
          })),
      ),
    });
  }
  return out;
}

/** Where a finished daily score sits among everyone who finished that date. */
async function dailyStanding(ctx: Pick<QueryCtx, "db">, dateKey: string, score: number) {
  const finished = await ctx.db
    .query("whosOlderSessions")
    .withIndex("by_kind_date_status", (q) =>
      q.eq("kind", "daily").eq("dateKey", dateKey).eq("status", "completed"),
    )
    .collect();
  return {
    finishers: finished.length,
    below: finished.filter((s) => s.score < score).length,
  };
}

/** Today's edition + this player's state in it. Signed-out callers get the edition only. */
export const getToday = query({
  args: {},
  handler: async (ctx) => {
    const dateKey = getTodayUTC();
    const base = { dateKey, edition: editionNumberForDate(dateKey) };
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        ...base,
        daily: null,
        standing: null,
        bestEndless: null,
        streak: null,
        reminder: null,
        challenges: [],
      };
    }

    const daily = await findDaily(ctx, userId, dateKey);
    const best = await ctx.db
      .query("whosOlderSessions")
      .withIndex("by_user_kind_score", (q) => q.eq("userId", userId).eq("kind", "endless"))
      .order("desc")
      .first();
    return {
      ...base,
      daily: daily ? publicView(daily) : null,
      standing:
        daily?.status === "completed" ? await dailyStanding(ctx, dateKey, daily.score) : null,
      bestEndless: best ? best.score : null,
      streak: computeDailyStreak(
        await finishedDailyDates(ctx, "older", await streakUserIds(ctx, "older", userId)),
        dateKey,
      ),
      reminder: await reminderStatus(ctx, "older", userId),
      challenges: await myChallenges(ctx, userId),
    };
  },
});

export const getSession = query({
  args: { sessionId: v.id("whosOlderSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId) return null;
    return publicView(session);
  },
});

/** Start — or resume — today's daily. One attempt per player per UTC date. */
export const startDaily = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertSessionUser(ctx, userId);

    const dateKey = getTodayUTC();
    const existing = await findDaily(ctx, userId, dateKey);
    if (existing) return { created: false, session: publicView(existing) };

    const pairs = buildDailyPairs(POOL, dateKey);
    if (pairs.length < WHOS_OLDER_DAILY_ROUNDS) {
      throw new Error("Who's Older pool too small for a daily");
    }
    const sessionId = await ctx.db.insert("whosOlderSessions", {
      userId,
      kind: "daily",
      dateKey,
      rounds: pairs.map(toRound),
      current: 0,
      score: 0,
      status: "active",
      startedAt: Date.now(),
    });
    return { created: true, session: publicView((await ctx.db.get(sessionId))!) };
  },
});

/** Endless streak run — unlocked by finishing today's daily. */
export const startEndless = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertSessionUser(ctx, userId);

    const dateKey = getTodayUTC();
    const daily = await findDaily(ctx, userId, dateKey);
    if (daily?.status !== "completed") {
      throw new Error("Finish today's Who's Older to unlock endless");
    }

    const pair = pickPair(POOL, endlessBandFor(0, Math.random), new Set(), Math.random);
    if (!pair) throw new Error("Who's Older pool is empty");
    const sessionId = await ctx.db.insert("whosOlderSessions", {
      userId,
      kind: "endless",
      dateKey,
      rounds: [toRound(pair)],
      current: 0,
      score: 0,
      status: "active",
      startedAt: Date.now(),
    });
    return { session: publicView((await ctx.db.get(sessionId))!) };
  },
});

/**
 * Answer the pending round. `roundIndex` must name the round the client is
 * looking at: a double tap or a retried request for a round already answered
 * is a no-op that returns the current state, never an answer to the NEXT pair.
 * "timeout" forfeits the round (the player left the tab mid-round).
 */
export const guess = mutation({
  args: {
    sessionId: v.id("whosOlderSessions"),
    roundIndex: v.number(),
    pick: v.union(v.literal("a"), v.literal("b"), v.literal("timeout")),
  },
  handler: async (ctx, { sessionId, roundIndex, pick }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await loadOwned(ctx, sessionId, userId);
    if (session.status !== "active" || roundIndex !== session.current) {
      return { applied: false, reveal: null, session: publicView(session) };
    }

    const rounds = [...session.rounds];
    const round = rounds[session.current];
    const correct =
      pick !== "timeout" &&
      pick === olderSide({ a: { dob: round.aDob }, b: { dob: round.bDob } });
    rounds[session.current] = { ...round, guess: pick, correct };
    const current = session.current + 1;
    const score = session.score + (correct ? 1 : 0);

    let finished: boolean;
    if (session.kind !== "endless") {
      finished = current >= rounds.length;
    } else if (!correct) {
      finished = true;
    } else {
      const used = new Set(rounds.flatMap((r) => [r.aId, r.bId]));
      const next = pickPair(POOL, endlessBandFor(score, Math.random), used, Math.random);
      // Pool exhausted: the run ends on a correct answer — the only way to
      // "win" endless.
      if (next) rounds.push(toRound(next));
      finished = !next;
    }

    await ctx.db.patch(sessionId, {
      rounds,
      current,
      score,
      ...(finished ? { status: "completed" as const, completedAt: Date.now() } : {}),
    });
    if (finished) await incrementTotalGames(ctx, userId);

    const updated = (await ctx.db.get(sessionId))!;
    return {
      applied: true,
      reveal: revealOf(rounds[session.current]),
      session: publicView(updated),
    };
  },
});

// ── Challenge a friend ──────────────────────────────────────────────────────

/**
 * Turn the caller's finished daily into a challenge link. Idempotent per
 * session: sharing twice hands out the same link, so every friend's result
 * lands on one row.
 */
export const createChallenge = mutation({
  args: { sessionId: v.id("whosOlderSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await loadOwned(ctx, sessionId, userId);
    if (session.kind !== "daily" || session.status !== "completed") {
      throw new Error("Only a finished daily can be a challenge");
    }
    const existing = await ctx.db
      .query("whosOlderChallenges")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (existing) return { challengeId: existing._id };
    const challengeId = await ctx.db.insert("whosOlderChallenges", {
      fromUserId: userId,
      sessionId,
      dateKey: session.dateKey,
      score: session.score,
      total: session.rounds.length,
      createdAt: Date.now(),
    });
    return { challengeId };
  },
});

/**
 * What a challenge link shows before play: who set it, the score to beat, and
 * — once this player has an answer for that date — the head-to-head. Unknown
 * or malformed ids read as null (the link simply opens today's daily).
 */
export const getChallenge = query({
  args: { challengeId: v.string() },
  handler: async (ctx, { challengeId }) => {
    const id = ctx.db.normalizeId("whosOlderChallenges", challengeId);
    if (!id) return null;
    const challenge = await ctx.db.get(id);
    if (!challenge) return null;
    const userId = await getAuthUserId(ctx);
    const own = userId === challenge.fromUserId;
    const result =
      userId && !own
        ? await ctx.db
            .query("whosOlderChallengeResults")
            .withIndex("by_challenge_user", (q) => q.eq("challengeId", id).eq("userId", userId))
            .first()
        : null;
    return {
      challengeId: id,
      fromName: await displayName(ctx, challenge.fromUserId),
      edition: editionNumberForDate(challenge.dateKey),
      dateKey: challenge.dateKey,
      isToday: challenge.dateKey === getTodayUTC(),
      score: challenge.score,
      total: challenge.total,
      own,
      myResult: result
        ? { score: result.score, total: result.total, verdict: challengeVerdict(result.score, challenge.score) }
        : null,
    };
  },
});

/**
 * Play a challenge from a PAST date: the sender's frozen ten pairs, answers
 * wiped. One run per player per date — a second challenge for a date they
 * already played resumes (or re-shows) that run. A challenge for today is not
 * started here: the client plays the ordinary daily, which is the same pairs.
 */
export const startChallenge = mutation({
  args: { challengeId: v.id("whosOlderChallenges") },
  handler: async (ctx, { challengeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertSessionUser(ctx, userId);
    const challenge = await ctx.db.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.dateKey === getTodayUTC()) throw new Error("Today's challenge is today's daily");

    // Already answered that date — as its daily back then, or as a challenge.
    for (const kind of ["daily", "challenge"] as const) {
      const prior = await ctx.db
        .query("whosOlderSessions")
        .withIndex("by_user_kind_date", (q) =>
          q.eq("userId", userId).eq("kind", kind).eq("dateKey", challenge.dateKey),
        )
        .first();
      if (prior) return { created: false, session: publicView(prior) };
    }

    const source = await ctx.db.get(challenge.sessionId);
    if (!source) throw new Error("Challenge not found");
    const sessionId = await ctx.db.insert("whosOlderSessions", {
      userId,
      kind: "challenge",
      dateKey: challenge.dateKey,
      challengeId,
      rounds: source.rounds.map(({ guess: _g, correct: _c, ...pair }) => pair),
      current: 0,
      score: 0,
      status: "active",
      startedAt: Date.now(),
    });
    return { created: true, session: publicView((await ctx.db.get(sessionId))!) };
  },
});

/**
 * File the caller's finished run of the challenge's date against it. The
 * score is read from the session, never taken from the client; the sender
 * cannot answer their own challenge. Re-filing is a no-op.
 */
export const recordChallengeResult = mutation({
  args: { challengeId: v.id("whosOlderChallenges"), sessionId: v.id("whosOlderSessions") },
  handler: async (ctx, { challengeId, sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const challenge = await ctx.db.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.fromUserId === userId) return { recorded: false, verdict: null };
    const session = await loadOwned(ctx, sessionId, userId);
    if (session.kind === "endless" || session.status !== "completed" || session.dateKey !== challenge.dateKey) {
      throw new Error("That run does not answer this challenge");
    }
    const verdict = challengeVerdict(session.score, challenge.score);
    const existing = await ctx.db
      .query("whosOlderChallengeResults")
      .withIndex("by_challenge_user", (q) => q.eq("challengeId", challengeId).eq("userId", userId))
      .first();
    if (existing) return { recorded: false, verdict };
    await ctx.db.insert("whosOlderChallengeResults", {
      challengeId,
      userId,
      sessionId,
      score: session.score,
      total: session.rounds.length,
      createdAt: Date.now(),
    });
    return { recorded: true, verdict };
  },
});
