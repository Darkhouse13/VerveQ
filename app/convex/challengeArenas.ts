import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { normalizeAnswer } from "./lib/scoring";
import { orderAnswerOptions } from "./lib/answerOptions";
import { challengeArenaCapitalCityQuestions } from "./challengeArenaContent";

const ARENA_ROUNDS = 5;
const QUESTIONS_PER_ROUND = 10;
const QUESTION_WINDOW_MS = 10_000;
const COUNTDOWN_MS = 3_000;
const REVEAL_WINDOW_MS = 2_000;
const ROUND_BREAK_MS = 8_000;
const FORCE_START_GRACE_MS = 15_000;
const ARENA_TTL_MS = 3 * 60 * 60 * 1000;
const EXPIRE_BATCH_SIZE = 50;
const RANK_BONUS = [50, 30, 20, 10, 10] as const;

const arenaMode = v.union(
  v.literal("1v1"),
  v.literal("2v2"),
  v.literal("ffa3"),
  v.literal("ffa4"),
  v.literal("ffa5"),
);

const team = v.union(v.literal("A"), v.literal("B"));

const DEFAULT_ROUND_CATEGORIES = [
  "football_quiz",
  "general_knowledge",
  "which_came_first",
  "name_the_logo",
  "capital_cities",
] as const;

const DIFFICULTIES = ["intermediate", "easy", "hard"] as const;
const CONTENT_SPORTS = ["football", "basketball", "tennis", "knowledge"] as const;

type Arena = Doc<"arenas">;
type ArenaAnswer = Doc<"arenaAnswers">;
type ArenaPlayer = Arena["players"][number];
type ArenaMode = Arena["mode"];
type Question = Doc<"quizQuestions">;
type LeaderboardRow = {
  id: string;
  label: string;
  score: number;
  playerIds: Id<"users">[];
};
type ArenaSummaryPlayer = {
  userId: Id<"users">;
  nameSnapshot: string;
  team: ArenaPlayer["team"] | null;
  left: boolean;
  totalScore: number;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  avgCorrectMs: number | null;
  longestStreak: number;
};

function hashString(value: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

function seededRandom(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string) {
  const out = [...items];
  const rand = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomArenaCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return code;
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function modeCapacity(mode: ArenaMode) {
  switch (mode) {
    case "1v1":
      return 2;
    case "2v2":
      return 4;
    case "ffa3":
      return 3;
    case "ffa4":
      return 4;
    case "ffa5":
      return 5;
  }
}

function activePlayers(arena: Arena) {
  return arena.players.filter((player) => !player.left);
}

function findPlayerIndex(arena: Arena, userId: Id<"users">) {
  return arena.players.findIndex((player) => player.userId === userId);
}

function snapshotName(user: Doc<"users"> | null, fallback: string) {
  return user?.displayName ?? user?.username ?? fallback;
}

function isAnswerableMcq(question: Question) {
  return (
    question.options.length >= 2 &&
    question.options.includes(question.correctAnswer)
  );
}

function isValidLogoQuestion(question: Question) {
  return (
    question.category === "badge_identification" &&
    !!question.imageId &&
    isAnswerableMcq(question)
  );
}

async function generateUniqueCode(ctx: Pick<MutationCtx, "db">) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomArenaCode();
    const existing = await ctx.db
      .query("arenas")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!existing) return code;
  }
  throw new Error("Could not allocate arena code");
}

async function getArenaByCode(ctx: Pick<QueryCtx | MutationCtx, "db">, code: string) {
  return await ctx.db
    .query("arenas")
    .withIndex("by_code", (q) => q.eq("code", normalizeCode(code)))
    .first();
}

async function getArenaByLocator(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  args: { arenaId?: Id<"arenas">; code?: string },
) {
  if (args.arenaId) return await ctx.db.get(args.arenaId);
  if (args.code) return await getArenaByCode(ctx, args.code);
  throw new Error("arenaId or code is required");
}

async function collectQuestionsForSport(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  sport: string,
) {
  const questions: Question[] = [];
  for (const difficulty of DIFFICULTIES) {
    const rows = await ctx.db
      .query("quizQuestions")
      .withIndex("by_sport_difficulty", (q) =>
        q.eq("sport", sport).eq("difficulty", difficulty),
      )
      .collect();
    questions.push(...rows);
  }
  return questions;
}

async function collectAllCandidateQuestions(ctx: Pick<QueryCtx | MutationCtx, "db">) {
  const all: Question[] = [];
  for (const sport of CONTENT_SPORTS) {
    all.push(...(await collectQuestionsForSport(ctx, sport)));
  }
  return all;
}

async function ensureCapitalCitySeeds(ctx: Pick<MutationCtx, "db">) {
  let inserted = 0;
  for (const seed of challengeArenaCapitalCityQuestions) {
    const existing = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", seed.checksum))
      .first();
    if (existing) continue;

    await ctx.db.insert("quizQuestions", {
      ...seed,
      difficultyVotes: 0,
      difficultyScore: 0,
      timesAnswered: 0,
      timesCorrect: 0,
      usageCount: 0,
    });
    inserted += 1;
  }
  return inserted;
}

function uniqueStableCandidates(questions: Question[], used: Set<string>) {
  const byChecksum = new Map<string, Question>();
  for (const question of questions) {
    if (!used.has(question.checksum) && isAnswerableMcq(question)) {
      byChecksum.set(question.checksum, question);
    }
  }
  return [...byChecksum.values()].sort((a, b) =>
    a.checksum.localeCompare(b.checksum),
  );
}

function pickChecksums(
  questions: Question[],
  used: Set<string>,
  seed: string,
  label: string,
) {
  const candidates = uniqueStableCandidates(questions, used);
  const picked = seededShuffle(candidates, seed).slice(0, QUESTIONS_PER_ROUND);
  if (picked.length < QUESTIONS_PER_ROUND) {
    throw new Error(
      `Not enough challenge arena questions for ${label}: ${picked.length}/${QUESTIONS_PER_ROUND}`,
    );
  }
  for (const question of picked) used.add(question.checksum);
  return picked.map((question) => question.checksum);
}

async function lockRoundQuestionSets(
  ctx: Pick<MutationCtx, "db">,
  seed: string,
) {
  await ensureCapitalCitySeeds(ctx);

  const football = await collectQuestionsForSport(ctx, "football");
  const knowledge = await collectQuestionsForSport(ctx, "knowledge");
  const all = await collectAllCandidateQuestions(ctx);
  const used = new Set<string>();
  const categories: string[] = [];
  const rounds: string[][] = [];

  for (const category of DEFAULT_ROUND_CATEGORIES) {
    if (category === "football_quiz") {
      rounds.push(
        pickChecksums(
          football.filter(
            (q) =>
              q.category !== "which_came_first" &&
              q.category !== "badge_identification",
          ),
          used,
          `${seed}:${category}`,
          "football quiz",
        ),
      );
      categories.push(category);
      continue;
    }

    if (category === "general_knowledge") {
      rounds.push(
        pickChecksums(
          knowledge.filter(
            (q) =>
              q.category !== "which_came_first" &&
              q.category !== "capital_cities" &&
              q.category !== "geography",
          ),
          used,
          `${seed}:${category}`,
          "general knowledge",
        ),
      );
      categories.push(category);
      continue;
    }

    if (category === "which_came_first") {
      rounds.push(
        pickChecksums(
          knowledge.filter((q) => q.category === "which_came_first"),
          used,
          `${seed}:${category}`,
          "which came first",
        ),
      );
      categories.push(category);
      continue;
    }

    if (category === "name_the_logo") {
      const logos = all.filter(isValidLogoQuestion);
      if (uniqueStableCandidates(logos, used).length >= QUESTIONS_PER_ROUND) {
        rounds.push(
          pickChecksums(logos, used, `${seed}:${category}`, "name the logo"),
        );
        categories.push(category);
      } else {
        rounds.push(
          pickChecksums(
            knowledge.filter((q) => q.category === "geography"),
            used,
            `${seed}:${category}:geography_fallback`,
            "geography fallback for name the logo",
          ),
        );
        categories.push("geography_fallback_for_logo");
      }
      continue;
    }

    rounds.push(
      pickChecksums(
        knowledge.filter((q) => q.category === "capital_cities"),
        used,
        `${seed}:${category}`,
        "capital cities",
      ),
    );
    categories.push(category);
  }

  return { categories, rounds };
}

async function loadCurrentQuestion(ctx: Pick<QueryCtx | MutationCtx, "db">, arena: Arena) {
  const checksum = arena.roundChecksums[arena.currentRound]?.[arena.currentQuestionIndex];
  if (!checksum) return null;
  return await ctx.db
    .query("quizQuestions")
    .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
    .first();
}

async function sanitizeQuestion(
  ctx: Pick<QueryCtx | MutationCtx, "storage">,
  question: Question,
  includeCorrectAnswer: boolean,
) {
  const imageUrl = question.imageId
    ? await ctx.storage.getUrl(question.imageId)
    : null;
  return {
    question: question.question,
    options: orderAnswerOptions(
      question.options,
      question.correctAnswer,
      question.checksum,
    ),
    category: question.category,
    difficulty: question.difficulty,
    imageUrl,
    ...(includeCorrectAnswer
      ? {
          correctAnswer: question.correctAnswer,
          explanation: question.explanation ?? null,
        }
      : {}),
  };
}

function assertHost(arena: Arena, userId: Id<"users">) {
  if (arena.hostId !== userId) throw new Error("Only the host can do this");
}

function assertLobby(arena: Arena) {
  if (arena.status !== "lobby" || arena.phase !== "lobby") {
    throw new Error("Arena is not in the lobby");
  }
}

function validateTwoTeamState(players: ArenaPlayer[]) {
  const teamCounts = { A: 0, B: 0 };
  for (const player of players) {
    if (player.team !== "A" && player.team !== "B") {
      throw new Error("Every 2v2 player must choose a team");
    }
    teamCounts[player.team] += 1;
  }
  if (teamCounts.A < 1 || teamCounts.B < 1) {
    throw new Error("2v2 needs players on both teams");
  }
  if (teamCounts.A > 2 || teamCounts.B > 2) {
    throw new Error("2v2 teams are capped at two players");
  }
}

async function abandonArena(ctx: Pick<MutationCtx, "db">, arena: Arena) {
  await ctx.db.patch(arena._id, {
    status: "abandoned",
    phase: "abandoned",
    questionStartedAt: undefined,
  });
}

async function openQuestion(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  arena: Arena,
  round: number,
  questionIndex: number,
) {
  if (activePlayers(arena).length === 0) {
    await abandonArena(ctx, arena);
    return;
  }

  const now = Date.now();
  await ctx.db.patch(arena._id, {
    status: "active",
    phase: "question",
    currentRound: round,
    currentQuestionIndex: questionIndex,
    questionStartedAt: now,
  });
  await ctx.scheduler.runAfter(
    arena.questionWindowMs,
    internal.challengeArenas.closeQuestion,
    { arenaId: arena._id, round, questionIndex },
  );
}

async function answersForQuestion(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  arenaId: Id<"arenas">,
  round: number,
  questionIndex: number,
) {
  return await ctx.db
    .query("arenaAnswers")
    .withIndex("by_arena_round_question", (q) =>
      q.eq("arenaId", arenaId).eq("round", round).eq("questionIndex", questionIndex),
    )
    .collect();
}

async function closeQuestionNow(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  arena: Arena,
  round: number,
  questionIndex: number,
) {
  if (
    arena.status !== "active" ||
    arena.phase !== "question" ||
    arena.currentRound !== round ||
    arena.currentQuestionIndex !== questionIndex
  ) {
    return;
  }

  const players = activePlayers(arena);
  if (players.length === 0) {
    await abandonArena(ctx, arena);
    return;
  }

  const playerIds = new Set(players.map((player) => player.userId));
  const answers = await answersForQuestion(ctx, arena._id, round, questionIndex);
  const activeAnswers = answers.filter((answer) => playerIds.has(answer.userId));
  const correctAnswers = activeAnswers
    .filter((answer) => answer.correct)
    .sort((a, b) => a.serverTimeMs - b.serverTimeMs);
  const rankByUser = new Map<Id<"users">, number>();
  correctAnswers.forEach((answer, index) => rankByUser.set(answer.userId, index));

  const pointsByUser = new Map<Id<"users">, number>();
  for (const answer of activeAnswers) {
    if (!answer.correct) {
      pointsByUser.set(answer.userId, 0);
      continue;
    }
    const rank = rankByUser.get(answer.userId) ?? 0;
    const timeBonus = Math.round(
      100 * Math.max(0, (arena.questionWindowMs - answer.serverTimeMs) / arena.questionWindowMs),
    );
    const rankBonus = RANK_BONUS[Math.min(rank, RANK_BONUS.length - 1)] ?? 10;
    pointsByUser.set(answer.userId, 100 + timeBonus + rankBonus);
  }

  for (const answer of answers) {
    await ctx.db.patch(answer._id, {
      points: pointsByUser.get(answer.userId) ?? 0,
    });
  }

  const nextPlayers = arena.players.map((player) =>
    player.left
      ? player
      : {
          ...player,
          totalScore: player.totalScore + (pointsByUser.get(player.userId) ?? 0),
        },
  );

  const question = await loadCurrentQuestion(ctx, arena);
  if (question) {
    await ctx.db.patch(question._id, {
      usageCount: question.usageCount + players.length,
      timesAnswered: question.timesAnswered + activeAnswers.length,
      timesCorrect: question.timesCorrect + correctAnswers.length,
    });
  }

  await ctx.db.patch(arena._id, {
    players: nextPlayers,
    phase: "reveal",
    questionStartedAt: undefined,
  });

  await ctx.scheduler.runAfter(
    REVEAL_WINDOW_MS,
    internal.challengeArenas.advanceRound,
    {
      arenaId: arena._id,
      expectedPhase: "reveal",
      expectedRound: round,
      expectedQuestionIndex: questionIndex,
    },
  );
}

async function advanceArena(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  arena: Arena,
) {
  if (arena.status === "final" || arena.status === "abandoned") return;
  if (activePlayers(arena).length === 0) {
    await abandonArena(ctx, arena);
    return;
  }

  if (arena.phase === "countdown") {
    await openQuestion(ctx, arena, 0, 0);
    return;
  }

  if (arena.phase === "reveal") {
    const nextQuestionIndex = arena.currentQuestionIndex + 1;
    if (nextQuestionIndex < arena.config.perRound) {
      await openQuestion(ctx, arena, arena.currentRound, nextQuestionIndex);
      return;
    }

    if (arena.currentRound + 1 >= arena.config.rounds) {
      await ctx.db.patch(arena._id, {
        status: "final",
        phase: "final",
        questionStartedAt: undefined,
      });
      return;
    }

    await ctx.db.patch(arena._id, {
      status: "round_break",
      phase: "round_break",
      questionStartedAt: undefined,
      players: arena.players.map((player) =>
        player.left ? player : { ...player, ready: false },
      ),
    });
    await ctx.scheduler.runAfter(
      ROUND_BREAK_MS,
      internal.challengeArenas.advanceRound,
      {
        arenaId: arena._id,
        expectedPhase: "round_break",
        expectedRound: arena.currentRound,
      },
    );
    return;
  }

  if (arena.phase === "round_break") {
    await openQuestion(ctx, arena, arena.currentRound + 1, 0);
  }
}

function sortedLeaderboard(rows: LeaderboardRow[]) {
  return rows
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .map((row, index) => ({
      rank: index + 1,
      ...row,
    }));
}

function aggregateScores(arena: Arena, scoreByUser: Map<Id<"users">, number>) {
  if (arena.mode === "2v2") {
    const teams = new Map<string, LeaderboardRow>();
    for (const player of arena.players) {
      const teamId = player.team ?? "Unassigned";
      const row = teams.get(teamId) ?? {
        id: teamId,
        label: teamId === "A" || teamId === "B" ? `Team ${teamId}` : teamId,
        score: 0,
        playerIds: [],
      };
      row.score += scoreByUser.get(player.userId) ?? 0;
      row.playerIds.push(player.userId);
      teams.set(teamId, row);
    }
    return sortedLeaderboard([...teams.values()]);
  }

  return sortedLeaderboard(
    arena.players.map((player) => ({
      id: player.userId,
      label: player.nameSnapshot,
      score: scoreByUser.get(player.userId) ?? 0,
      playerIds: [player.userId],
    })),
  );
}

async function buildRoundLeaderboard(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  arena: Arena,
  round: number,
) {
  const scoreByUser = new Map<Id<"users">, number>();
  for (let questionIndex = 0; questionIndex < arena.config.perRound; questionIndex += 1) {
    const answers = await answersForQuestion(ctx, arena._id, round, questionIndex);
    for (const answer of answers) {
      scoreByUser.set(
        answer.userId,
        (scoreByUser.get(answer.userId) ?? 0) + answer.points,
      );
    }
  }
  return aggregateScores(arena, scoreByUser);
}

function buildFinalPodium(arena: Arena) {
  const scoreByUser = new Map<Id<"users">, number>();
  for (const player of arena.players) {
    scoreByUser.set(player.userId, player.totalScore);
  }
  return aggregateScores(arena, scoreByUser);
}

function questionSlotKey(round: number, questionIndex: number) {
  return `${round}:${questionIndex}`;
}

function isWithinArenaQuestionSet(arena: Arena, answer: ArenaAnswer) {
  return (
    answer.round >= 0 &&
    answer.round < arena.config.rounds &&
    answer.questionIndex >= 0 &&
    answer.questionIndex < arena.config.perRound
  );
}

function sortedArenaAnswers(answers: ArenaAnswer[]) {
  return [...answers].sort(
    (a, b) =>
      a.round - b.round ||
      a.questionIndex - b.questionIndex ||
      String(a.userId).localeCompare(String(b.userId)) ||
      a.serverTimeMs - b.serverTimeMs,
  );
}

async function answersForArena(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  arena: Arena,
) {
  const answers = await ctx.db
    .query("arenaAnswers")
    .withIndex("by_arena_round_question", (q) => q.eq("arenaId", arena._id))
    .collect();
  return sortedArenaAnswers(
    answers.filter((answer) => isWithinArenaQuestionSet(arena, answer)),
  );
}

function buildSummaryPlayer(
  arena: Arena,
  player: ArenaPlayer,
  answers: ArenaAnswer[],
): ArenaSummaryPlayer {
  const correctAnswers = answers.filter((answer) => answer.correct);
  const answerBySlot = new Map<string, ArenaAnswer>();
  for (const answer of answers) {
    answerBySlot.set(questionSlotKey(answer.round, answer.questionIndex), answer);
  }

  let currentStreak = 0;
  let longestStreak = 0;
  for (let round = 0; round < arena.config.rounds; round += 1) {
    for (let questionIndex = 0; questionIndex < arena.config.perRound; questionIndex += 1) {
      const answer = answerBySlot.get(questionSlotKey(round, questionIndex));
      if (answer?.correct) {
        currentStreak += 1;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
  }

  const totalCorrectTimeMs = correctAnswers.reduce(
    (sum, answer) => sum + answer.serverTimeMs,
    0,
  );

  return {
    userId: player.userId,
    nameSnapshot: player.nameSnapshot,
    team: player.team ?? null,
    left: player.left,
    totalScore: answers.reduce((sum, answer) => sum + answer.points, 0),
    questionsAnswered: answers.length,
    correctAnswers: correctAnswers.length,
    // Accuracy uses submitted answers as the denominator; missed questions are unanswered.
    accuracy: answers.length === 0 ? 0 : correctAnswers.length / answers.length,
    avgCorrectMs:
      correctAnswers.length === 0
        ? null
        : totalCorrectTimeMs / correctAnswers.length,
    longestStreak,
  };
}

function rankedSummaryPlayers(players: ArenaSummaryPlayer[]) {
  return [...players]
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        a.nameSnapshot.localeCompare(b.nameSnapshot) ||
        String(a.userId).localeCompare(String(b.userId)),
    )
    .map((player, index) => ({
      rank: index + 1,
      userId: player.userId,
      nameSnapshot: player.nameSnapshot,
      team: player.team,
      left: player.left,
      totalScore: player.totalScore,
    }));
}

function rankedSummaryTeams(players: ArenaSummaryPlayer[]) {
  const teams = new Map<
    string,
    {
      id: string;
      label: string;
      totalScore: number;
      playerIds: Id<"users">[];
    }
  >();

  for (const player of players) {
    const teamId = player.team ?? "Unassigned";
    const team = teams.get(teamId) ?? {
      id: teamId,
      label: teamId === "A" || teamId === "B" ? `Team ${teamId}` : teamId,
      totalScore: 0,
      playerIds: [],
    };
    team.totalScore += player.totalScore;
    team.playerIds.push(player.userId);
    teams.set(teamId, team);
  }

  return [...teams.values()]
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        a.label.localeCompare(b.label) ||
        a.id.localeCompare(b.id),
    )
    .map((team, index) => ({
      rank: index + 1,
      ...team,
    }));
}

function summaryIdentity(player: ArenaSummaryPlayer) {
  return {
    userId: player.userId,
    nameSnapshot: player.nameSnapshot,
    team: player.team,
  };
}

function buildSummarySuperlatives(players: ArenaSummaryPlayer[]) {
  const fastestEligible = players.filter((player) => player.avgCorrectMs !== null);
  const fastestMs =
    fastestEligible.length === 0
      ? null
      : Math.min(
          ...fastestEligible.map(
            (player) => player.avgCorrectMs ?? Number.POSITIVE_INFINITY,
          ),
        );

  const sharpshooterEligible = players.filter(
    (player) => player.questionsAnswered > 0,
  );
  const bestAccuracy =
    sharpshooterEligible.length === 0
      ? null
      : Math.max(...sharpshooterEligible.map((player) => player.accuracy));

  const hotStreakEligible = players.filter((player) => player.longestStreak > 0);
  const bestStreak =
    hotStreakEligible.length === 0
      ? null
      : Math.max(...hotStreakEligible.map((player) => player.longestStreak));

  return {
    fastest:
      fastestMs === null
        ? []
        : fastestEligible
            .filter((player) => player.avgCorrectMs === fastestMs)
            .map((player) => ({
              ...summaryIdentity(player),
              avgCorrectMs: player.avgCorrectMs,
            })),
    sharpshooter:
      bestAccuracy === null
        ? []
        : sharpshooterEligible
            .filter((player) => player.accuracy === bestAccuracy)
            .map((player) => ({
              ...summaryIdentity(player),
              accuracy: player.accuracy,
            })),
    hotStreak:
      bestStreak === null
        ? []
        : hotStreakEligible
            .filter((player) => player.longestStreak === bestStreak)
            .map((player) => ({
              ...summaryIdentity(player),
              longestStreak: player.longestStreak,
            })),
  };
}

async function buildArenaSummary(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  arena: Arena,
) {
  const answers = await answersForArena(ctx, arena);
  const answersByUser = new Map<Id<"users">, ArenaAnswer[]>();
  for (const player of arena.players) {
    answersByUser.set(player.userId, []);
  }
  for (const answer of answers) {
    answersByUser.get(answer.userId)?.push(answer);
  }

  const players = arena.players.map((player) =>
    buildSummaryPlayer(arena, player, answersByUser.get(player.userId) ?? []),
  );
  const isTeamMode = arena.mode === "2v2";

  return {
    arenaId: arena._id,
    mode: arena.mode,
    totalQuestions: arena.config.rounds * arena.config.perRound,
    isTeamMode,
    players,
    rankings: {
      players: rankedSummaryPlayers(players),
      teams: isTeamMode ? rankedSummaryTeams(players) : [],
    },
    superlatives: buildSummarySuperlatives(players),
  };
}

async function getContentCounts(ctx: Pick<QueryCtx | MutationCtx, "db">) {
  const football = await collectQuestionsForSport(ctx, "football");
  const knowledge = await collectQuestionsForSport(ctx, "knowledge");
  const all = await collectAllCandidateQuestions(ctx);
  return {
    footballQuiz: football.filter(
      (q) =>
        q.category !== "which_came_first" &&
        q.category !== "badge_identification" &&
        isAnswerableMcq(q),
    ).length,
    generalKnowledge: knowledge.filter(
      (q) =>
        q.category !== "which_came_first" &&
        q.category !== "capital_cities" &&
        q.category !== "geography" &&
        isAnswerableMcq(q),
    ).length,
    whichCameFirst: knowledge.filter(
      (q) => q.category === "which_came_first" && isAnswerableMcq(q),
    ).length,
    validLogoMcqImages: all.filter(isValidLogoQuestion).length,
    capitalCities: knowledge.filter(
      (q) => q.category === "capital_cities" && isAnswerableMcq(q),
    ).length,
    bundledCapitalSeeds: challengeArenaCapitalCityQuestions.length,
    logoFallbackCategory: "geography_fallback_for_logo",
  };
}

export const create = mutation({
  args: { mode: arenaMode },
  handler: async (ctx, { mode }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    const now = Date.now();
    const code = await generateUniqueCode(ctx);
    const arenaId = await ctx.db.insert("arenas", {
      code,
      hostId: userId,
      mode,
      status: "lobby",
      players: [
        {
          userId,
          nameSnapshot: snapshotName(user, "Host"),
          team: mode === "2v2" ? "A" : undefined,
          ready: false,
          joinedAt: now,
          lastSeenAt: now,
          left: false,
          totalScore: 0,
        },
      ],
      config: {
        rounds: ARENA_ROUNDS,
        perRound: QUESTIONS_PER_ROUND,
        categories: [...DEFAULT_ROUND_CATEGORIES],
      },
      currentRound: 0,
      currentQuestionIndex: 0,
      phase: "lobby",
      questionWindowMs: QUESTION_WINDOW_MS,
      roundChecksums: [],
      createdAt: now,
      expiresAt: now + ARENA_TTL_MS,
    });

    return { arenaId, code };
  },
});

export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const arena = await getArenaByCode(ctx, code);
    if (!arena) throw new Error("Arena not found");
    assertLobby(arena);

    const now = Date.now();
    const existingIndex = findPlayerIndex(arena, userId);
    if (existingIndex >= 0) {
      const players = [...arena.players];
      players[existingIndex] = {
        ...players[existingIndex],
        lastSeenAt: now,
        left: false,
      };
      await ctx.db.patch(arena._id, { players });
      return { arenaId: arena._id, code: arena.code };
    }

    if (activePlayers(arena).length >= modeCapacity(arena.mode)) {
      throw new Error("Arena is full");
    }

    const user = await ctx.db.get(userId);
    const teamCounts = { A: 0, B: 0 };
    if (arena.mode === "2v2") {
      for (const player of activePlayers(arena)) {
        if (player.team === "A" || player.team === "B") teamCounts[player.team] += 1;
      }
    }
    const assignedTeam =
      arena.mode === "2v2"
        ? teamCounts.A <= teamCounts.B
          ? "A"
          : "B"
        : undefined;

    await ctx.db.patch(arena._id, {
      players: [
        ...arena.players,
        {
          userId,
          nameSnapshot: snapshotName(user, `Player ${arena.players.length + 1}`),
          team: assignedTeam,
          ready: false,
          joinedAt: now,
          lastSeenAt: now,
          left: false,
          totalScore: 0,
        },
      ],
    });

    return { arenaId: arena._id, code: arena.code };
  },
});

export const setReady = mutation({
  args: {
    arenaId: v.id("arenas"),
    ready: v.optional(v.boolean()),
  },
  handler: async (ctx, { arenaId, ready }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const arena = await ctx.db.get(arenaId);
    if (!arena) throw new Error("Arena not found");
    assertLobby(arena);

    const playerIndex = findPlayerIndex(arena, userId);
    if (playerIndex < 0 || arena.players[playerIndex].left) {
      throw new Error("Not a player in this arena");
    }

    const players = [...arena.players];
    players[playerIndex] = {
      ...players[playerIndex],
      ready: ready ?? true,
      lastSeenAt: Date.now(),
    };
    await ctx.db.patch(arenaId, { players });
    return { ready: players[playerIndex].ready };
  },
});

export const setTeam = mutation({
  args: {
    arenaId: v.id("arenas"),
    team,
  },
  handler: async (ctx, { arenaId, team }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const arena = await ctx.db.get(arenaId);
    if (!arena) throw new Error("Arena not found");
    assertLobby(arena);
    if (arena.mode !== "2v2") throw new Error("Teams are only used in 2v2");

    const playerIndex = findPlayerIndex(arena, userId);
    if (playerIndex < 0 || arena.players[playerIndex].left) {
      throw new Error("Not a player in this arena");
    }

    const teammates = activePlayers(arena).filter(
      (player) => player.userId !== userId && player.team === team,
    );
    if (teammates.length >= 2) throw new Error("Team is full");

    const players = [...arena.players];
    players[playerIndex] = {
      ...players[playerIndex],
      team,
      lastSeenAt: Date.now(),
    };
    await ctx.db.patch(arenaId, { players });
    return { team };
  },
});

export const leave = mutation({
  args: { arenaId: v.id("arenas") },
  handler: async (ctx, { arenaId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const arena = await ctx.db.get(arenaId);
    if (!arena) throw new Error("Arena not found");
    const playerIndex = findPlayerIndex(arena, userId);
    if (playerIndex < 0) throw new Error("Not a player in this arena");
    if (arena.players[playerIndex].left) return { status: arena.status };

    const players = [...arena.players];
    players[playerIndex] = {
      ...players[playerIndex],
      ready: false,
      left: true,
      lastSeenAt: Date.now(),
    };
    const remaining = players.filter((player) => !player.left);
    if (remaining.length === 0) {
      await ctx.db.patch(arenaId, {
        players,
        status: "abandoned",
        phase: "abandoned",
        questionStartedAt: undefined,
      });
      return { status: "abandoned" };
    }

    await ctx.db.patch(arenaId, {
      players,
      hostId: arena.hostId === userId ? remaining[0].userId : arena.hostId,
    });
    return { status: arena.status };
  },
});

export const heartbeat = mutation({
  args: { arenaId: v.id("arenas") },
  handler: async (ctx, { arenaId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const arena = await ctx.db.get(arenaId);
    if (!arena) return;
    const playerIndex = findPlayerIndex(arena, userId);
    if (playerIndex < 0) return;
    const players = [...arena.players];
    players[playerIndex] = { ...players[playerIndex], lastSeenAt: Date.now() };
    await ctx.db.patch(arenaId, { players });
  },
});

export const start = mutation({
  args: {
    arenaId: v.id("arenas"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, { arenaId, force }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const arena = await ctx.db.get(arenaId);
    if (!arena) throw new Error("Arena not found");
    assertHost(arena, userId);
    assertLobby(arena);

    const now = Date.now();
    let players = arena.players;
    const currentActive = activePlayers(arena);
    const allReady = currentActive.length >= 2 && currentActive.every((player) => player.ready);

    if (!allReady) {
      if (!force || now < arena.createdAt + FORCE_START_GRACE_MS) {
        throw new Error("All active players must be ready before start");
      }
      players = arena.players.map((player) =>
        !player.left && !player.ready && player.userId !== arena.hostId
          ? { ...player, left: true, ready: false, lastSeenAt: now }
          : player,
      );
    }

    const starters = players.filter((player) => !player.left);
    if (starters.length < 2) throw new Error("At least two players are required");
    if (starters.length > modeCapacity(arena.mode)) throw new Error("Too many players");
    if (arena.mode === "2v2") validateTwoTeamState(starters);

    const seed = hashString(`${arena._id}:${arena.code}:${now}`);
    const locked = await lockRoundQuestionSets(ctx, seed);
    await ctx.db.patch(arenaId, {
      players,
      status: "countdown",
      phase: "countdown",
      config: {
        ...arena.config,
        categories: locked.categories,
      },
      currentRound: 0,
      currentQuestionIndex: 0,
      roundChecksums: locked.rounds,
      questionStartedAt: undefined,
    });

    await ctx.scheduler.runAfter(COUNTDOWN_MS, internal.challengeArenas.advanceRound, {
      arenaId,
      expectedPhase: "countdown",
    });

    return {
      arenaId,
      code: arena.code,
      categories: locked.categories,
      questionSetSizes: locked.rounds.map((round) => round.length),
    };
  },
});

export const submitAnswer = mutation({
  args: {
    arenaId: v.id("arenas"),
    answer: v.string(),
  },
  handler: async (ctx, { arenaId, answer }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const arena = await ctx.db.get(arenaId);
    if (!arena) throw new Error("Arena not found");
    if (arena.status !== "active" || arena.phase !== "question") {
      throw new Error("Arena is not accepting answers");
    }
    const playerIndex = findPlayerIndex(arena, userId);
    if (playerIndex < 0 || arena.players[playerIndex].left) {
      throw new Error("Not an active player in this arena");
    }
    if (!arena.questionStartedAt) throw new Error("Question has not started");

    const serverTimeMs = Math.max(0, Date.now() - arena.questionStartedAt);
    if (serverTimeMs > arena.questionWindowMs) {
      await closeQuestionNow(ctx, arena, arena.currentRound, arena.currentQuestionIndex);
      throw new Error("Question timed out");
    }

    const existingAnswers = await answersForQuestion(
      ctx,
      arenaId,
      arena.currentRound,
      arena.currentQuestionIndex,
    );
    if (existingAnswers.some((row) => row.userId === userId)) {
      throw new Error("Already answered this question");
    }

    const question = await loadCurrentQuestion(ctx, arena);
    if (!question) throw new Error("Question not found");
    const correct = normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer);

    await ctx.db.insert("arenaAnswers", {
      arenaId,
      round: arena.currentRound,
      questionIndex: arena.currentQuestionIndex,
      userId,
      answer,
      serverTimeMs,
      correct,
      points: 0,
    });

    const activeIds = new Set(activePlayers(arena).map((player) => player.userId));
    const answeredIds = new Set([
      ...existingAnswers
        .filter((row) => activeIds.has(row.userId))
        .map((row) => row.userId),
      userId,
    ]);
    if (answeredIds.size >= activeIds.size) {
      await closeQuestionNow(ctx, arena, arena.currentRound, arena.currentQuestionIndex);
    }

    return { accepted: true, serverTimeMs };
  },
});

export const readyNextRound = mutation({
  args: { arenaId: v.id("arenas") },
  handler: async (ctx, { arenaId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const arena = await ctx.db.get(arenaId);
    if (!arena) throw new Error("Arena not found");
    if (arena.phase !== "round_break" || arena.status !== "round_break") {
      throw new Error("Arena is not in a round break");
    }
    const playerIndex = findPlayerIndex(arena, userId);
    if (playerIndex < 0 || arena.players[playerIndex].left) {
      throw new Error("Not an active player in this arena");
    }
    const players = [...arena.players];
    players[playerIndex] = {
      ...players[playerIndex],
      ready: true,
      lastSeenAt: Date.now(),
    };
    await ctx.db.patch(arenaId, { players });

    const updated = { ...arena, players } as Arena;
    const allReady = activePlayers(updated).every((player) => player.ready);
    if (allReady) {
      await advanceArena(ctx, updated);
    }
    return { allReady };
  },
});

export const rematch = mutation({
  args: { arenaId: v.id("arenas") },
  handler: async (ctx, { arenaId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const arena = await ctx.db.get(arenaId);
    if (!arena) throw new Error("Arena not found");
    if (findPlayerIndex(arena, userId) < 0) {
      throw new Error("Not a player in this arena");
    }

    const now = Date.now();
    const code = await generateUniqueCode(ctx);
    const players = arena.players.map((player) => ({
      userId: player.userId,
      nameSnapshot: player.nameSnapshot,
      team: player.team,
      ready: false,
      joinedAt: now,
      lastSeenAt: now,
      left: false,
      totalScore: 0,
    }));
    const rematchId = await ctx.db.insert("arenas", {
      code,
      hostId: userId,
      mode: arena.mode,
      status: "lobby",
      players,
      config: {
        rounds: ARENA_ROUNDS,
        perRound: QUESTIONS_PER_ROUND,
        categories: [...DEFAULT_ROUND_CATEGORIES],
      },
      currentRound: 0,
      currentQuestionIndex: 0,
      phase: "lobby",
      questionWindowMs: QUESTION_WINDOW_MS,
      roundChecksums: [],
      createdAt: now,
      expiresAt: now + ARENA_TTL_MS,
    });

    return { arenaId: rematchId, code };
  },
});

export const getRoom = query({
  args: {
    arenaId: v.optional(v.id("arenas")),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const arena = await getArenaByLocator(ctx, args);
    if (!arena) return null;
    const playerIndex = findPlayerIndex(arena, userId);
    if (playerIndex < 0) return null;

    const question = await loadCurrentQuestion(ctx, arena);
    const includeQuestion =
      !!question &&
      (arena.phase === "question" ||
        arena.phase === "reveal" ||
        arena.phase === "round_break" ||
        arena.phase === "final");
    const includeCorrectAnswer = arena.phase !== "question";
    const currentQuestion = includeQuestion
      ? await sanitizeQuestion(ctx, question, includeCorrectAnswer)
      : null;

    const currentAnswers = await answersForQuestion(
      ctx,
      arena._id,
      arena.currentRound,
      arena.currentQuestionIndex,
    );
    const myCurrentAnswer = currentAnswers.find((answer) => answer.userId === userId);
    const revealAnswers =
      arena.phase === "question"
        ? []
        : currentAnswers.map((answer) => ({
            userId: answer.userId,
            answer: answer.answer,
            serverTimeMs: answer.serverTimeMs,
            correct: answer.correct,
            points: answer.points,
          }));

    const showRoundLeaderboard =
      arena.phase === "round_break" || arena.phase === "final";
    const roundLeaderboard = showRoundLeaderboard
      ? await buildRoundLeaderboard(ctx, arena, arena.currentRound)
      : null;

    return {
      arenaId: arena._id,
      code: arena.code,
      hostId: arena.hostId,
      mode: arena.mode,
      status: arena.status,
      phase: arena.phase,
      config: arena.config,
      currentRound: arena.currentRound,
      currentQuestionIndex: arena.currentQuestionIndex,
      players: arena.players.map((player) => ({
        userId: player.userId,
        nameSnapshot: player.nameSnapshot,
        team: player.team ?? null,
        ready: player.ready,
        left: player.left,
        totalScore: player.totalScore,
        isHost: player.userId === arena.hostId,
      })),
      currentQuestion,
      timer:
        arena.phase === "question"
          ? {
              serverNow: Date.now(),
              questionStartedAt: arena.questionStartedAt ?? null,
              questionWindowMs: arena.questionWindowMs,
            }
          : null,
      myCurrentAnswer: myCurrentAnswer
        ? {
            answer: myCurrentAnswer.answer,
            serverTimeMs: myCurrentAnswer.serverTimeMs,
          }
        : null,
      revealAnswers,
      roundLeaderboard,
      finalPodium: arena.phase === "final" ? buildFinalPodium(arena) : null,
      forceStartAvailableAt: arena.createdAt + FORCE_START_GRACE_MS,
      expiresAt: arena.expiresAt,
    };
  },
});

export const getArenaSummary = query({
  args: {
    arenaId: v.id("arenas"),
  },
  handler: async (ctx, { arenaId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const arena = await ctx.db.get(arenaId);
    if (!arena) return null;
    if (arena.status !== "final") return null;
    if (findPlayerIndex(arena, userId) < 0) return null;

    return await buildArenaSummary(ctx, arena);
  },
});

export const contentStatus = query({
  args: {},
  handler: async (ctx) => {
    return await getContentCounts(ctx);
  },
});

export const seedContentGaps = internalMutation({
  args: {},
  handler: async (ctx) => {
    const insertedCapitalCities = await ensureCapitalCitySeeds(ctx);
    return {
      insertedCapitalCities,
      ...(await getContentCounts(ctx)),
    };
  },
});

export const closeQuestion = internalMutation({
  args: {
    arenaId: v.id("arenas"),
    round: v.number(),
    questionIndex: v.number(),
  },
  handler: async (ctx, { arenaId, round, questionIndex }) => {
    const arena = await ctx.db.get(arenaId);
    if (!arena) return;
    await closeQuestionNow(ctx, arena, round, questionIndex);
  },
});

export const advanceRound = internalMutation({
  args: {
    arenaId: v.id("arenas"),
    expectedPhase: v.optional(v.string()),
    expectedRound: v.optional(v.number()),
    expectedQuestionIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const arena = await ctx.db.get(args.arenaId);
    if (!arena) return;
    if (args.expectedPhase && arena.phase !== args.expectedPhase) return;
    if (args.expectedRound !== undefined && arena.currentRound !== args.expectedRound) {
      return;
    }
    if (
      args.expectedQuestionIndex !== undefined &&
      arena.currentQuestionIndex !== args.expectedQuestionIndex
    ) {
      return;
    }
    await advanceArena(ctx, arena);
  },
});

export const expireStaleArenas = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const statuses: Arena["status"][] = ["lobby", "countdown", "active", "round_break"];
    let inspected = 0;
    let expired = 0;

    for (const status of statuses) {
      if (inspected >= EXPIRE_BATCH_SIZE) break;
      const arenas = await ctx.db
        .query("arenas")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(EXPIRE_BATCH_SIZE - inspected);
      inspected += arenas.length;
      for (const arena of arenas) {
        if (arena.expiresAt > now) continue;
        await ctx.db.patch(arena._id, {
          status: "abandoned",
          phase: "abandoned",
          questionStartedAt: undefined,
        });
        expired += 1;
      }
    }

    return { inspected, expired };
  },
});
