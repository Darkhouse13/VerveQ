import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { assertFullAccountUser } from "./lib/authz";
import { assertClientSport } from "./lib/sports";
import {
  calculateTimeScore,
  normalizeAnswer,
  QUIZ_SERVE_GRACE_SEC,
  RANKED_ANSWER_LIMIT_SEC,
} from "./lib/scoring";
import { pickQuestionPool, planQuestionSequence } from "./lib/imageQuestions";
import {
  resolveQuestionImageUrl,
} from "./lib/questionServe";
import { orderAnswerOptions } from "./lib/answerOptions";
import {
  composeLocalizedQuestion,
  fetchQuestionTranslation,
} from "./lib/contentI18n";
import {
  assertStandardMcqQuestion,
  isStandardMcqQuestion,
} from "./lib/mcqEligibility";

import { abandonQuizSession } from "./lib/rankedSettle";

import { carriedAnswerCounts, pendingKey, takeParkedQuestion } from "./lib/rankedPending";
import { closeOpenRankedQuizRuns } from "./lib/rankedOpenRuns";
import {
  CATALOG_MAX_AGE_MS,
  catalogAsCandidates,
  claimCatalogRefresh,
  isPlayableInMode,
  readCatalog,
  toCatalogEntries,
  writeCatalog,
} from "./lib/questionCatalog";
import { internal } from "./_generated/api";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const QUESTION_BASE_POINTS = 100;
// A quiz is 10 questions; plan the whole sequence at createSession so each
// getQuestion is a single indexed read instead of a full-slice collect
// (~230ms per question on the live pools). getQuestion keeps the collect
// path as a fallback, so pre-plan sessions and >10-question flows still work.
const QUIZ_PLANNED_QUESTIONS = 10;

/** The sport+difficulty slice narrowed to the session mode's playable rows —
 * shared by planning (createSession) and the per-question fallback. */
type QuizDifficulty = "easy" | "intermediate" | "hard";

async function collectModeCandidates(
  ctx: MutationCtx,
  sport: string,
  mode: string | undefined,
  difficulty: QuizDifficulty,
): Promise<Doc<"quizQuestions">[]> {
  const candidates = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_difficulty", (q) =>
      q.eq("sport", sport).eq("difficulty", difficulty),
    )
    .collect();
  return mode === "came_first"
    ? candidates.filter((q) => q.category === "which_came_first")
    : candidates.filter(isStandardMcqQuestion);
}

function sessionDifficulty(session: {
  mode?: string;
  difficulty?: QuizDifficulty;
}): QuizDifficulty {
  return session.mode === "came_first"
    ? "intermediate"
    : session.difficulty ?? "intermediate";
}

/** The client-facing question payload (correctAnswer/explanation withheld). */
async function buildQuestionPayload(
  ctx: MutationCtx,
  picked: Doc<"quizQuestions">,
  locale: string | undefined,
  nextImageUrl: string | null,
) {
  const imageUrl = await resolveQuestionImageUrl(ctx, picked);

  // Display-translate, grade-canonical: serve localized labels plus the
  // canonical `optionValues` the client submits, so grading (which compares
  // the submission to the English correctAnswer) and the checksum are
  // untouched. For en / untranslated, optionValues === options (no-op).
  // correctAnswer + explanation are withheld until checkAnswer.
  const orderedValues = orderAnswerOptions(picked.options, picked.correctAnswer, picked.checksum);
  const translation = await fetchQuestionTranslation(
    ctx,
    picked.checksum,
    locale,
  );
  const localized = composeLocalizedQuestion(picked, orderedValues, translation);
  return {
    question: localized.question,
    options: localized.options,
    optionValues: localized.optionValues,
    difficulty: picked.difficulty,
    checksum: picked.checksum,
    category: picked.category,
    imageUrl,
    // Warm-the-cache hint for the NEXT planned question's image (null when the
    // next question is text-only). Purely advisory — never displayed directly.
    nextImageUrl,
    // The answer window the server enforces (owner ruling 2026-11-05): clients
    // count down graceMs + answerLimitMs - elapsedMs; past it the answer is wrong.
    answerLimitMs: RANKED_ANSWER_LIMIT_SEC * 1000,
    graceMs: QUIZ_SERVE_GRACE_SEC * 1000,
  };
}

export const createSession = mutation({
  args: {
    sport: v.string(),
    mode: v.optional(v.string()),
    difficulty: v.optional(
      v.union(v.literal("easy"), v.literal("intermediate"), v.literal("hard")),
    ),
    // When true, question 1 ships in this same response — one round trip
    // instead of two before the player sees anything. Optional so the previous
    // bundle's createSession→getQuestion sequence keeps working during the
    // backend-first deploy window.
    withFirstQuestion: v.optional(v.boolean()),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, { sport, mode, difficulty, withFirstQuestion, locale }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertFullAccountUser(ctx, userId);
    assertClientSport(sport);
    const normalizedMode = mode === "came_first" ? "came_first" : "quiz";
    const normalizedDifficulty =
      normalizedMode === "came_first" ? "intermediate" : difficulty;

    // One live ranked run per player: close the others first (settle / park),
    // so parallel runs can't be used to pick a first question or keep only a
    // good run. Runs BEFORE taking the parked question so a just-parked one is
    // the question this run serves.
    await closeOpenRankedQuizRuns(ctx, userId, Date.now());

    const planDifficulty = sessionDifficulty({ mode: normalizedMode, difficulty: normalizedDifficulty });
    // Plan from the slice catalog (one small doc) — same eligible set, same
    // uniform-with-image-rules draw. No catalog yet → the original full
    // collect, which also writes the catalog from the rows it already read.
    // A catalog older than CATALOG_MAX_AGE_MS is still used for this run and
    // refreshed in the background — so rebuild cost tracks real play (≤1 per
    // slice per hour) instead of an hourly cron re-reading every slice.
    const catalog = await readCatalog(ctx, sport, normalizedMode, planDifficulty);
    let plannedChecksums: string[];
    if (catalog && catalog.entries.length > 0) {
      plannedChecksums = planQuestionSequence(
        catalogAsCandidates(catalog.entries),
        QUIZ_PLANNED_QUESTIONS,
      );
      if (Date.now() - catalog.builtAt > CATALOG_MAX_AGE_MS) {
        await claimCatalogRefresh(ctx, catalog._id);
        await ctx.scheduler.runAfter(0, internal.questionCatalog.rebuildSlice, {
          sport,
          mode: normalizedMode,
          difficulty: planDifficulty,
        });
      }
    } else {
      const candidates = await collectModeCandidates(ctx, sport, normalizedMode, planDifficulty);
      plannedChecksums = planQuestionSequence(candidates, QUIZ_PLANNED_QUESTIONS);
      if (!catalog) {
        await writeCatalog(ctx, sport, normalizedMode, planDifficulty, toCatalogEntries(candidates));
      }
    }

    // A question this player was served but quit before answering comes back
    // first, on its ORIGINAL clock (lib/rankedPending) — quitting is no reroll.
    const parked = await takeParkedQuestion(
      ctx,
      userId,
      pendingKey(sport, normalizedMode, normalizedDifficulty),
    );
    const parkedRow = parked
      ? await ctx.db
          .query("quizQuestions")
          .withIndex("by_checksum", (q) => q.eq("checksum", parked.checksum))
          .first()
      : null;
    // Same serve-time eligibility re-check as every other serve path: a parked
    // question edited out of the mode since is dropped, not served.
    const parkedDoc =
      parkedRow && isPlayableInMode(parkedRow, normalizedMode) ? parkedRow : null;
    if (parked && parkedDoc) {
      plannedChecksums = [
        parked.checksum,
        ...plannedChecksums.filter((c) => c !== parked.checksum),
      ].slice(0, QUIZ_PLANNED_QUESTIONS);
    }

    let firstQuestion = null;
    let usedChecksums: string[] = [];
    let currentChecksum: string | undefined;
    const carried = !!(parked && parkedDoc);
    if (carried) {
      // Served at once, whatever the client asked: it is already on the clock.
      usedChecksums = [parkedDoc!.checksum];
      currentChecksum = parkedDoc!.checksum;
      if (withFirstQuestion) {
        firstQuestion = await buildQuestionPayload(ctx, parkedDoc!, locale, null);
      }
    } else if (withFirstQuestion && plannedChecksums.length > 0) {
      // The plan may come from a catalog up to an hour old: fetch the row and
      // re-check it's still playable; otherwise the client's getQuestion walks
      // the plan (which skips stale rows).
      const firstDoc = await ctx.db
        .query("quizQuestions")
        .withIndex("by_checksum", (q) => q.eq("checksum", plannedChecksums[0]))
        .first();
      const firstPick =
        firstDoc && isPlayableInMode(firstDoc, normalizedMode) ? firstDoc : null;
      if (firstPick) {
        usedChecksums = [firstPick.checksum];
        currentChecksum = firstPick.checksum;
        firstQuestion = await buildQuestionPayload(
          ctx,
          firstPick,
          locale,
          null /* no next-question preview: it would run under the current clock */,
        );
      }
    }

    // Stamp the first question's serve time AFTER building its payload so the
    // translation/image lookups don't count against the player's answer time.
    const now = Date.now();
    const sessionId = await ctx.db.insert("quizSessions", {
      userId,
      sport,
      mode: normalizedMode,
      difficulty: normalizedDifficulty,
      plannedChecksums,
      usedChecksums,
      ...(currentChecksum
        ? {
            currentChecksum,
            questionStartedAt: carried ? parked!.servedAt : now,
            ...(carried ? { carriedOver: true } : {}),
          }
        : {}),
      score: 0,
      correctCount: 0,
      totalAnswers: 0,
      sumAnswerTimeMs: 0,
      completed: false,
      expiresAt: now + SESSION_TTL_MS,
    });
    // How long this question has already been on the server clock (non-zero
    // only for a carried-over question), so the visible timer matches grading.
    const elapsedMs = carried ? Math.max(0, now - parked!.servedAt) : 0;
    return { sessionId, firstQuestion: firstQuestion ? { ...firstQuestion, elapsedMs } : null };
  },
});

export const getQuestion = mutation({
  args: {
    sessionId: v.id("quizSessions"),
    locale: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, locale }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.userId || session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (Date.now() > session.expiresAt) {
      throw new Error("Session expired");
    }
    if (session.completed) {
      throw new Error("Session already completed");
    }

    // An unanswered question stays the question. Re-serving it (a retry after
    // a dropped response, a remount) returns the same payload and keeps its
    // original clock; drawing a fresh one here would let a player skip any
    // question they don't know and reset the timer for free.
    if (session.currentChecksum) {
      const current = await ctx.db
        .query("quizQuestions")
        .withIndex("by_checksum", (q) => q.eq("checksum", session.currentChecksum!))
        .first();
      if (current) {
        const payload = await buildQuestionPayload(
          ctx,
          current,
          locale,
          null /* no next-question preview: it would run under the current clock */,
        );
        const elapsedMs = Math.max(0, Date.now() - (session.questionStartedAt ?? Date.now()));
        return { ...payload, elapsedMs };
      }
    }

    // A ranked quiz is QUIZ_PLANNED_QUESTIONS long. Serving past that would let
    // a player extend a bad run until accuracy clears the win line (settlement
    // divides by max(planned, answered)) and push userRatings.bestScore — the
    // leaderboard score — above the run length.
    if (session.usedChecksums.length >= QUIZ_PLANNED_QUESTIONS) {
      throw new Error("Quiz already has all its questions");
    }

    // Serve from the sequence planned at createSession: one indexed read
    // instead of re-collecting the whole sport+difficulty slice per question.
    let picked: Doc<"quizQuestions"> | null = null;
    if (session.plannedChecksums) {
      const used = new Set(session.usedChecksums);
      for (const checksum of session.plannedChecksums) {
        if (used.has(checksum)) continue;
        const doc = await ctx.db
          .query("quizQuestions")
          .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
          .first();
        // Skip rows deleted or edited out of mode-eligibility since planning.
        if (!doc) continue;
        if (
          session.mode === "came_first"
            ? doc.category !== "which_came_first"
            : !isStandardMcqQuestion(doc)
        ) {
          continue;
        }
        picked = doc;
        break;
      }
    }

    // Fallback — sessions created before planning shipped, or a plan
    // exhausted/staled mid-session: the original full-slice draw.
    if (!picked) {
      const modeCandidates = await collectModeCandidates(
        ctx,
        session.sport,
        session.mode,
        sessionDifficulty(session),
      );
      const pool = pickQuestionPool(modeCandidates, session.usedChecksums);
      if (!pool.length) throw new Error("No questions available");
      picked = pool[Math.floor(Math.random() * pool.length)];
    }
    if (session.mode !== "came_first") {
      assertStandardMcqQuestion(picked);
    }

    const usedChecksums = [...session.usedChecksums, picked.checksum];
    const payload = await buildQuestionPayload(
      ctx,
      picked,
      locale,
      null /* no next-question preview: it would run under the current clock */,
    );

    // Stamp the serve time AFTER building the payload so the translation and
    // image lookups above don't count against the player's answer time.
    await ctx.db.patch(sessionId, {
      usedChecksums,
      currentChecksum: picked.checksum,
      questionStartedAt: Date.now(),
    });

    return { ...payload, elapsedMs: 0 };
  },
});

export const checkAnswer = mutation({
  args: {
    sessionId: v.id("quizSessions"),
    answer: v.string(),
    correctAnswer: v.optional(v.string()),
    timeTaken: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, answer }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.userId || session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (Date.now() > session.expiresAt) {
      throw new Error("Session expired");
    }
    if (session.completed) {
      throw new Error("Session already completed");
    }

    const checksum = session.currentChecksum;
    if (!checksum) {
      throw new Error("No active question to answer");
    }

    const question = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
      .first();
    if (!question) {
      throw new Error("Question not found");
    }

    const isCorrectRaw =
      normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer);
    const now = Date.now();
    const timeTakenMs = Math.max(
      0,
      now - (session.questionStartedAt ?? now),
    );
    // The serve grace writes off the delivery dead time (network leg, render,
    // image decode) the server-side stamp unavoidably includes — without it
    // the ≤1s full-score window is unreachable on any real connection.
    const timeTakenSec = Math.max(0, timeTakenMs / 1000 - QUIZ_SERVE_GRACE_SEC);
    // 15 s ranked window (owner ruling 2026-11-05), for every question —
    // carried-over ones on their ORIGINAL clock. Past it, even a correct
    // answer is a miss with 0 points (a late "correct" may well be looked up).
    const counts = carriedAnswerCounts(timeTakenSec, session.carriedOver);
    const isCorrect = isCorrectRaw && counts;
    const score = isCorrect
      ? calculateTimeScore(QUESTION_BASE_POINTS, timeTakenSec)
      : 0;

    await ctx.db.patch(sessionId, {
      score: (session.score ?? 0) + score,
      correctCount: (session.correctCount ?? 0) + (isCorrect ? 1 : 0),
      totalAnswers: (session.totalAnswers ?? 0) + 1,
      sumAnswerTimeMs: (session.sumAnswerTimeMs ?? 0) + timeTakenMs,
      currentChecksum: undefined,
      questionStartedAt: undefined,
      carriedOver: undefined,
    });

    await ctx.db.patch(question._id, {
      usageCount: question.usageCount + 1,
      timesAnswered: question.timesAnswered + 1,
      timesCorrect: question.timesCorrect + (isCorrectRaw ? 1 : 0),
    });

    return {
      correct: isCorrect,
      score,
      timeTaken: timeTakenSec,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? null,
    };
  },
});

export const endSession = mutation({
  args: { sessionId: v.id("quizSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) return;
    if (!session.userId || session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (session.completed) return;
    if ((session.totalAnswers ?? 0) > 0 || session.currentChecksum) {
      // Quitting after ≥1 answer settles the run as a loss (lib/rankedSettle).
      await abandonQuizSession(ctx, session);
      return;
    }
    await ctx.db.delete(sessionId);
  },
});

export const penalizeTabSwitch = mutation({
  args: { sessionId: v.id("quizSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.userId || session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (session.completed) {
      return { penalized: false };
    }

    // Leaving mid-run abandons it; with ≥1 answer that settles as a loss.
    await abandonQuizSession(ctx, session);

    return { penalized: true };
  },
});

export const submitFeedback = mutation({
  args: {
    checksum: v.string(),
    votedDifficulty: v.string(),
  },
  handler: async (ctx, { checksum, votedDifficulty }) => {
    // An authenticated identity is required (anonymous auth counts — it still
    // yields a stable userId). Combined with the per-user ledger below, this is
    // what bounds the vote to one per user per question.
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const question = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
      .first();
    if (!question) return;

    // One vote per user per question, first vote wins. difficultyScore is an
    // increment-only running mean (sum/votes), so re-counting a user would skew
    // it with no clean way to back the prior vote out; an existing vote is a
    // no-op. Recording the vote first also closes the door on unlimited voting.
    const existingVote = await ctx.db
      .query("questionFeedbackVotes")
      .withIndex("by_user_checksum", (q) =>
        q.eq("userId", userId).eq("checksum", checksum),
      )
      .first();
    if (existingVote) return;

    const diffMap: Record<string, number> = {
      easy: 1,
      intermediate: 2,
      hard: 3,
    };
    const voteVal = diffMap[votedDifficulty] ?? 2;
    const newVotes = question.difficultyVotes + 1;
    const newScore =
      (question.difficultyScore * question.difficultyVotes + voteVal) /
      newVotes;

    await ctx.db.patch(question._id, {
      difficultyVotes: newVotes,
      difficultyScore: newScore,
    });
    await ctx.db.insert("questionFeedbackVotes", {
      userId,
      checksum,
      votedDifficulty,
      votedAt: Date.now(),
    });
  },
});

export const getSession = query({
  args: { sessionId: v.id("quizSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    if (!session.userId || session.userId !== userId) return null;
    return {
      sport: session.sport,
      difficulty: session.difficulty,
      score: session.score ?? 0,
      correctCount: session.correctCount ?? 0,
      totalAnswers: session.totalAnswers ?? 0,
      completed: session.completed ?? false,
    };
  },
});
