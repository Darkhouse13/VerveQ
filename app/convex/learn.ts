import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  buildLadder,
  getLearnNodeSummary,
  listSubjectNodeSummaries,
  type BuiltLadderQuestion,
} from "./learnLadderBuilder";
import {
  DEFAULT_LEARN_SUBJECT,
  isPipelineProofNode,
  learnSubjects,
  resolveLearnSubject,
  skillNodeById,
  skillNodeIds,
  skillNodes,
  type SkillNode,
  type SkillNodeId,
} from "./learnSkillGraph";
import {
  applyLearnLadderCompletion,
  calculateLearnProgressPct,
  isLearnReviewDue,
  markLearnAttemptStarted,
  LEARN_STATE_WEIGHTS,
  type LearnCompletionStats,
  type LearnMasterySnapshot,
  type LearnMasteryState,
} from "./learnMasteryLogic";
import { gradeLearnAnswer } from "./learnGraders";
import {
  DEFAULT_LEARN_EASE_FACTOR,
  applyLearnRungRating,
  type LearnFelt,
  type LearnRating,
  type LearnRungReviewSnapshot,
} from "./learnSpacingLogic";

const LEARN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type LearnRungResult = Doc<"learnSessions">["rungResults"][number];
type LearnRungReview = Doc<"learnRungReviews">;

const learnRatingValidator = v.union(
  v.literal("again"),
  v.literal("hard"),
  v.literal("good"),
  v.literal("easy"),
);

const learnFeltValidator = v.union(v.literal("learn"), v.literal("test"));

function assertSkillNodeId(nodeId: string): SkillNodeId {
  if (!(skillNodeIds as readonly string[]).includes(nodeId)) {
    throw new Error("Unknown learn node");
  }
  return nodeId as SkillNodeId;
}

async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

function snapshotFromMastery(
  mastery: Doc<"learnMastery"> | null | undefined,
): LearnMasterySnapshot | null {
  if (!mastery) return null;
  return {
    state: mastery.state,
    proficientAt: mastery.proficientAt,
    reviewDueAt: mastery.reviewDueAt,
    masteredAt: mastery.masteredAt,
  };
}

function stateFromMastery(
  mastery: Doc<"learnMastery"> | null | undefined,
): LearnMasteryState {
  return mastery?.state ?? "untouched";
}

function latestMasteryByNode(
  rows: Doc<"learnMastery">[],
): Map<string, Doc<"learnMastery">> {
  const byNode = new Map<string, Doc<"learnMastery">>();
  for (const row of rows) {
    const existing = byNode.get(row.nodeId);
    if (!existing || row.updatedAt > existing.updatedAt) {
      byNode.set(row.nodeId, row);
    }
  }
  return byNode;
}

async function getMasteryForNode(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  nodeId: string,
): Promise<Doc<"learnMastery"> | null> {
  const rows = await ctx.db
    .query("learnMastery")
    .withIndex("by_user_node", (q) =>
      q.eq("userId", userId).eq("nodeId", nodeId),
    )
    .collect();
  return latestMasteryByNode(rows).get(nodeId) ?? null;
}

function snapshotFromRungReview(
  review: LearnRungReview | null | undefined,
): LearnRungReviewSnapshot | null {
  if (!review) return null;
  return {
    reviewState: review.reviewState,
    intervalMs: review.intervalMs,
    easeFactor: review.easeFactor,
    repetitions: review.repetitions,
    lapses: review.lapses,
  };
}

async function getRungReview(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  rungId: string,
): Promise<LearnRungReview | null> {
  const rows = await ctx.db
    .query("learnRungReviews")
    .withIndex("by_user_rung", (q) =>
      q.eq("userId", userId).eq("rungId", rungId),
    )
    .collect();

  return rows.reduce<LearnRungReview | null>((latest, row) => {
    if (!latest || row.updatedAt > latest.updatedAt) return row;
    return latest;
  }, null);
}

function latestRungResult(
  results: LearnRungResult[],
  rungId: string,
): LearnRungResult | null {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    if (result.rungId === rungId) return result;
  }
  return null;
}

async function requireOwnedSession(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"learnSessions">,
  userId: Id<"users">,
) {
  const session = await ctx.db.get(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.userId !== userId) {
    throw new Error("Not authorized for this session");
  }
  return session;
}

async function patchOrInsertRungReview(
  ctx: MutationCtx,
  existing: LearnRungReview | null,
  value: Omit<LearnRungReview, "_id" | "_creationTime">,
) {
  if (existing) {
    await ctx.db.patch(existing._id, {
      nodeId: value.nodeId,
      subject: value.subject,
      reviewState: value.reviewState,
      dueAt: value.dueAt,
      intervalMs: value.intervalMs,
      easeFactor: value.easeFactor,
      repetitions: value.repetitions,
      lapses: value.lapses,
      lastRating: value.lastRating,
      lastFelt: value.lastFelt,
      lastCorrect: value.lastCorrect,
      lastAnsweredAt: value.lastAnsweredAt,
      lastRatedAt: value.lastRatedAt,
      lastFeltAt: value.lastFeltAt,
      updatedAt: value.updatedAt,
    });
    return existing._id;
  }

  return await ctx.db.insert("learnRungReviews", value);
}

async function patchOrInsertMastery(
  ctx: MutationCtx,
  existing: Doc<"learnMastery"> | null,
  userId: Id<"users">,
  node: SkillNode,
  next: LearnMasterySnapshot,
  now: number,
  completion?: LearnCompletionStats,
) {
  const base = {
    state: next.state,
    proficientAt: next.proficientAt,
    reviewDueAt: next.reviewDueAt,
    masteredAt: next.masteredAt,
    updatedAt: now,
    ...(completion
      ? {
          lastCompletedAt: now,
          lastFirstTryCorrect: completion.firstTryCorrect,
          lastTotal: completion.total,
        }
      : {}),
  };

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...base,
      startedAt: existing.startedAt ?? now,
    });
    return existing._id;
  }

  return await ctx.db.insert("learnMastery", {
    userId,
    nodeId: node.id,
    subject: node.subject,
    state: next.state,
    startedAt: now,
    updatedAt: now,
    ...(next.proficientAt !== undefined
      ? { proficientAt: next.proficientAt }
      : {}),
    ...(next.reviewDueAt !== undefined
      ? { reviewDueAt: next.reviewDueAt }
      : {}),
    ...(next.masteredAt !== undefined ? { masteredAt: next.masteredAt } : {}),
    ...(completion
      ? {
          lastCompletedAt: now,
          lastFirstTryCorrect: completion.firstTryCorrect,
          lastTotal: completion.total,
        }
      : {}),
  });
}

async function markNodeStarted(
  ctx: MutationCtx,
  userId: Id<"users">,
  node: SkillNode,
  now: number,
) {
  const existing = await getMasteryForNode(ctx, userId, node.id);
  const transition = markLearnAttemptStarted(snapshotFromMastery(existing));
  if (existing && !transition.justChanged) return;

  await patchOrInsertMastery(ctx, existing, userId, node, transition.next, now);
}

function subjectNodeSummaries(subject: string) {
  return listSubjectNodeSummaries(subject);
}

function subjectProgress(
  nodes: SkillNode[],
  masteryByNodeId: Map<string, Doc<"learnMastery">>,
): number {
  return calculateLearnProgressPct(
    nodes.map((node) => stateFromMastery(masteryByNodeId.get(node.id))),
  );
}

function summarizeFirstAttempts(
  rungIds: string[],
  results: LearnRungResult[],
): { complete: boolean; missingRungIds: string[] } & LearnCompletionStats {
  const firstAttemptByRung = new Map<string, LearnRungResult>();
  for (const result of results) {
    if (!firstAttemptByRung.has(result.rungId)) {
      firstAttemptByRung.set(result.rungId, result);
    }
  }

  const missingRungIds = rungIds.filter((rungId) => !firstAttemptByRung.has(rungId));
  const firstTryCorrect = rungIds.reduce(
    (count, rungId) => count + (firstAttemptByRung.get(rungId)?.correct ? 1 : 0),
    0,
  );

  return {
    complete: missingRungIds.length === 0,
    missingRungIds,
    firstTryCorrect,
    total: rungIds.length,
  };
}

function findCommittedRung(nodeId: string, rungId: string): BuiltLadderQuestion {
  const skillNodeId = assertSkillNodeId(nodeId);
  const rung = buildLadder(skillNodeId).questions.find(
    (question) => question.checksum === rungId,
  );
  if (!rung) throw new Error("Rung not found in committed ladder");
  return rung;
}

function sanitizeRung(rung: BuiltLadderQuestion) {
  const base = {
    questionId: rung.checksum,
    type: rung.type,
    stem: rung.question,
    options: rung.options,
  };
  switch (rung.type) {
    case "mcq":
    case "text":
      return base;
    case "numeric":
      return {
        ...base,
        ...(rung.numericUnit ? { unit: rung.numericUnit } : {}),
        ...(rung.numericTolerance !== undefined
          ? { tolerance: rung.numericTolerance }
          : {}),
      };
    case "order":
      return {
        ...base,
        items:
          rung.items ??
          rung.options.map((text) => ({
            id: text,
            text,
          })),
      };
  }
}

function sanitizeStoredAnswer(rung: BuiltLadderQuestion, answer: unknown): unknown {
  switch (rung.type) {
    case "order":
      return Array.isArray(answer)
        ? answer.filter((value): value is string => typeof value === "string")
        : [];
    case "numeric":
      if (typeof answer === "number" || typeof answer === "string") return answer;
      if (typeof answer === "object" && answer !== null && !Array.isArray(answer)) {
        const record = answer as Record<string, unknown>;
        return {
          ...(typeof record.value === "number" || typeof record.value === "string"
            ? { value: record.value }
            : {}),
          ...(typeof record.unit === "string" ? { unit: record.unit } : {}),
        };
      }
      return null;
    case "mcq":
    case "text":
      return typeof answer === "string" ? answer : "";
  }
}

export const getLearnNodes = query({
  args: { subject: v.string() },
  handler: async (ctx, { subject }) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const summaries = subjectNodeSummaries(subject);
    const rows = await ctx.db
      .query("learnMastery")
      .withIndex("by_user_subject", (q) =>
        q.eq("userId", userId).eq("subject", subject),
      )
      .collect();
    const masteryByNodeId = latestMasteryByNode(rows);
    const nodes = summaries.map((summary) => {
      const mastery = masteryByNodeId.get(summary.nodeId);
      return {
        nodeId: summary.nodeId,
        name: summary.node.name,
        playable: summary.playable,
        state: stateFromMastery(mastery),
        reviewDue: isLearnReviewDue(snapshotFromMastery(mastery), now),
      };
    });

    return {
      subject,
      progressPct: subjectProgress(
        summaries.map((summary) => summary.node),
        masteryByNodeId,
      ),
      nodes,
    };
  },
});

export const getLearnLadder = mutation({
  args: { nodeId: v.string() },
  handler: async (ctx, { nodeId }) => {
    const userId = await requireUserId(ctx);
    const skillNodeId = assertSkillNodeId(nodeId);
    const summary = getLearnNodeSummary(skillNodeId);
    if (!summary.playable) {
      throw new Error("Learn node is not playable yet");
    }

    const now = Date.now();
    await markNodeStarted(ctx, userId, summary.node, now);

    const ladder = buildLadder(skillNodeId);
    const sessionId = await ctx.db.insert("learnSessions", {
      userId,
      nodeId: skillNodeId,
      subject: summary.node.subject,
      rungIds: ladder.questions.map((rung) => rung.checksum),
      rungResults: [],
      startedAt: now,
      updatedAt: now,
      expiresAt: now + LEARN_SESSION_TTL_MS,
    });

    return {
      nodeId: skillNodeId,
      sessionId,
      // Display-only teaching headline for the end card — carries no answers.
      conceptLine: ladder.conceptLine,
      rungs: ladder.questions.map(sanitizeRung),
    };
  },
});

export const submitLearnRung = mutation({
  args: {
    sessionId: v.id("learnSessions"),
    questionId: v.string(),
    answer: v.any(),
  },
  handler: async (ctx, { sessionId, questionId, answer }) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }
    if (session.completedAt) {
      throw new Error("Session already completed");
    }
    const now = Date.now();
    if (now > session.expiresAt) {
      throw new Error("Session expired");
    }
    if (!session.rungIds.includes(questionId)) {
      throw new Error("Question not active for this session");
    }

    const rung = findCommittedRung(session.nodeId, questionId);
    const verdict = gradeLearnAnswer(rung, answer);

    const firstTry = !session.rungResults.some(
      (result) => result.rungId === questionId,
    );
    await ctx.db.patch(sessionId, {
      rungResults: [
        ...session.rungResults,
        {
          rungId: questionId,
          answer: sanitizeStoredAnswer(rung, answer),
          correct: verdict.correct,
          firstTry,
          answeredAt: now,
          ...(verdict.branchId ? { branchId: verdict.branchId } : {}),
        },
      ],
      updatedAt: now,
    });

    return verdict;
  },
});

export const rateLearnRung = mutation({
  args: {
    sessionId: v.id("learnSessions"),
    questionId: v.string(),
    rating: learnRatingValidator,
  },
  handler: async (ctx, { sessionId, questionId, rating }) => {
    const userId = await requireUserId(ctx);
    const session = await requireOwnedSession(ctx, sessionId, userId);
    const now = Date.now();
    if (now > session.expiresAt) {
      throw new Error("Session expired");
    }
    if (!session.rungIds.includes(questionId)) {
      throw new Error("Question not active for this session");
    }

    const result = latestRungResult(session.rungResults, questionId);
    if (!result) {
      throw new Error("Cannot rate a rung before it is answered");
    }

    const existing = await getRungReview(ctx, userId, questionId);
    const schedule = applyLearnRungRating(
      snapshotFromRungReview(existing),
      rating as LearnRating,
      result.correct,
      now,
    );

    await patchOrInsertRungReview(ctx, existing, {
      userId,
      nodeId: session.nodeId,
      subject: session.subject,
      rungId: questionId,
      reviewState: schedule.reviewState,
      dueAt: schedule.dueAt,
      intervalMs: schedule.intervalMs,
      easeFactor: schedule.easeFactor,
      repetitions: schedule.repetitions,
      lapses: schedule.lapses,
      lastRating: rating as LearnRating,
      ...(existing?.lastFelt ? { lastFelt: existing.lastFelt } : {}),
      lastCorrect: result.correct,
      lastAnsweredAt: result.answeredAt,
      lastRatedAt: now,
      ...(existing?.lastFeltAt ? { lastFeltAt: existing.lastFeltAt } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    return {
      reviewState: schedule.reviewState,
      nextReview: schedule.nextReview,
      intervalMs: schedule.intervalMs,
      masteryDelta: schedule.masteryDelta,
    };
  },
});

export const recordLearnRungFelt = mutation({
  args: {
    sessionId: v.id("learnSessions"),
    questionId: v.string(),
    felt: learnFeltValidator,
  },
  handler: async (ctx, { sessionId, questionId, felt }) => {
    const userId = await requireUserId(ctx);
    const session = await requireOwnedSession(ctx, sessionId, userId);
    const now = Date.now();
    if (now > session.expiresAt) {
      throw new Error("Session expired");
    }
    if (!session.rungIds.includes(questionId)) {
      throw new Error("Question not active for this session");
    }

    const result = latestRungResult(session.rungResults, questionId);
    if (!result) {
      throw new Error("Cannot record felt signal before the rung is answered");
    }

    const existing = await getRungReview(ctx, userId, questionId);
    await patchOrInsertRungReview(ctx, existing, {
      userId,
      nodeId: session.nodeId,
      subject: session.subject,
      rungId: questionId,
      reviewState: existing?.reviewState ?? "learning",
      dueAt: existing?.dueAt ?? now,
      intervalMs: existing?.intervalMs ?? 0,
      easeFactor: existing?.easeFactor ?? DEFAULT_LEARN_EASE_FACTOR,
      repetitions: existing?.repetitions ?? 0,
      lapses: existing?.lapses ?? 0,
      ...(existing?.lastRating ? { lastRating: existing.lastRating } : {}),
      lastFelt: felt as LearnFelt,
      lastCorrect: result.correct,
      lastAnsweredAt: result.answeredAt,
      ...(existing?.lastRatedAt ? { lastRatedAt: existing.lastRatedAt } : {}),
      lastFeltAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    return {
      felt,
      recordedAt: now,
    };
  },
});

export const completeLearnLadder = mutation({
  args: { sessionId: v.id("learnSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (session.userId !== userId) {
      throw new Error("Not authorized for this session");
    }

    const stats = summarizeFirstAttempts(session.rungIds, session.rungResults);
    if (!stats.complete) {
      throw new Error("Cannot complete ladder before all rungs are answered");
    }

    const existing = await getMasteryForNode(ctx, userId, session.nodeId);
    if (session.completedAt) {
      const snapshot = snapshotFromMastery(existing);
      return {
        state: snapshot?.state ?? "untouched",
        justChanged: false,
        reviewDueAt: snapshot?.reviewDueAt,
        masteredAt: snapshot?.masteredAt,
        firstTryCorrect: stats.firstTryCorrect,
        total: stats.total,
      };
    }

    const now = Date.now();
    if (now > session.expiresAt) {
      throw new Error("Session expired");
    }

    const skillNodeId = assertSkillNodeId(session.nodeId);
    const node = skillNodeById[skillNodeId];
    const transition = applyLearnLadderCompletion(
      snapshotFromMastery(existing),
      stats,
      now,
    );

    await patchOrInsertMastery(
      ctx,
      existing,
      userId,
      node,
      transition.next,
      now,
      stats,
    );
    await ctx.db.patch(sessionId, {
      completedAt: now,
      updatedAt: now,
    });

    return {
      state: transition.next.state,
      justChanged: transition.justChanged,
      reviewDueAt: transition.next.reviewDueAt,
      masteredAt: transition.next.masteredAt,
      firstTryCorrect: stats.firstTryCorrect,
      total: stats.total,
    };
  },
});

function reviewMasteryValue(review: LearnRungReview): number {
  if (review.reviewState === "locked_in") {
    return Math.min(1, 0.75 + Math.min(review.repetitions, 5) * 0.04);
  }
  return Math.min(0.6, 0.25 + Math.min(review.repetitions, 3) * 0.08);
}

function reviewPlanState(
  masteryState: LearnMasteryState,
  reviews: LearnRungReview[],
): "locked" | "learning" {
  if (reviews.some((review) => review.reviewState === "learning")) {
    return "learning";
  }
  if (
    reviews.length > 0 ||
    masteryState === "proficient" ||
    masteryState === "mastered"
  ) {
    return "locked";
  }
  return "learning";
}

async function buildSubjectReviewPlan(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  subject: string,
  now: number,
) {
  const summaries = subjectNodeSummaries(subject);
  const masteryRows = await ctx.db
    .query("learnMastery")
    .withIndex("by_user_subject", (q) =>
      q.eq("userId", userId).eq("subject", subject),
    )
    .collect();
  const reviewRows = await ctx.db
    .query("learnRungReviews")
    .withIndex("by_user_subject", (q) =>
      q.eq("userId", userId).eq("subject", subject),
    )
    .collect();

  const masteryByNodeId = latestMasteryByNode(masteryRows);
  const reviewsByNodeId = new Map<string, LearnRungReview[]>();
  for (const row of reviewRows) {
    const current = reviewsByNodeId.get(row.nodeId) ?? [];
    current.push(row);
    reviewsByNodeId.set(row.nodeId, current);
  }

  const nodes = summaries.map((summary) => {
    const masteryState = stateFromMastery(
      masteryByNodeId.get(summary.nodeId),
    );
    const nodeReviews = reviewsByNodeId.get(summary.nodeId) ?? [];
    const due = nodeReviews.filter((review) => review.dueAt <= now).length;
    const nextReview =
      nodeReviews.length > 0
        ? Math.min(...nodeReviews.map((review) => review.dueAt))
        : undefined;
    const mastery =
      nodeReviews.length > 0
        ? nodeReviews.reduce(
            (sum, review) => sum + reviewMasteryValue(review),
            0,
          ) / nodeReviews.length
        : LEARN_STATE_WEIGHTS[masteryState];

    return {
      id: summary.nodeId,
      label: summary.node.name,
      // Coming-soon nodes stay visible but must never become today's session.
      playable: summary.playable,
      mastery,
      due,
      state: reviewPlanState(masteryState, nodeReviews),
      ...(nextReview !== undefined ? { nextReview } : {}),
    };
  });

  return {
    summaries,
    plan: {
      subject,
      generatedAt: now,
      progressPct: subjectProgress(
        summaries.map((summary) => summary.node),
        masteryByNodeId,
      ),
      nodes,
    },
  };
}

export const getLearnReviewPlan = query({
  // No subject → the server resolves the default; the response declares which
  // subject it resolved so callers never need a hardcoded fallback.
  args: { subject: v.optional(v.string()) },
  handler: async (ctx, { subject }) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const resolved = resolveLearnSubject(subject);
    const { plan } = await buildSubjectReviewPlan(ctx, userId, resolved, now);
    return plan;
  },
});

export const getLearnSubjects = query({
  // Every subject the Learn pillar can serve, with per-user progress — the
  // subject switcher and home pillar read this instead of assuming a subject.
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const subjects = await Promise.all(
      learnSubjects.map(async (meta) => {
        const { summaries, plan } = await buildSubjectReviewPlan(
          ctx,
          userId,
          meta.id,
          now,
        );
        const playableNodes = summaries.filter(
          (summary) => summary.playable,
        ).length;
        return {
          subject: meta.id,
          name: meta.name,
          description: meta.description,
          totalNodes: summaries.length,
          playableNodes,
          servable: playableNodes > 0,
          progressPct: plan.progressPct,
          dueCount: plan.nodes.reduce((sum, node) => sum + node.due, 0),
          learningCount: plan.nodes.filter((node) => node.state === "learning")
            .length,
          lockedCount: plan.nodes.filter((node) => node.state === "locked")
            .length,
        };
      }),
    );

    return {
      generatedAt: now,
      defaultSubject: DEFAULT_LEARN_SUBJECT,
      subjects,
    };
  },
});

export const getSubjectProgress = query({
  args: { subject: v.string() },
  handler: async (ctx, { subject }) => {
    const userId = await requireUserId(ctx);
    const nodes = skillNodes.filter(
      (node) => node.subject === subject && !isPipelineProofNode(node),
    );
    const rows = await ctx.db
      .query("learnMastery")
      .withIndex("by_user_subject", (q) =>
        q.eq("userId", userId).eq("subject", subject),
      )
      .collect();
    const masteryByNodeId = latestMasteryByNode(rows);

    return {
      subject,
      progressPct: subjectProgress(nodes, masteryByNodeId),
      nodes: nodes.map((node) => {
        const mastery = masteryByNodeId.get(node.id);
        return {
          nodeId: node.id,
          state: stateFromMastery(mastery),
          reviewDue: isLearnReviewDue(snapshotFromMastery(mastery), Date.now()),
        };
      }),
    };
  },
});
