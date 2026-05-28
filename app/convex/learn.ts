import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  buildLadder,
  getLearnNodeSummary,
  listGeographyNodeSummaries,
  type BuiltLadderQuestion,
} from "./learnLadderBuilder";
import {
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
  type LearnCompletionStats,
  type LearnMasterySnapshot,
  type LearnMasteryState,
} from "./learnMasteryLogic";

const LEARN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type LearnRungResult = Doc<"learnSessions">["rungResults"][number];

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
  if (subject === "geography") return listGeographyNodeSummaries();
  return skillNodes
    .filter((node) => node.subject === subject)
    .map((node) => getLearnNodeSummary(node.id));
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
  return {
    rungId: rung.checksum,
    stem: rung.question,
    options: rung.options,
  };
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
      rungs: ladder.questions.map(sanitizeRung),
    };
  },
});

export const submitLearnRung = mutation({
  args: {
    sessionId: v.id("learnSessions"),
    rungId: v.string(),
    chosenOption: v.string(),
  },
  handler: async (ctx, { sessionId, rungId, chosenOption }) => {
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
    if (!session.rungIds.includes(rungId)) {
      throw new Error("Rung not active for this session");
    }

    const rung = findCommittedRung(session.nodeId, rungId);
    if (!rung.options.includes(chosenOption)) {
      throw new Error("Chosen option is not valid for this rung");
    }

    const correct = chosenOption === rung.correctAnswer;
    const reveal = correct
      ? rung.correctReveal
      : rung.distractors.find((distractor) => distractor.text === chosenOption)
          ?.reveal;
    if (!reveal) {
      throw new Error("Reveal not found for chosen option");
    }

    const firstTry = !session.rungResults.some(
      (result) => result.rungId === rungId,
    );
    await ctx.db.patch(sessionId, {
      rungResults: [
        ...session.rungResults,
        {
          rungId,
          chosenOption,
          correct,
          firstTry,
          answeredAt: now,
        },
      ],
      updatedAt: now,
    });

    return {
      correct,
      correctAnswer: rung.correctAnswer,
      reveal,
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

export const getSubjectProgress = query({
  args: { subject: v.string() },
  handler: async (ctx, { subject }) => {
    const userId = await requireUserId(ctx);
    const nodes = skillNodes.filter((node) => node.subject === subject);
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
