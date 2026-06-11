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
    anonymousOnboardingIpPermitId: v.optional(v.id("anonymousOnboardingIpPermits")),
    totalGames: v.optional(v.number()),
    approvedQuestionsCount: v.optional(v.number()),
    // Updated (debounced) by funnel.sessionHeartbeat on app load; used for
    // retention metrics like D7-of-defeated-players.
    lastSeenAt: v.optional(v.number()),
    // Convex Auth fields
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
  }).index("by_username", ["username"]),

  // ── Drop-Test funnel instrumentation (insert-only, no PII) ──
  // actor is "user:<userId>", "guest:<hashedGuestToken>" (never a raw token),
  // or "anon" for pre-identity link taps. refChallengerId is the upstream
  // challenger the event is attributed to: the duel's challenger for
  // link_tap / first_match_complete / defeated_player_return, and the actor's
  // own recruiter for challenge_issued — which is what lets a query rebuild
  // the captain → gen1 → gen2 chain.
  funnelEvents: defineTable({
    type: v.union(
      v.literal("link_tap"),
      v.literal("challenge_issued"),
      v.literal("first_match_complete"),
      v.literal("defeated_player_return"),
    ),
    actor: v.string(),
    refLinkCode: v.optional(v.string()),
    refChallengerId: v.optional(v.id("users")),
    ts: v.number(),
    meta: v.optional(v.any()),
  })
    .index("by_type_ts", ["type", "ts"])
    .index("by_actor_type", ["actor", "type"])
    .index("by_refChallenger_type", ["refChallengerId", "type"]),

  // "Was defeated" markers written at duel resolution. The
  // defeated_player_return event fires on that user's next session start.
  // Account-backed actors only — guests who bounce leave no durable identity
  // to observe returning (a known limit of the loser-retention measurement).
  funnelDefeatMarks: defineTable({
    userId: v.id("users"),
    duelId: v.id("duels"),
    defeatedAt: v.number(),
    returnFiredAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // Rendered OG share-card PNG cache. variant is a one-way hash of the
  // challenger's score state, so a score change busts WhatsApp's per-URL
  // cache without the score ever appearing in a URL.
  duelShareCards: defineTable({
    linkCode: v.string(),
    variant: v.string(),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  }).index("by_link_variant", ["linkCode", "variant"]),

  anonymousOnboardingIpPermits: defineTable({
    ipKey: v.string(),
    permitToken: v.string(),
    issuedAt: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
  })
    .index("by_ip_time", ["ipKey", "issuedAt"])
    .index("by_permit_token", ["permitToken"]),

  usernameClaims: defineTable({
    key: v.string(),
    username: v.string(),
    userId: v.id("users"),
    claimedAt: v.number(),
    releasedAt: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_user", ["userId"]),

  anonymousOnboardingAttempts: defineTable({
    userId: v.id("users"),
    deviceNonce: v.optional(v.string()),
    inviteCode: v.optional(v.string()),
    kind: v.union(v.literal("username_claim")),
    attemptedAt: v.number(),
  })
    .index("by_user_time", ["userId", "attemptedAt"])
    .index("by_device_time", ["deviceNonce", "attemptedAt"])
    .index("by_invite_time", ["inviteCode", "attemptedAt"]),

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
    lastDecayAt: v.optional(v.number()),
    decayWarningShown: v.optional(v.boolean()),
    seasonResetAppliedFor: v.optional(v.number()),
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
    sessionType: v.optional(v.string()),
    kFactor: v.optional(v.number()),
    kFactorLabel: v.optional(v.string()),
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
    .index("by_challenger", ["challengerId"])
    .index("by_challenged", ["challengedId"]),

  challengeHeadToHeads: defineTable({
    pairKey: v.string(),
    playerAId: v.id("users"),
    playerBId: v.id("users"),
    sport: v.string(),
    mode: v.string(),
    playerAWins: v.number(),
    playerBWins: v.number(),
    draws: v.number(),
    totalMatches: v.number(),
    lastMatchId: v.optional(v.id("liveMatches")),
    lastPlayedAt: v.optional(v.number()),
  })
    .index("by_pair_sport_mode", ["pairKey", "sport", "mode"])
    .index("by_player_a", ["playerAId"])
    .index("by_player_b", ["playerBId"]),

  challengeMatchHistory: defineTable({
    matchId: v.id("liveMatches"),
    challengeId: v.optional(v.id("challenges")),
    pairKey: v.string(),
    playerAId: v.id("users"),
    playerBId: v.id("users"),
    player1Id: v.id("users"),
    player2Id: v.id("users"),
    sport: v.string(),
    mode: v.string(),
    player1Score: v.number(),
    player2Score: v.number(),
    winnerId: v.optional(v.id("users")),
    status: v.union(v.literal("completed"), v.literal("forfeited")),
    playedAt: v.number(),
  })
    .index("by_match", ["matchId"])
    .index("by_pair_sport_mode", ["pairKey", "sport", "mode"])
    .index("by_player_a", ["playerAId"])
    .index("by_player_b", ["playerBId"]),

  duels: defineTable({
    challengerId: v.id("users"),
    opponentId: v.optional(v.id("users")),
    opponentGuestTokenHash: v.optional(v.string()),
    opponentUsernameSnapshot: v.optional(v.string()),
    type: v.union(v.literal("sports"), v.literal("knowledge")),
    category: v.optional(v.string()),
    sport: v.optional(v.string()),
    difficulty: v.union(
      v.literal("easy"),
      v.literal("intermediate"),
      v.literal("hard"),
    ),
    mode: v.string(),
    seed: v.string(),
    questionChecksums: v.array(v.string()),
    challengerServedAt: v.optional(v.array(v.number())),
    opponentServedAt: v.optional(v.array(v.number())),
    challengerResult: v.optional(
      v.object({
        score: v.number(),
        perQuestion: v.array(
          v.object({
            questionIndex: v.number(),
            checksum: v.string(),
            answer: v.string(),
            correct: v.boolean(),
            score: v.number(),
            timeTaken: v.number(),
            servedAt: v.number(),
            answeredAt: v.number(),
          }),
        ),
        completedAt: v.optional(v.number()),
      }),
    ),
    opponentResult: v.optional(
      v.object({
        score: v.number(),
        perQuestion: v.array(
          v.object({
            questionIndex: v.number(),
            checksum: v.string(),
            answer: v.string(),
            correct: v.boolean(),
            score: v.number(),
            timeTaken: v.number(),
            servedAt: v.number(),
            answeredAt: v.number(),
          }),
        ),
        completedAt: v.optional(v.number()),
      }),
    ),
    status: v.union(
      v.literal("awaiting_opponent"),
      v.literal("resolved"),
      v.literal("expired"),
      v.literal("declined"),
    ),
    winnerId: v.optional(v.id("users")),
    linkCode: v.optional(v.string()),
    rematchOfDuelId: v.optional(v.id("duels")),
    createdAt: v.number(),
    expiresAt: v.number(),
    resolvedAt: v.optional(v.number()),
    rivalryAppliedAt: v.optional(v.number()),
    lastNearExpiryNotifiedAt: v.optional(v.number()),
  })
    .index("by_opponent_status", ["opponentId", "status"])
    .index("by_challenger", ["challengerId"])
    .index("by_linkCode", ["linkCode"])
    .index("by_status_expires", ["status", "expiresAt"]),

  rivalries: defineTable({
    pairKey: v.string(),
    userAId: v.id("users"),
    userBId: v.id("users"),
    aWins: v.number(),
    bWins: v.number(),
    draws: v.number(),
    currentStreakHolderId: v.optional(v.id("users")),
    currentStreakLen: v.number(),
    lastDuelId: v.optional(v.id("duels")),
    updatedAt: v.number(),
  })
    .index("by_pair", ["pairKey"])
    .index("by_userA", ["userAId"])
    .index("by_userB", ["userBId"]),

  challengeNotifications: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("duel_resolved"),
      v.literal("opponent_beat_score"),
      v.literal("duel_near_expiry"),
    ),
    duelId: v.optional(v.id("duels")),
    title: v.string(),
    body: v.string(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
    emailStatus: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("sent"),
        v.literal("skipped"),
        v.literal("failed"),
      ),
    ),
    emailError: v.optional(v.string()),
  })
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_read", ["userId", "readAt"]),

  quizQuestions: defineTable({
    sport: v.string(),
    category: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    correctAnswer: v.string(),
    acceptedAliases: v.optional(v.array(v.string())),
    explanation: v.optional(v.string()),
    questionKind: v.optional(
      v.union(
        v.literal("mcq"),
        v.literal("which_came_first"),
        v.literal("logo_text"),
      ),
    ),
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
    imageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
  })
    .index("by_sport_difficulty", ["sport", "difficulty"])
    .index("by_sport_checksum", ["sport", "checksum"])
    .index("by_sport_category_checksum", ["sport", "category", "checksum"])
    .index("by_sport_imageId_imageUrl_checksum", [
      "sport",
      "imageId",
      "imageUrl",
      "checksum",
    ])
    .index("by_checksum", ["checksum"]),

  quizSessions: defineTable({
    userId: v.optional(v.id("users")),
    sport: v.string(),
    mode: v.optional(v.string()),
    difficulty: v.optional(
      v.union(v.literal("easy"), v.literal("intermediate"), v.literal("hard")),
    ),
    usedChecksums: v.array(v.string()),
    expiresAt: v.number(),
    // Server-authoritative scoring state. Populated from createSession
    // onward; remain optional so pre-existing rows stay schema-valid.
    score: v.optional(v.number()),
    correctCount: v.optional(v.number()),
    totalAnswers: v.optional(v.number()),
    sumAnswerTimeMs: v.optional(v.number()),
    currentChecksum: v.optional(v.string()),
    questionStartedAt: v.optional(v.number()),
    completed: v.optional(v.boolean()),
    abandonedAt: v.optional(v.number()),
  }).index("by_expiresAt", ["expiresAt"]),

  learnMastery: defineTable({
    userId: v.id("users"),
    nodeId: v.string(),
    subject: v.string(),
    state: v.union(
      v.literal("untouched"),
      v.literal("learning"),
      v.literal("proficient"),
      v.literal("mastered"),
    ),
    startedAt: v.optional(v.number()),
    proficientAt: v.optional(v.number()),
    reviewDueAt: v.optional(v.number()),
    masteredAt: v.optional(v.number()),
    lastCompletedAt: v.optional(v.number()),
    lastFirstTryCorrect: v.optional(v.number()),
    lastTotal: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user_node", ["userId", "nodeId"])
    .index("by_user_subject", ["userId", "subject"]),

  learnSessions: defineTable({
    userId: v.id("users"),
    nodeId: v.string(),
    subject: v.string(),
    rungIds: v.array(v.string()),
    rungResults: v.array(
      v.object({
        rungId: v.string(),
        // Legacy MCQ rows used chosenOption. New Learn graders store the
        // sanitized submission value here so text/numeric/order can share
        // the existing server-graded session path.
        chosenOption: v.optional(v.string()),
        answer: v.optional(v.any()),
        branchId: v.optional(v.string()),
        correct: v.boolean(),
        firstTry: v.boolean(),
        answeredAt: v.number(),
      }),
    ),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_node", ["userId", "nodeId"])
    .index("by_expiresAt", ["expiresAt"]),

  learnRungReviews: defineTable({
    userId: v.id("users"),
    nodeId: v.string(),
    subject: v.string(),
    rungId: v.string(),
    reviewState: v.union(v.literal("learning"), v.literal("locked_in")),
    dueAt: v.number(),
    intervalMs: v.number(),
    easeFactor: v.number(),
    repetitions: v.number(),
    lapses: v.number(),
    lastRating: v.optional(
      v.union(
        v.literal("again"),
        v.literal("hard"),
        v.literal("good"),
        v.literal("easy"),
      ),
    ),
    lastFelt: v.optional(v.union(v.literal("learn"), v.literal("test"))),
    lastCorrect: v.optional(v.boolean()),
    lastAnsweredAt: v.optional(v.number()),
    lastRatedAt: v.optional(v.number()),
    lastFeltAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_rung", ["userId", "rungId"])
    .index("by_user_subject", ["userId", "subject"])
    .index("by_user_node", ["userId", "nodeId"]),

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
    startedAt: v.optional(v.number()),
    freeSkipsLeft: v.optional(v.number()),
    currentChallenge: v.optional(
      v.object({
        initials: v.string(),
        round: v.number(),
        difficulty: v.string(),
        validPlayers: v.array(v.string()),
        maskedName: v.optional(v.string()),
        primaryPlayer: v.optional(v.string()),
      }),
    ),
    // Anti-cheat: track which round was last penalized
    lastPenalizedRound: v.optional(v.number()),
    // Speed-streak tracking
    speedStreak: v.optional(v.number()),
    lastAnswerAt: v.optional(v.number()),
    performanceBonus: v.optional(v.number()),
    closeCallRound: v.optional(v.number()),
    closeCallCount: v.optional(v.number()),
    // Tiered hint system
    hintTokensLeft: v.optional(v.number()),
    currentHintStage: v.optional(v.number()),
    // Server-side idempotency marker for completeSurvival — set once ELO
    // has been recorded so a replayed call doesn't double-update the rating.
    completedAt: v.optional(v.number()),
  }).index("by_expiresAt", ["expiresAt"]),

  // ── Daily Challenge ──
  dailyChallenges: defineTable({
    date: v.string(),
    sport: v.string(),
    mode: v.union(v.literal("quiz"), v.literal("survival")),
    questionChecksums: v.array(v.string()),
    questionSnapshots: v.optional(
      v.array(
        v.object({
          checksum: v.string(),
          question: v.string(),
          options: v.array(v.string()),
          correctAnswer: v.string(),
          explanation: v.optional(v.string()),
          category: v.string(),
          imageId: v.optional(v.id("_storage")),
        }),
      ),
    ),
    survivalInitials: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_date_sport_mode", ["date", "sport", "mode"]),

  dailyAttempts: defineTable({
    userId: v.id("users"),
    date: v.string(),
    sport: v.string(),
    mode: v.union(v.literal("quiz"), v.literal("survival")),
    score: v.number(),
    completed: v.boolean(),
    forfeited: v.boolean(),
    results: v.any(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    // Server clock for the next expected submitAnswer — used to derive
    // timeTaken without trusting the client. Reset on each submit.
    currentQuestionStartedAt: v.optional(v.number()),
    questionStartedAts: v.optional(v.array(v.number())),
  })
    .index("by_user_date_sport_mode", ["userId", "date", "sport", "mode"])
    .index("by_date_sport_mode_score", ["date", "sport", "mode", "score"])
    .index("by_expiresAt", ["expiresAt"]),

  // ── Multiplayer Challenge Arena (beta) ──
  multiplayerMatches: defineTable({
    hostId: v.id("users"),
    joinCode: v.string(),
    format: v.union(
      v.literal("1v1"),
      v.literal("2v2"),
      v.literal("1v1v1"),
      v.literal("1v1v1v1"),
      v.literal("1v1v1v1v1"),
    ),
    minPlayers: v.number(),
    maxPlayers: v.number(),
    teamSize: v.optional(v.number()),
    playerIds: v.array(v.id("users")),
    teamAssignments: v.optional(v.array(v.number())),
    readyUserIds: v.array(v.id("users")),
    roundBreakReadyUserIds: v.array(v.id("users")),
    status: v.union(
      v.literal("lobby"),
      v.literal("question"),
      v.literal("roundBreak"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    currentQuestion: v.number(),
    currentRoundIndex: v.number(),
    totalQuestions: v.number(),
    questions: v.any(),
    answersByUserId: v.any(),
    scoresByUserId: v.any(),
    questionStartedAt: v.optional(v.number()),
    roundBreakStartedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_joinCode", ["joinCode"])
    .index("by_host_status", ["hostId", "status"]),

  // ── Live Head-to-Head ──
  liveMatches: defineTable({
    player1Id: v.id("users"),
    player2Id: v.id("users"),
    sport: v.string(),
    mode: v.optional(v.string()),
    status: v.union(
      v.literal("waiting"),
      v.literal("countdown"),
      v.literal("question"),
      v.literal("roundResult"),
      v.literal("completed"),
      v.literal("forfeited"),
    ),
    currentQuestion: v.number(),
    totalQuestions: v.number(),
    questions: v.any(),
    player1Answers: v.any(),
    player2Answers: v.any(),
    player1Score: v.number(),
    player2Score: v.number(),
    player1Ready: v.boolean(),
    player2Ready: v.boolean(),
    player1LastSeen: v.number(),
    player2LastSeen: v.number(),
    winnerId: v.optional(v.id("users")),
    countdownStartedAt: v.optional(v.number()),
    questionStartedAt: v.optional(v.number()),
    roundResultUntil: v.optional(v.number()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    eloAppliedAt: v.optional(v.number()),
    historyRecordedAt: v.optional(v.number()),
    challengeId: v.optional(v.id("challenges")),
  })
    .index("by_player1", ["player1Id", "status"])
    .index("by_player2", ["player2Id", "status"]),

  // Challenge Arena
  arenas: defineTable({
    code: v.string(),
    hostId: v.id("users"),
    mode: v.union(
      v.literal("1v1"),
      v.literal("2v2"),
      v.literal("ffa3"),
      v.literal("ffa4"),
      v.literal("ffa5"),
    ),
    status: v.union(
      v.literal("lobby"),
      v.literal("countdown"),
      v.literal("active"),
      v.literal("round_break"),
      v.literal("final"),
      v.literal("abandoned"),
    ),
    players: v.array(
      v.object({
        userId: v.id("users"),
        nameSnapshot: v.string(),
        team: v.optional(v.union(v.literal("A"), v.literal("B"))),
        ready: v.boolean(),
        joinedAt: v.number(),
        lastSeenAt: v.number(),
        left: v.boolean(),
        totalScore: v.number(),
      }),
    ),
    config: v.object({
      rounds: v.number(),
      perRound: v.number(),
      categories: v.array(v.string()),
    }),
    currentRound: v.number(),
    currentQuestionIndex: v.number(),
    phase: v.union(
      v.literal("lobby"),
      v.literal("countdown"),
      v.literal("question"),
      v.literal("reveal"),
      v.literal("round_break"),
      v.literal("final"),
      v.literal("abandoned"),
    ),
    questionStartedAt: v.optional(v.number()),
    questionWindowMs: v.number(),
    roundChecksums: v.array(v.array(v.string())),
    rematchArenaId: v.optional(v.id("arenas")),
    rematchArenaCode: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  arenaAnswers: defineTable({
    arenaId: v.id("arenas"),
    round: v.number(),
    questionIndex: v.number(),
    userId: v.id("users"),
    answer: v.string(),
    serverTimeMs: v.number(),
    correct: v.boolean(),
    points: v.number(),
    // True when points were computed (and banked into totalScore) at submit
    // time. Absent on rows written before at-submit scoring existed; those
    // are settled by closeQuestionNow.
    scoredAtSubmit: v.optional(v.boolean()),
  }).index("by_arena_round_question", [
    "arenaId",
    "round",
    "questionIndex",
  ]),

  arenaRecentlySeenQuestions: defineTable({
    userId: v.id("users"),
    checksum: v.string(),
    seenAt: v.number(),
  })
    .index("by_user_seen_at", ["userId", "seenAt"])
    .index("by_user_checksum", ["userId", "checksum"])
    .index("by_seen_at", ["seenAt"]),

  // ── Blitz Mode ──
  blitzSessions: defineTable({
    userId: v.id("users"),
    sport: v.string(),
    score: v.number(),
    correctCount: v.number(),
    wrongCount: v.number(),
    usedChecksums: v.array(v.string()),
    currentChecksum: v.optional(v.string()),
    gameOver: v.boolean(),
    startedAt: v.number(),
    endTimeMs: v.number(),
    endedAt: v.optional(v.number()),
    scoreSavedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_endTimeMs", ["endTimeMs"]),

  blitzScores: defineTable({
    userId: v.id("users"),
    sport: v.string(),
    score: v.number(),
    correctCount: v.number(),
    wrongCount: v.number(),
    playedAt: v.number(),
  })
    .index("by_sport_score", ["sport", "score"])
    .index("by_user", ["userId"]),

  // ── Seasons ──
  seasons: defineTable({
    seasonNumber: v.number(),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
    resetStartedAt: v.optional(v.number()),
    resetCompletedAt: v.optional(v.number()),
  })
    .index("by_active", ["isActive"])
    .index("by_season_number", ["seasonNumber"]),

  seasonHistory: defineTable({
    userId: v.id("users"),
    seasonNumber: v.number(),
    sport: v.string(),
    mode: v.string(),
    finalElo: v.number(),
    rank: v.number(),
    tier: v.string(),
    badge: v.optional(v.string()),
    gamesPlayed: v.number(),
    wins: v.number(),
    archivedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_season_user_sport_mode", [
      "seasonNumber",
      "userId",
      "sport",
      "mode",
    ])
    .index("by_season_sport_mode_rank", ["seasonNumber", "sport", "mode", "rank"]),

  // ── ELO Decay ──
  decayNotifications: defineTable({
    userId: v.id("users"),
    sport: v.string(),
    mode: v.string(),
    decayDate: v.number(),
    dismissed: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user_dismissed", ["userId", "dismissed"])
    .index("by_user_sport_mode", ["userId", "sport", "mode"]),

  // ── The Forge (Community Question Sourcing) ──
  questionSubmissions: defineTable({
    authorId: v.id("users"),
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
    checksum: v.string(),
    imageId: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    approveCount: v.number(),
    rejectCount: v.number(),
    netVotes: v.number(),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_checksum", ["checksum"])
    .index("by_author", ["authorId"])
    .index("by_status", ["status"]),

  submissionVotes: defineTable({
    submissionId: v.id("questionSubmissions"),
    voterId: v.id("users"),
    vote: v.union(v.literal("approve"), v.literal("reject")),
    createdAt: v.number(),
  })
    .index("by_submission_voter", ["submissionId", "voterId"]),

  // ── Sports Data Tables ──

  sportsPlayers: defineTable({
    externalId: v.string(),
    seedVersion: v.optional(v.string()),
    sport: v.string(),
    apiId: v.number(),
    name: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    nationality: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    birthCountry: v.optional(v.string()),
    age: v.optional(v.number()),
    height: v.optional(v.string()),
    weight: v.optional(v.string()),
    position: v.optional(v.string()),
    photo: v.optional(v.string()),
    injured: v.optional(v.boolean()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_sport", ["sport"])
    .index("by_sport_name", ["sport", "name"])
    .index("by_sport_lastName", ["sport", "lastName"]),

  sportsTeams: defineTable({
    externalId: v.string(),
    seedVersion: v.optional(v.string()),
    sport: v.string(),
    apiId: v.number(),
    name: v.string(),
    shortName: v.optional(v.string()),
    logo: v.optional(v.string()),
    country: v.optional(v.string()),
    leagueId: v.optional(v.string()),
    season: v.optional(v.number()),
    founded: v.optional(v.number()),
    venue: v.optional(v.string()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_sport", ["sport"]),

  statFacts: defineTable({
    externalId: v.string(),
    seedVersion: v.optional(v.string()),
    sport: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    entityName: v.string(),
    statKey: v.string(),
    contextKey: v.string(),
    value: v.number(),
    season: v.optional(v.number()),
  })
    .index("by_external_id", ["externalId"]),

  higherLowerPools: defineTable({
    externalId: v.string(),
    seedVersion: v.optional(v.string()),
    sport: v.string(),
    entityType: v.string(),
    statKey: v.string(),
    contextKey: v.string(),
    contextLabel: v.string(),
    factCount: v.number(),
    distinctValueCount: v.number(),
    minValue: v.number(),
    maxValue: v.number(),
    season: v.optional(v.number()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_sport", ["sport"]),

  higherLowerFacts: defineTable({
    externalId: v.string(),
    seedVersion: v.optional(v.string()),
    sport: v.string(),
    poolKey: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    entityName: v.string(),
    statKey: v.string(),
    contextKey: v.string(),
    value: v.number(),
    season: v.optional(v.number()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_pool_key", ["poolKey"])
    .index("by_sport", ["sport"]),

  // Legacy VerveGrid raw table kept for pipeline/audit visibility.
  // Live VerveGrid runtime starts from curated boards, not this table.
  gridIndex: defineTable({
    externalId: v.string(),
    seedVersion: v.optional(v.string()),
    sport: v.string(),
    rowType: v.string(),
    rowKey: v.string(),
    rowLabel: v.string(),
    colType: v.string(),
    colKey: v.string(),
    colLabel: v.string(),
    playerIds: v.array(v.string()),
    difficulty: v.string(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_sport_difficulty", ["sport", "difficulty"]),

  verveGridApprovedIndex: defineTable({
    externalId: v.string(),
    seedVersion: v.optional(v.string()),
    sourceGridId: v.string(),
    axisFamily: v.string(),
    sport: v.string(),
    rowType: v.string(),
    rowKey: v.string(),
    rowLabel: v.string(),
    colType: v.string(),
    colKey: v.string(),
    colLabel: v.string(),
    playerIds: v.array(v.string()),
    difficulty: v.string(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_sport", ["sport"]),

  verveGridBoards: defineTable({
    externalId: v.string(),
    seedVersion: v.optional(v.string()),
    sport: v.string(),
    templateId: v.string(),
    axisFamily: v.string(),
    score: v.number(),
    rows: v.array(
      v.object({
        type: v.string(),
        key: v.string(),
        label: v.string(),
      }),
    ),
    cols: v.array(
      v.object({
        type: v.string(),
        key: v.string(),
        label: v.string(),
      }),
    ),
    cells: v.array(
      v.object({
        rowIdx: v.number(),
        colIdx: v.number(),
        validPlayerIds: v.array(v.string()),
      }),
    ),
  })
    .index("by_external_id", ["externalId"])
    .index("by_sport", ["sport"]),

  whoAmIClues: defineTable({
    externalId: v.string(),
    seedVersion: v.optional(v.string()),
    sport: v.string(),
    playerId: v.string(),
    clue1: v.string(),
    clue2: v.string(),
    clue3: v.string(),
    clue4: v.string(),
    answerName: v.string(),
    difficulty: v.string(),
  })
    .index("by_external_id", ["externalId"])
    .index("by_sport_difficulty", ["sport", "difficulty"]),

  whoAmIApprovedClues: defineTable({
    externalId: v.string(),
    seedVersion: v.optional(v.string()),
    sourceClueId: v.string(),
    sport: v.string(),
    playerId: v.string(),
    clue1: v.string(),
    clue2: v.string(),
    clue3: v.string(),
    clue4: v.string(),
    answerName: v.string(),
    difficulty: v.string(),
    rawDifficulty: v.string(),
    qualityScore: v.number(),
    isHeadlineSeed: v.boolean(),
    isManualLegend: v.boolean(),
    teamLabels: v.array(v.string()),
    approvalReasons: v.array(v.string()),
    curationFlags: v.array(v.string()),
  })
    .index("by_external_id", ["externalId"])
    .index("by_sport", ["sport"])
    .index("by_sport_difficulty", ["sport", "difficulty"]),

  curatedSeedMetadata: defineTable({
    scopeKey: v.string(),
    tableName: v.string(),
    sport: v.string(),
    mode: v.string(),
    artifactPath: v.string(),
    seedVersion: v.string(),
    artifactHash: v.string(),
    recordCount: v.number(),
    insertedCount: v.number(),
    replacedCount: v.number(),
    deletedCount: v.number(),
    generatedAt: v.string(),
    appliedAt: v.number(),
    replaceStrategy: v.string(),
  })
    .index("by_scope_table", ["scopeKey", "tableName"]),

  // ── New Game Mode Sessions ──

  higherLowerSessions: defineTable({
    userId: v.optional(v.id("users")),
    sport: v.string(),
    score: v.number(),
    streak: v.number(),
    seenFactIds: v.optional(v.array(v.string())),
    seenEntityIds: v.optional(v.array(v.string())),
    currentFactAId: v.string(),
    currentFactBId: v.string(),
    currentStatKey: v.string(),
    currentContext: v.string(),
    currentEntityType: v.optional(v.string()),
    currentSeason: v.optional(v.number()),
    currentFullContextKey: v.optional(v.string()),
    playerAName: v.string(),
    playerBName: v.string(),
    playerAValue: v.number(),
    playerBValue: v.number(),
    playerAPhoto: v.optional(v.string()),
    playerBPhoto: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("game_over")),
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  verveGridSessions: defineTable({
    userId: v.optional(v.id("users")),
    sport: v.string(),
    boardTemplateId: v.optional(v.string()),
    boardAxisFamily: v.optional(v.string()),
    rows: v.array(
      v.object({
        type: v.string(),
        key: v.string(),
        label: v.string(),
      }),
    ),
    cols: v.array(
      v.object({
        type: v.string(),
        key: v.string(),
        label: v.string(),
      }),
    ),
    cells: v.array(
      v.object({
        rowIdx: v.number(),
        colIdx: v.number(),
        validPlayerIds: v.array(v.string()),
        guessedPlayerId: v.optional(v.string()),
        guessedPlayerName: v.optional(v.string()),
        correct: v.optional(v.boolean()),
      }),
    ),
    remainingGuesses: v.number(),
    correctCount: v.number(),
    status: v.union(v.literal("active"), v.literal("completed")),
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  whoAmISessions: defineTable({
    userId: v.optional(v.id("users")),
    sport: v.string(),
    clueExternalId: v.string(),
    answerName: v.string(),
    currentStage: v.number(),
    score: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("correct"),
      v.literal("failed"),
    ),
    expiresAt: v.number(),
    closeCallCount: v.optional(v.number()),
    guesses: v.optional(v.array(v.object({
      guessName: v.string(),
      correct: v.boolean(),
      closeCall: v.boolean(),
      scoreAfter: v.number(),
      feedback: v.optional(v.object({
        guessedPlayerName: v.string(),
        nationality: v.union(v.literal("correct"), v.literal("incorrect"), v.literal("unknown")),
        position: v.union(v.literal("correct"), v.literal("incorrect"), v.literal("unknown")),
        team: v.union(v.literal("correct"), v.literal("incorrect"), v.literal("unknown")),
      })),
      createdAt: v.number(),
    }))),
    maxGuesses: v.optional(v.number()),
    wrongGuessCount: v.optional(v.number()),
    hardMode: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),
});
