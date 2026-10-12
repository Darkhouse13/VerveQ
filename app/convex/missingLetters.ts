import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
// IDENTITY-tier, like Who's Older and the daily quiz (FR-1B): no ELO, no
// username read, so a silently-minted anonymous session can play straight off
// a reel link.
import { assertSessionUser } from "./lib/authz";
import { incrementTotalGames } from "./lib/playCount";
import { getTodayUTC } from "./lib/daily";
import {
  MISSING_LETTERS_DAILY_ROUNDS,
  buildDailyBoards,
  endlessTierFor,
  isCorrectGuess,
  lettersEditionForDate,
  normalizeGuess,
  pickEndlessBoard,
  publicTiles,
  type LettersBoard,
  type MissingLettersPlayer,
} from "./lib/missingLetters";
import { challengeVerdict, computeDailyStreak } from "./lib/whosOlderRetention";
import {
  displayName,
  finishedDailyDates,
  reminderStatus,
  streakUserIds,
} from "./lib/dailyGames";
import players from "./data/missing_letters_players.json";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * MISSING LETTERS — the app twin of the reel. Same shape as convex/whosOlder.ts:
 * a shared daily (ten boards per UTC date, one attempt, /10), endless once the
 * daily is done, and the retention loop (streak, reminder, challenge links).
 * Rules live in lib/missingLetters.ts; the shared retention reads in
 * lib/dailyGames.ts.
 *
 * Server-authoritative: a pending board reaches the client as tiles with the
 * blanks nulled and the nation clue. The name arrives in the reveal, after the
 * guess.
 */

const POOL: MissingLettersPlayer[] = players;

type SessionDoc = Doc<"missingLettersSessions">;
type Round = SessionDoc["rounds"][number];

function toRound(board: LettersBoard): Round {
  return { id: board.id, name: board.name, nation: board.nation, tier: board.tier, hidden: board.hidden };
}

function revealOf(round: Round) {
  return {
    name: round.name,
    nation: round.nation,
    tier: round.tier,
    hidden: round.hidden,
    guess: round.guess ?? null,
    forfeit: round.forfeit ?? null,
    correct: round.correct ?? false,
  };
}

/** The only shape a client ever sees. The pending round carries NO name. */
function publicView(session: SessionDoc) {
  const pending =
    session.status === "active" ? session.rounds[session.current] ?? null : null;
  return {
    sessionId: session._id,
    kind: session.kind,
    dateKey: session.dateKey,
    edition: lettersEditionForDate(session.dateKey),
    status: session.status,
    score: session.score,
    roundIndex: session.current,
    totalRounds: session.kind === "endless" ? null : session.rounds.length,
    pending: pending
      ? { tier: pending.tier, nation: pending.nation, tiles: publicTiles(pending) }
      : null,
    history: session.rounds.slice(0, session.current).map(revealOf),
  };
}

async function loadOwned(
  ctx: Pick<QueryCtx, "db">,
  sessionId: Id<"missingLettersSessions">,
  userId: Id<"users">,
): Promise<SessionDoc> {
  const session = await ctx.db.get(sessionId);
  if (!session || session.userId !== userId) throw new Error("Session not found");
  return session;
}

async function findDaily(ctx: Pick<QueryCtx, "db">, userId: Id<"users">, dateKey: string) {
  return ctx.db
    .query("missingLettersSessions")
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
    .query("missingLettersChallenges")
    .withIndex("by_from_created", (q) => q.eq("fromUserId", userId).gt("createdAt", since))
    .order("desc")
    .take(10);
  const out = [];
  for (const c of challenges) {
    const results = await ctx.db
      .query("missingLettersChallengeResults")
      .withIndex("by_challenge", (q) => q.eq("challengeId", c._id))
      .take(50);
    if (results.length === 0) continue;
    out.push({
      challengeId: c._id,
      edition: lettersEditionForDate(c.dateKey),
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
    .query("missingLettersSessions")
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
    const base = { dateKey, edition: lettersEditionForDate(dateKey) };
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
      .query("missingLettersSessions")
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
        await finishedDailyDates(ctx, "letters", await streakUserIds(ctx, "letters", userId)),
        dateKey,
      ),
      reminder: await reminderStatus(ctx, "letters", userId),
      challenges: await myChallenges(ctx, userId),
    };
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

    const boards = buildDailyBoards(POOL, dateKey);
    if (boards.length < MISSING_LETTERS_DAILY_ROUNDS) {
      throw new Error("Missing Letters pool too small for a daily");
    }
    const sessionId = await ctx.db.insert("missingLettersSessions", {
      userId,
      kind: "daily",
      dateKey,
      rounds: boards.map(toRound),
      current: 0,
      score: 0,
      status: "active",
      startedAt: Date.now(),
    });
    return { created: true, session: publicView((await ctx.db.get(sessionId))!) };
  },
});

/** Endless run — unlocked by finishing today's daily. */
export const startEndless = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertSessionUser(ctx, userId);

    const dateKey = getTodayUTC();
    const daily = await findDaily(ctx, userId, dateKey);
    if (daily?.status !== "completed") {
      throw new Error("Finish today's Missing Letters to unlock endless");
    }

    const board = pickEndlessBoard(POOL, endlessTierFor(0, Math.random), new Set(), Math.random);
    if (!board) throw new Error("Missing Letters pool is empty");
    const sessionId = await ctx.db.insert("missingLettersSessions", {
      userId,
      kind: "endless",
      dateKey,
      rounds: [toRound(board)],
      current: 0,
      score: 0,
      status: "active",
      startedAt: Date.now(),
    });
    return { session: publicView((await ctx.db.get(sessionId))!) };
  },
});

/**
 * Answer the pending board: `letters` are the blanks filled left to right, or
 * a `forfeit` ("skip" = the player gave up, "timeout" = they left the tab).
 * `roundIndex` must name the round the client is looking at: a double submit
 * or a retried request for a round already answered is a no-op that returns
 * the current state, never an answer to the NEXT board.
 */
export const guess = mutation({
  args: {
    sessionId: v.id("missingLettersSessions"),
    roundIndex: v.number(),
    letters: v.optional(v.string()),
    forfeit: v.optional(v.union(v.literal("skip"), v.literal("timeout"))),
  },
  handler: async (ctx, { sessionId, roundIndex, letters, forfeit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await loadOwned(ctx, sessionId, userId);
    if (session.status !== "active" || roundIndex !== session.current) {
      return { applied: false, reveal: null, session: publicView(session) };
    }

    const rounds = [...session.rounds];
    const round = rounds[session.current];
    const typed = forfeit ? null : normalizeGuess(letters ?? "");
    if (typed !== null && typed.length !== round.hidden.length) {
      throw new Error("Fill every blank before checking");
    }
    const correct = typed !== null && isCorrectGuess(round, typed);
    rounds[session.current] = {
      ...round,
      ...(typed !== null ? { guess: typed } : { forfeit: forfeit! }),
      correct,
    };
    const current = session.current + 1;
    const score = session.score + (correct ? 1 : 0);

    let finished: boolean;
    if (session.kind !== "endless") {
      finished = current >= rounds.length;
    } else if (!correct) {
      finished = true;
    } else {
      const used = new Set(rounds.map((r) => r.id));
      const next = pickEndlessBoard(POOL, endlessTierFor(score, Math.random), used, Math.random);
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
  args: { sessionId: v.id("missingLettersSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await loadOwned(ctx, sessionId, userId);
    if (session.kind !== "daily" || session.status !== "completed") {
      throw new Error("Only a finished daily can be a challenge");
    }
    const existing = await ctx.db
      .query("missingLettersChallenges")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (existing) return { challengeId: existing._id };
    const challengeId = await ctx.db.insert("missingLettersChallenges", {
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
    const id = ctx.db.normalizeId("missingLettersChallenges", challengeId);
    if (!id) return null;
    const challenge = await ctx.db.get(id);
    if (!challenge) return null;
    const userId = await getAuthUserId(ctx);
    const own = userId === challenge.fromUserId;
    const result =
      userId && !own
        ? await ctx.db
            .query("missingLettersChallengeResults")
            .withIndex("by_challenge_user", (q) => q.eq("challengeId", id).eq("userId", userId))
            .first()
        : null;
    return {
      challengeId: id,
      fromName: await displayName(ctx, challenge.fromUserId),
      edition: lettersEditionForDate(challenge.dateKey),
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
 * Play a challenge from a PAST date: the sender's frozen ten boards, answers
 * wiped. One run per player per date — a second challenge for a date they
 * already played resumes (or re-shows) that run. A challenge for today is not
 * started here: the client plays the ordinary daily, which is the same boards.
 */
export const startChallenge = mutation({
  args: { challengeId: v.id("missingLettersChallenges") },
  handler: async (ctx, { challengeId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertSessionUser(ctx, userId);
    const challenge = await ctx.db.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.dateKey === getTodayUTC()) throw new Error("Today's challenge is today's daily");

    for (const kind of ["daily", "challenge"] as const) {
      const prior = await ctx.db
        .query("missingLettersSessions")
        .withIndex("by_user_kind_date", (q) =>
          q.eq("userId", userId).eq("kind", kind).eq("dateKey", challenge.dateKey),
        )
        .first();
      if (prior) return { created: false, session: publicView(prior) };
    }

    const source = await ctx.db.get(challenge.sessionId);
    if (!source) throw new Error("Challenge not found");
    const sessionId = await ctx.db.insert("missingLettersSessions", {
      userId,
      kind: "challenge",
      dateKey: challenge.dateKey,
      challengeId,
      rounds: source.rounds.map(({ guess: _g, forfeit: _f, correct: _c, ...board }) => board),
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
  args: { challengeId: v.id("missingLettersChallenges"), sessionId: v.id("missingLettersSessions") },
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
      .query("missingLettersChallengeResults")
      .withIndex("by_challenge_user", (q) => q.eq("challengeId", challengeId).eq("userId", userId))
      .first();
    if (existing) return { recorded: false, verdict };
    await ctx.db.insert("missingLettersChallengeResults", {
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
