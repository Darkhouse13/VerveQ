import { mutation } from "./_generated/server";

const DEFAULT_ACHIEVEMENTS = [
  { achievementId: "first_quiz", name: "Quiz Rookie", description: "Complete your first quiz", category: "quiz", icon: "🎯", points: 10, requirementType: "quiz_games", requirementValue: 1, isHidden: false },
  { achievementId: "first_survival", name: "Survivor", description: "Complete your first survival game", category: "survival", icon: "❤️", points: 10, requirementType: "survival_games", requirementValue: 1, isHidden: false },
  { achievementId: "quiz_master", name: "Quiz Master", description: "Get 100% accuracy in a quiz", category: "quiz", icon: "🏆", points: 50, requirementType: "max_quiz_accuracy", requirementValue: 100, isHidden: false },
  { achievementId: "survival_legend", name: "Survival Legend", description: "Score 15+ in survival mode", category: "survival", icon: "🔥", points: 50, requirementType: "max_survival_score", requirementValue: 15, isHidden: false },
  { achievementId: "multi_sport_athlete", name: "Multi-Sport Athlete", description: "Play 2+ different sports", category: "general", icon: "⚡", points: 25, requirementType: "sports_played", requirementValue: 2, isHidden: false },
  { achievementId: "dedicated_player", name: "Dedicated Player", description: "Play 50 total games", category: "general", icon: "💪", points: 30, requirementType: "total_games", requirementValue: 50, isHidden: false },
  { achievementId: "elo_champion", name: "ELO Champion", description: "Reach 1500 ELO rating", category: "general", icon: "👑", points: 100, requirementType: "max_elo", requirementValue: 1500, isHidden: false },
];

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    let count = 0;
    for (const ach of DEFAULT_ACHIEVEMENTS) {
      const existing = await ctx.db
        .query("achievements")
        .withIndex("by_achievement_id", (q) =>
          q.eq("achievementId", ach.achievementId),
        )
        .first();

      if (!existing) {
        await ctx.db.insert("achievements", {
          achievementId: ach.achievementId,
          name: ach.name,
          description: ach.description,
          category: ach.category,
          icon: ach.icon,
          points: ach.points,
          requirements: {
            type: ach.requirementType,
            value: ach.requirementValue,
          },
          requirementType: ach.requirementType,
          requirementValue: ach.requirementValue,
          isHidden: ach.isHidden,
        });
        count++;
      }
    }

    return { seeded: count };
  },
});
