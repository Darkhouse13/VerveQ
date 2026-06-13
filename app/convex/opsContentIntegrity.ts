import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// One-off content-integrity ops over quizQuestions, all keyed by checksum.
// Mutations fail closed: they throw on any mismatch between the live rows and
// the caller's stated expectations, and write nothing unless `apply` is true.

export const inspectRowsByChecksums = internalQuery({
  args: { checksums: v.array(v.string()) },
  handler: async (ctx, { checksums }) => {
    const rows = [];
    for (const checksum of checksums) {
      const matches = await ctx.db
        .query("quizQuestions")
        .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
        .collect();
      rows.push({ checksum, matchCount: matches.length, matches });
    }
    return rows;
  },
});

export const countQuizQuestions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("quizQuestions").collect();
    const bySport: Record<string, number> = {};
    for (const row of all) {
      bySport[row.sport] = (bySport[row.sport] ?? 0) + 1;
    }
    return { total: all.length, bySport };
  },
});

export const exportPoolByChecksumPrefixes = internalQuery({
  args: { prefixes: v.array(v.string()) },
  handler: async (ctx, { prefixes }) => {
    const all = await ctx.db.query("quizQuestions").collect();
    return all
      .filter((row) => prefixes.some((p) => row.checksum.startsWith(p)))
      .map((row) => ({
        sport: row.sport,
        category: row.category,
        question: row.question,
        options: row.options,
        correctAnswer: row.correctAnswer,
        explanation: row.explanation,
        questionKind: row.questionKind,
        difficulty: row.difficulty,
        bucket: row.bucket,
        checksum: row.checksum,
        imageId: row.imageId,
        imageUrl: row.imageUrl,
      }));
  },
});

export const deleteRowsByChecksums = internalMutation({
  args: {
    checksums: v.array(v.string()),
    expectedSport: v.string(),
    expectedCount: v.number(),
    apply: v.boolean(),
  },
  handler: async (ctx, { checksums, expectedSport, expectedCount, apply }) => {
    const targets = [];
    for (const checksum of checksums) {
      const matches = await ctx.db
        .query("quizQuestions")
        .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
        .collect();
      if (matches.length !== 1) {
        throw new Error(
          `Refusing: checksum ${checksum} matched ${matches.length} rows (expected exactly 1)`,
        );
      }
      const row = matches[0];
      if (row.sport !== expectedSport) {
        throw new Error(
          `Refusing: checksum ${checksum} has sport ${row.sport} (expected ${expectedSport})`,
        );
      }
      targets.push(row);
    }
    if (targets.length !== expectedCount) {
      throw new Error(
        `Refusing: resolved ${targets.length} rows (expected ${expectedCount})`,
      );
    }
    if (apply) {
      for (const row of targets) {
        await ctx.db.delete(row._id);
      }
    }
    return {
      applied: apply,
      count: targets.length,
      rows: targets,
    };
  },
});

export const updateQuestionStemByChecksum = internalMutation({
  args: {
    checksum: v.string(),
    expectedQuestion: v.string(),
    newQuestion: v.string(),
    apply: v.boolean(),
  },
  handler: async (ctx, { checksum, expectedQuestion, newQuestion, apply }) => {
    const matches = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
      .collect();
    if (matches.length !== 1) {
      throw new Error(
        `Refusing: checksum ${checksum} matched ${matches.length} rows (expected exactly 1)`,
      );
    }
    const row = matches[0];
    if (row.question === newQuestion) {
      return { applied: false, alreadyApplied: true, question: row.question };
    }
    if (row.question !== expectedQuestion) {
      throw new Error(
        `Refusing: live stem for ${checksum} does not match expectedQuestion. Live: ${row.question}`,
      );
    }
    if (apply) {
      await ctx.db.patch(row._id, { question: newQuestion });
    }
    return {
      applied: apply,
      alreadyApplied: false,
      before: expectedQuestion,
      after: newQuestion,
      sport: row.sport,
      id: row._id,
    };
  },
});
