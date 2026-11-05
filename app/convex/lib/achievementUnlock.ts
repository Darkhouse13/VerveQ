import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { hasPerfectQuiz, isPerfectQuiz } from "./achievementRules";
import type { Doc } from "../_generated/dataModel";

/**
 * Unlock every achievement the player now qualifies for. Shared by
 * achievements.checkAndUnlock (web) and the ranked completion mutations
 * (games.completeQuiz / completeSurvival), so a finished game reports its
 * unlocks in the same round trip.
 */
export async function unlockAchievements(
  ctx: MutationCtx,
  userId: Id<"users">,
  /** The ranked game that just finished, if any: Quiz Master is judged on it
   *  directly instead of rescanning the player's history. */
  justFinished?: Pick<Doc<"gameSessions">, "mode" | "totalQuestions" | "correctAnswers" | "accuracy">,
) {
    const existing = await ctx.db
      .query("userAchievements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const unlockedSet = new Set(existing.map((e) => e.achievementId));

    // Get user stats
    const ratings = await ctx.db
      .query("userRatings")
      .withIndex("by_user_sport_mode", (q) => q.eq("userId", userId))
      .collect();

    const totalGames = ratings.reduce((s, r) => s + r.gamesPlayed, 0);
    const quizGames = ratings
      .filter((r) => r.mode === "quiz")
      .reduce((s, r) => s + r.gamesPlayed, 0);
    const survivalGames = ratings
      .filter((r) => r.mode === "survival")
      .reduce((s, r) => s + r.gamesPlayed, 0);
    const maxSurvivalScore = ratings
      .filter((r) => r.mode === "survival")
      .reduce((m, r) => Math.max(m, r.bestScore), 0);
    const maxElo = ratings.reduce((m, r) => Math.max(m, r.eloRating), 0);
    const sportsPlayed = new Set(ratings.map((r) => r.sport)).size;

    const user = await ctx.db.get(userId);
    const approvedQuestions = user?.approvedQuestionsCount ?? 0;

    // Quiz Master was defined but never checked (docs/OPEN_BUGS.md #1).
    // gameSessions keeps every finished ranked game, so earlier perfect
    // quizzes unlock it too. Skip the read once it's unlocked.
    // The history scan runs at most once per player (the backfill for games
    // played before the fix); after that only the game just finished counts.
    let perfectQuiz = false;
    if (!unlockedSet.has("quiz_master")) {
      if (justFinished && isPerfectQuiz(justFinished)) {
        perfectQuiz = true;
      } else if (!user?.quizMasterBackfilled) {
        perfectQuiz = hasPerfectQuiz(
          await ctx.db
            .query("gameSessions")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect(),
        );
        if (user) await ctx.db.patch(userId, { quizMasterBackfilled: true });
      }
    }

    const checks: [string, boolean][] = [
      ["first_quiz", quizGames >= 1],
      ["first_survival", survivalGames >= 1],
      ["quiz_master", perfectQuiz],
      ["survival_legend", maxSurvivalScore >= 15],
      ["multi_sport_athlete", sportsPlayed >= 2],
      ["dedicated_player", totalGames >= 50],
      ["elo_champion", maxElo >= 1500],
      ["the_architect", approvedQuestions >= 1],
    ];

    const newlyUnlocked: string[] = [];
    for (const [achId, met] of checks) {
      if (met && !unlockedSet.has(achId)) {
        await ctx.db.insert("userAchievements", {
          userId,
          achievementId: achId,
          unlockedAt: Date.now(),
        });
        newlyUnlocked.push(achId);
      }
    }

    return {
      newlyUnlocked,
      totalUnlocked: existing.length + newlyUnlocked.length,
    };
}
