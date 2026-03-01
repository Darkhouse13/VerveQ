import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    // Set by ensureProfile after auth; optional because Convex Auth
    // creates the doc first with only { isAnonymous: true }.
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    isGuest: v.optional(v.boolean()),
    isAnonymous: v.optional(v.boolean()),
    totalGames: v.optional(v.number()),
    // Convex Auth fields
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
  }).index("by_username", ["username"]),

  userRatings: defineTable({
    userId: v.id("users"),
    sport: v.string(),
    mode: v.string(),
    eloRating: v.number(),
    peakRating: v.number(),
    gamesPlayed: v.number(),
    wins: v.number(),
    losses: v.number(),
    bestScore: v.number(),
    averageScore: v.number(),
    lastPlayed: v.number(),
  })
    .index("by_user_sport_mode", ["userId", "sport", "mode"])
    .index("by_sport_mode_elo", ["sport", "mode", "eloRating"]),

  gameSessions: defineTable({
    userId: v.id("users"),
    sport: v.string(),
    mode: v.string(),
    score: v.optional(v.number()),
    totalQuestions: v.optional(v.number()),
    correctAnswers: v.optional(v.number()),
    accuracy: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    avgAnswerTimeSecs: v.optional(v.number()),
    details: v.optional(v.any()),
    eloBefore: v.number(),
    eloAfter: v.number(),
    eloChange: v.number(),
    endedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  achievements: defineTable({
    achievementId: v.string(),
    name: v.string(),
    description: v.string(),
    category: v.string(),
    icon: v.optional(v.string()),
    points: v.number(),
    requirements: v.optional(v.any()),
    requirementType: v.optional(v.string()),
    requirementValue: v.optional(v.number()),
    isHidden: v.boolean(),
  }).index("by_achievement_id", ["achievementId"]),

  userAchievements: defineTable({
    userId: v.id("users"),
    achievementId: v.string(),
    unlockedAt: v.number(),
    progress: v.optional(v.any()),
  })
    .index("by_user", ["userId"])
    .index("by_user_achievement", ["userId", "achievementId"]),

  challenges: defineTable({
    challengerId: v.id("users"),
    challengedId: v.id("users"),
    sport: v.string(),
    mode: v.string(),
    challengerScore: v.optional(v.number()),
    challengedScore: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("declined"),
    ),
    winnerId: v.optional(v.id("users")),
    completedAt: v.optional(v.number()),
  })
    .index("by_challenged_status", ["challengedId", "status"])
    .index("by_challenger", ["challengerId"]),

  quizQuestions: defineTable({
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
    bucket: v.string(),
    checksum: v.string(),
    difficultyVotes: v.number(),
    difficultyScore: v.number(),
    timesAnswered: v.number(),
    timesCorrect: v.number(),
    usageCount: v.number(),
  })
    .index("by_sport_difficulty", ["sport", "difficulty"])
    .index("by_checksum", ["checksum"]),

  quizSessions: defineTable({
    userId: v.optional(v.id("users")),
    sport: v.string(),
    difficulty: v.optional(v.string()),
    usedChecksums: v.array(v.string()),
    expiresAt: v.number(),
  }),

  survivalSessions: defineTable({
    userId: v.optional(v.id("users")),
    sport: v.string(),
    round: v.number(),
    score: v.number(),
    lives: v.number(),
    hintUsed: v.boolean(),
    usedInitials: v.array(v.string()),
    gameOver: v.boolean(),
    expiresAt: v.number(),
    currentChallenge: v.optional(
      v.object({
        initials: v.string(),
        round: v.number(),
        difficulty: v.string(),
        validPlayers: v.array(v.string()),
      }),
    ),
  }),
});
