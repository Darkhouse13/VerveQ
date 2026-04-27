import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// ── Helpers ──

function generateChecksum(question: string, options: string[]): string {
  const normalized = [question, ...options.slice().sort()]
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) + hash + normalized.charCodeAt(i);
    hash = hash & hash;
  }
  return `forge_${Math.abs(hash).toString(36)}`;
}

async function assertForgeAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const ratings = await ctx.db
    .query("userRatings")
    .withIndex("by_user_sport_mode", (q) => q.eq("userId", userId))
    .collect();
  const maxElo = ratings.reduce((m, r) => Math.max(m, r.eloRating), 0);
  if (maxElo < 1500) {
    throw new Error("Gold tier (1500+ ELO) required to access The Forge");
  }
  return maxElo;
}

// ── Queries ──

export const canAccess = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId)
      return { allowed: false, reason: "Not authenticated", currentElo: 0 };

    const ratings = await ctx.db
      .query("userRatings")
      .withIndex("by_user_sport_mode", (q) => q.eq("userId", userId))
      .collect();
    const maxElo = ratings.reduce((m, r) => Math.max(m, r.eloRating), 0);

    if (maxElo < 1500)
      return { allowed: false, reason: "Gold tier required", currentElo: maxElo };

    return { allowed: true, reason: null, currentElo: maxElo };
  },
});

export const getReviewQueue = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    await assertForgeAccess(ctx, userId);

    const pending = await ctx.db
      .query("questionSubmissions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(limit ?? 20);

    // Filter out user's own submissions
    const filtered = pending.filter((s) => s.authorId !== userId);

    return Promise.all(
      filtered.map(async (s) => {
        const existingVote = await ctx.db
          .query("submissionVotes")
          .withIndex("by_submission_voter", (q) =>
            q.eq("submissionId", s._id).eq("voterId", userId),
          )
          .first();

        let imageUrl: string | null = null;
        if (s.imageId) {
          imageUrl = await ctx.storage.getUrl(s.imageId);
        }

        const author = await ctx.db.get(s.authorId);

        return {
          ...s,
          imageUrl,
          authorUsername: author?.username ?? "Unknown",
          userVote: existingVote?.vote ?? null,
        };
      }),
    );
  },
});

export const getMySubmissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const submissions = await ctx.db
      .query("questionSubmissions")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .order("desc")
      .take(50);

    return Promise.all(
      submissions.map(async (s) => {
        let imageUrl: string | null = null;
        if (s.imageId) {
          imageUrl = await ctx.storage.getUrl(s.imageId);
        }
        return { ...s, imageUrl };
      }),
    );
  },
});

// ── Mutations ──

export const submit = mutation({
  args: {
    sport: v.string(),
    category: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    correctAnswer: v.string(),
    explanation: v.optional(v.string()),
    difficulty: v.union(
      v.literal("easy"),
      v.literal("intermediate"),
      v.literal("hard"),
    ),
    imageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertForgeAccess(ctx, userId);

    if (args.options.length !== 4) {
      throw new Error("Exactly 4 options required");
    }
    if (!args.options.includes(args.correctAnswer)) {
      throw new Error("Correct answer must be one of the options");
    }

    const checksum = generateChecksum(args.question, args.options);

    // Check against existing quiz pool
    const existingQuestion = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
      .first();
    if (existingQuestion) {
      throw new Error("Duplicate question detected");
    }

    // Check against pending/approved submissions
    const existingSubmission = await ctx.db
      .query("questionSubmissions")
      .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
      .first();
    if (existingSubmission) {
      throw new Error("Duplicate question detected");
    }

    const submissionId = await ctx.db.insert("questionSubmissions", {
      authorId: userId,
      sport: args.sport,
      category: args.category,
      question: args.question,
      options: args.options,
      correctAnswer: args.correctAnswer,
      explanation: args.explanation,
      difficulty: args.difficulty,
      checksum,
      imageId: args.imageId,
      status: "pending",
      approveCount: 0,
      rejectCount: 0,
      netVotes: 0,
      createdAt: Date.now(),
    });

    return { submissionId, checksum };
  },
});

export const vote = mutation({
  args: {
    submissionId: v.id("questionSubmissions"),
    vote: v.union(v.literal("approve"), v.literal("reject")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertForgeAccess(ctx, userId);

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found");
    if (submission.status !== "pending")
      throw new Error("Submission already resolved");
    if (submission.authorId === userId)
      throw new Error("Cannot vote on own submission");

    const existingVote = await ctx.db
      .query("submissionVotes")
      .withIndex("by_submission_voter", (q) =>
        q.eq("submissionId", args.submissionId).eq("voterId", userId),
      )
      .first();
    if (existingVote) throw new Error("Already voted on this submission");

    await ctx.db.insert("submissionVotes", {
      submissionId: args.submissionId,
      voterId: userId,
      vote: args.vote,
      createdAt: Date.now(),
    });

    const newApprove =
      submission.approveCount + (args.vote === "approve" ? 1 : 0);
    const newReject =
      submission.rejectCount + (args.vote === "reject" ? 1 : 0);
    const newNet = newApprove - newReject;

    await ctx.db.patch(args.submissionId, {
      approveCount: newApprove,
      rejectCount: newReject,
      netVotes: newNet,
    });

    // State machine: check thresholds
    if (newNet >= 5) {
      await ctx.db.patch(args.submissionId, {
        status: "approved",
        resolvedAt: Date.now(),
      });

      // Auto-insert into quiz pool
      await ctx.db.insert("quizQuestions", {
        sport: submission.sport,
        category: submission.category,
        question: submission.question,
        options: submission.options,
        correctAnswer: submission.correctAnswer,
        explanation: submission.explanation,
        difficulty: submission.difficulty,
        bucket: `forge_${submission.sport}`,
        checksum: submission.checksum,
        imageId: submission.imageId,
        difficultyVotes: 0,
        difficultyScore: 0,
        timesAnswered: 0,
        timesCorrect: 0,
        usageCount: 0,
      });

      // Reward the author
      const author = await ctx.db.get(submission.authorId);
      if (author) {
        const newCount = (author.approvedQuestionsCount ?? 0) + 1;
        await ctx.db.patch(submission.authorId, {
          approvedQuestionsCount: newCount,
        });

        // Award "The Architect" on first approval
        if (newCount === 1) {
          const existingAch = await ctx.db
            .query("userAchievements")
            .withIndex("by_user_achievement", (q) =>
              q
                .eq("userId", submission.authorId)
                .eq("achievementId", "the_architect"),
            )
            .first();
          if (!existingAch) {
            await ctx.db.insert("userAchievements", {
              userId: submission.authorId,
              achievementId: "the_architect",
              unlockedAt: Date.now(),
            });
          }
        }
      }

      return { newStatus: "approved" as const };
    }

    if (newNet <= -3) {
      await ctx.db.patch(args.submissionId, {
        status: "rejected",
        resolvedAt: Date.now(),
      });
      return { newStatus: "rejected" as const };
    }

    return { newStatus: "pending" as const };
  },
});
