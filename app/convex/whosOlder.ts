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
    totalRounds: session.kind === "daily" ? session.rounds.length : null,
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
    if (!userId) return { ...base, daily: null, standing: null, bestEndless: null };

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
    if (session.kind === "daily") {
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
