import { mutation, query, internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { orderAnswerOptions } from "./lib/answerOptions";
import { CAPITAL_CITY_QUESTIONS, LOGO_NAME_QUESTIONS, type StaticArenaQuestion } from "./multiplayerQuestionBanks";

export const QUESTIONS_PER_ROUND = 10;
export const QUESTION_TIME_LIMIT_MS = 10_000;
export const PARTY_FORMATS = {
  "1v1": { minPlayers: 2, maxPlayers: 2 },
  "2v2": { minPlayers: 4, maxPlayers: 4, teamSize: 2 },
  "1v1v1": { minPlayers: 3, maxPlayers: 3 },
  "1v1v1v1": { minPlayers: 4, maxPlayers: 4 },
  "1v1v1v1v1": { minPlayers: 5, maxPlayers: 5 },
} as const;

export const ARENA_ROUNDS = [
  { kind: "football_quiz", label: "Football Quiz", sport: "football", mode: "quiz" },
  { kind: "knowledge_quiz", label: "Knowledge Quiz", sport: "knowledge", mode: "quiz" },
  { kind: "which_came_first", label: "Which Came First", sport: "knowledge", mode: "came_first" },
  { kind: "logo_name", label: "Name the Logo", sport: "knowledge", mode: "logo_name" },
  { kind: "capital_city", label: "Capital Cities", sport: "knowledge", mode: "capital_city" },
] as const;
export const TOTAL_ARENA_QUESTIONS = ARENA_ROUNDS.length * QUESTIONS_PER_ROUND;

export const ARENA_STATUS_VALIDATORS = [v.literal("roundBreak")];

type PartyFormat = keyof typeof PARTY_FORMATS;
type ArenaQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string | null;
  checksum: string;
  roundKind: string;
  roundLabel: string;
};
type ArenaAnswer = {
  answer: string | null;
  correct: boolean;
  timeTaken: number;
  remainingMs: number;
  correctRank: number | null;
  rankMultiplier: number;
  score: number;
  answeredAt: number;
};

type PublicPlayer = { id: Id<"users">; username: string; displayName: string; team: number | null; ready: boolean };

function assertFormat(format: string): PartyFormat {
  if (!(format in PARTY_FORMATS)) throw new Error("Unsupported party format");
  return format as PartyFormat;
}

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function shuffle<T>(xs: T[], seed: string): T[] {
  const arr = [...xs];
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  for (let i = arr.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = Math.abs(h) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeStaticQuestions(kind: string, label: string, source: StaticArenaQuestion[], seed: string): ArenaQuestion[] {
  return shuffle(source, seed).slice(0, QUESTIONS_PER_ROUND).map((q) => ({
    ...q,
    options: orderAnswerOptions(q.options, q.correctAnswer, q.checksum),
    roundKind: kind,
    roundLabel: label,
  }));
}

async function currentUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  return { userId, user };
}

async function buildRoundQuestions(ctx: MutationCtx, round: (typeof ARENA_ROUNDS)[number], seed: string): Promise<ArenaQuestion[]> {
  if (round.kind === "capital_city") return makeStaticQuestions(round.kind, round.label, CAPITAL_CITY_QUESTIONS, seed);
  if (round.kind === "logo_name") return makeStaticQuestions(round.kind, round.label, LOGO_NAME_QUESTIONS, seed);

  const candidates = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_difficulty", (q) => q.eq("sport", round.sport).eq("difficulty", "intermediate"))
    .take(500);

  let filtered = candidates;
  if (round.kind === "which_came_first") {
    filtered = candidates.filter((q) => q.category === "which_came_first" || q.bucket === "which_came_first");
  } else if (round.kind === "knowledge_quiz") {
    filtered = candidates.filter((q) => q.category !== "which_came_first" && q.bucket !== "which_came_first");
  }

  const picked = shuffle(filtered, seed).slice(0, QUESTIONS_PER_ROUND).map((q) => ({
    question: q.question,
    options: orderAnswerOptions(q.options, q.correctAnswer, q.checksum),
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ?? null,
    checksum: q.checksum,
    roundKind: round.kind,
    roundLabel: round.label,
  }));

  if (picked.length >= QUESTIONS_PER_ROUND) return picked;
  const fallback = round.kind === "which_came_first" ? LOGO_NAME_QUESTIONS : CAPITAL_CITY_QUESTIONS;
  return [...picked, ...makeStaticQuestions(round.kind, round.label, fallback, seed).slice(0, QUESTIONS_PER_ROUND - picked.length)];
}

async function buildArenaQuestions(ctx: MutationCtx): Promise<ArenaQuestion[]> {
  const now = Date.now().toString();
  const rounds = await Promise.all(ARENA_ROUNDS.map((round, idx) => buildRoundQuestions(ctx, round, `${round.kind}:${now}:${idx}`)));
  return rounds.flat();
}

function ensureParticipant(match: Doc<"multiplayerMatches">, userId: Id<"users">) {
  if (!match.playerIds.some((id) => id === userId)) throw new Error("Not in this match");
}

function scoreArenaQuestion(args: { correct: boolean; answeredAt: number; questionStartedAt: number; correctRank: number; playerCount: number }): { score: number; remainingMs: number; rankMultiplier: number } {
  const elapsed = Math.max(0, args.answeredAt - args.questionStartedAt);
  const remainingMs = Math.max(0, QUESTION_TIME_LIMIT_MS - elapsed);
  if (!args.correct) return { score: 0, remainingMs, rankMultiplier: 0 };
  const rankMultiplier = Math.max(1, args.playerCount - args.correctRank + 1);
  return { score: Math.ceil((remainingMs / 100) * rankMultiplier), remainingMs, rankMultiplier };
}

function answersForQuestion(match: Doc<"multiplayerMatches">, questionIndex = match.currentQuestion): Record<string, ArenaAnswer> {
  const byQuestion = (match.answersByUserId ?? {}) as Record<string, Record<string, ArenaAnswer>>;
  return byQuestion[String(questionIndex)] ?? {};
}

function rankingsFor(match: Doc<"multiplayerMatches">, users: Map<string, Doc<"users"> | null>) {
  const scores = (match.scoresByUserId ?? {}) as Record<string, number>;
  return match.playerIds
    .map((id, idx) => ({
      userId: id,
      username: users.get(id)?.username ?? `Player ${idx + 1}`,
      displayName: users.get(id)?.displayName ?? users.get(id)?.username ?? `Player ${idx + 1}`,
      team: match.teamAssignments?.[idx] ?? null,
      score: scores[id] ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
    .map((r, idx) => ({ ...r, rank: idx + 1 }));
}

async function publicMatch(ctx: QueryCtx | MutationCtx, match: Doc<"multiplayerMatches">, userId: Id<"users">) {
  ensureParticipant(match, userId);
  const users = new Map<string, Doc<"users"> | null>();
  for (const id of match.playerIds) users.set(id, await ctx.db.get(id));
  const rankings = rankingsFor(match, users);
  const current = (match.questions as ArenaQuestion[])[match.currentQuestion];
  const currentAnswers = answersForQuestion(match);
  const players: PublicPlayer[] = match.playerIds.map((id, idx) => ({
    id,
    username: users.get(id)?.username ?? `Player ${idx + 1}`,
    displayName: users.get(id)?.displayName ?? users.get(id)?.username ?? `Player ${idx + 1}`,
    team: match.teamAssignments?.[idx] ?? null,
    ready: match.readyUserIds.some((readyId) => readyId === id),
  }));
  return {
    matchId: match._id,
    currentUserId: userId,
    joinCode: match.joinCode,
    format: match.format,
    status: match.status,
    minPlayers: match.minPlayers,
    maxPlayers: match.maxPlayers,
    teamSize: match.teamSize ?? null,
    players,
    readyUserIds: match.readyUserIds,
    roundBreakReadyUserIds: match.roundBreakReadyUserIds,
    currentQuestion: match.currentQuestion,
    currentRoundIndex: match.currentRoundIndex,
    totalQuestions: match.totalQuestions,
    questionStartedAt: match.questionStartedAt ?? null,
    round: ARENA_ROUNDS[match.currentRoundIndex],
    question: current && match.status === "question" ? { question: current.question, options: current.options, roundKind: current.roundKind, roundLabel: current.roundLabel } : null,
    myAnswer: currentAnswers[userId] ?? null,
    answeredUserIds: Object.keys(currentAnswers),
    rankings,
    podium: rankings.slice(0, 3),
    bottomRankings: rankings.slice(3),
    isHost: match.hostId === userId,
  };
}

export const createLobby = mutation({
  args: { format: v.string() },
  handler: async (ctx, { format }) => {
    const { userId } = await currentUser(ctx);
    const fmt = assertFormat(format);
    const spec = PARTY_FORMATS[fmt];
    const questions = await buildArenaQuestions(ctx);
    let joinCode = code();
    for (let i = 0; i < 5; i++) {
      const existing = await ctx.db.query("multiplayerMatches").withIndex("by_joinCode", (q) => q.eq("joinCode", joinCode)).first();
      if (!existing) break;
      joinCode = code();
    }
    const teamAssignments = fmt === "2v2" ? [1] : undefined;
    const now = Date.now();
    const matchId = await ctx.db.insert("multiplayerMatches", {
      hostId: userId,
      joinCode,
      format: fmt,
      minPlayers: spec.minPlayers,
      maxPlayers: spec.maxPlayers,
      teamSize: "teamSize" in spec ? spec.teamSize : undefined,
      playerIds: [userId],
      teamAssignments,
      readyUserIds: [],
      roundBreakReadyUserIds: [],
      status: "lobby",
      currentQuestion: 0,
      currentRoundIndex: 0,
      totalQuestions: TOTAL_ARENA_QUESTIONS,
      questions,
      answersByUserId: {},
      scoresByUserId: { [userId]: 0 },
      createdAt: now,
      updatedAt: now,
    });
    return { matchId, joinCode };
  },
});

export const joinByCode = mutation({
  args: { joinCode: v.string() },
  handler: async (ctx, { joinCode }) => {
    const { userId } = await currentUser(ctx);
    const match = await ctx.db.query("multiplayerMatches").withIndex("by_joinCode", (q) => q.eq("joinCode", joinCode.trim().toUpperCase())).first();
    if (!match) throw new Error("Arena not found");
    if (match.status !== "lobby") throw new Error("Arena already started");
    if (match.playerIds.some((id) => id === userId)) return { matchId: match._id };
    if (match.playerIds.length >= match.maxPlayers) throw new Error("Arena is full");
    const teamAssignments = match.format === "2v2" ? [...(match.teamAssignments ?? []), match.playerIds.length < 2 ? 1 : 2] : match.teamAssignments;
    await ctx.db.patch(match._id, {
      playerIds: [...match.playerIds, userId],
      teamAssignments,
      scoresByUserId: { ...((match.scoresByUserId ?? {}) as Record<string, number>), [userId]: 0 },
      updatedAt: Date.now(),
    });
    return { matchId: match._id };
  },
});

export const setReady = mutation({
  args: { matchId: v.id("multiplayerMatches") },
  handler: async (ctx, { matchId }) => {
    const { userId } = await currentUser(ctx);
    const match = await ctx.db.get(matchId);
    if (!match) throw new Error("Arena not found");
    ensureParticipant(match, userId);
    if (match.status === "lobby") {
      const readyUserIds = uniq([...match.readyUserIds, userId]);
      const everyoneReady = match.playerIds.length >= match.minPlayers && readyUserIds.length === match.playerIds.length;
      await ctx.db.patch(matchId, { readyUserIds, updatedAt: Date.now() });
      if (everyoneReady) await startQuestion(ctx, matchId, 0, 0);
      return;
    }
    if (match.status === "roundBreak") {
      const roundBreakReadyUserIds = uniq([...match.roundBreakReadyUserIds, userId]);
      await ctx.db.patch(matchId, { roundBreakReadyUserIds, updatedAt: Date.now() });
      const allRoundBreakReady = roundBreakReadyUserIds.length === match.playerIds.length;
      if (allRoundBreakReady) await startQuestion(ctx, matchId, match.currentQuestion + 1, match.currentRoundIndex + 1);
    }
  },
});

async function startQuestion(ctx: MutationCtx, matchId: Id<"multiplayerMatches">, questionIndex: number, roundIndex: number) {
  const now = Date.now();
  await ctx.db.patch(matchId, {
    status: "question",
    currentQuestion: questionIndex,
    currentRoundIndex: roundIndex,
    questionStartedAt: now,
    roundBreakReadyUserIds: [],
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(QUESTION_TIME_LIMIT_MS + 500, internal.multiplayerMatches.checkTimeout, { matchId, questionIndex });
}

export const submitAnswer = mutation({
  args: { matchId: v.id("multiplayerMatches"), answer: v.string() },
  handler: async (ctx, { matchId, answer }) => {
    const { userId } = await currentUser(ctx);
    const match = await ctx.db.get(matchId);
    if (!match) throw new Error("Arena not found");
    ensureParticipant(match, userId);
    if (match.status !== "question" || !match.questionStartedAt) throw new Error("No active question");
    const question = (match.questions as ArenaQuestion[])[match.currentQuestion];
    const byQuestion = (match.answersByUserId ?? {}) as Record<string, Record<string, ArenaAnswer>>;
    const currentAnswers = { ...(byQuestion[String(match.currentQuestion)] ?? {}) };
    if (currentAnswers[userId]) return currentAnswers[userId];
    const correct = answer === question.correctAnswer;
    const alreadyCorrect = Object.values(currentAnswers).filter((a) => a.correct).length;
    const correctRank = correct ? alreadyCorrect + 1 : null;
    const answeredAt = Date.now();
    const scored = scoreArenaQuestion({ correct, answeredAt, questionStartedAt: match.questionStartedAt, correctRank: correctRank ?? match.playerIds.length, playerCount: match.playerIds.length });
    const entry: ArenaAnswer = { answer, correct, timeTaken: (answeredAt - match.questionStartedAt) / 1000, correctRank, answeredAt, ...scored };
    currentAnswers[userId] = entry;
    const scoresByUserId = { ...((match.scoresByUserId ?? {}) as Record<string, number>) };
    scoresByUserId[userId] = (scoresByUserId[userId] ?? 0) + entry.score;
    await ctx.db.patch(matchId, {
      answersByUserId: { ...byQuestion, [String(match.currentQuestion)]: currentAnswers },
      scoresByUserId,
      updatedAt: Date.now(),
    });
    if (Object.keys(currentAnswers).length === match.playerIds.length) await advanceAfterQuestion(ctx, matchId, match.currentQuestion);
    return entry;
  },
});

async function advanceAfterQuestion(ctx: MutationCtx, matchId: Id<"multiplayerMatches">, questionIndex: number) {
  const match = await ctx.db.get(matchId);
  if (!match || match.status !== "question" || match.currentQuestion !== questionIndex) return;
  const nextQuestion = questionIndex + 1;
  const now = Date.now();
  if (nextQuestion >= TOTAL_ARENA_QUESTIONS) {
    await ctx.db.patch(matchId, { status: "completed", completedAt: now, updatedAt: now });
    return;
  }
  if (nextQuestion % QUESTIONS_PER_ROUND === 0) {
    await ctx.db.patch(matchId, { status: "roundBreak", roundBreakStartedAt: now, roundBreakReadyUserIds: [], updatedAt: now });
    return;
  }
  await startQuestion(ctx, matchId, nextQuestion, Math.floor(nextQuestion / QUESTIONS_PER_ROUND));
}

export const checkTimeout = internalMutation({
  args: { matchId: v.id("multiplayerMatches"), questionIndex: v.number() },
  handler: async (ctx, { matchId, questionIndex }) => {
    const match = await ctx.db.get(matchId);
    if (!match || match.status !== "question" || match.currentQuestion !== questionIndex || !match.questionStartedAt) return;
    const byQuestion = (match.answersByUserId ?? {}) as Record<string, Record<string, ArenaAnswer>>;
    const currentAnswers = { ...(byQuestion[String(questionIndex)] ?? {}) };
    const now = Date.now();
    for (const userId of match.playerIds) {
      if (!currentAnswers[userId]) currentAnswers[userId] = { answer: null, correct: false, timeTaken: QUESTION_TIME_LIMIT_MS / 1000, remainingMs: 0, correctRank: null, rankMultiplier: 0, score: 0, answeredAt: now };
    }
    await ctx.db.patch(matchId, { answersByUserId: { ...byQuestion, [String(questionIndex)]: currentAnswers }, updatedAt: now });
    await advanceAfterQuestion(ctx, matchId, questionIndex);
  },
});

export const getMatch = query({
  args: { matchId: v.id("multiplayerMatches") },
  handler: async (ctx, { matchId }) => {
    const { userId } = await currentUser(ctx);
    const match = await ctx.db.get(matchId);
    if (!match) return null;
    return publicMatch(ctx, match, userId);
  },
});

export const getActiveMatch = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await currentUser(ctx);
    const activeStatuses: Array<Doc<"multiplayerMatches">["status"]> = ["lobby", "question", "roundBreak"];
    for (const status of activeStatuses) {
      const hosted = await ctx.db.query("multiplayerMatches").withIndex("by_host_status", (q) => q.eq("hostId", userId).eq("status", status)).first();
      if (hosted && hosted.playerIds.some((id) => id === userId)) return hosted._id;
    }
    const candidates = await ctx.db.query("multiplayerMatches").collect();
    const found = candidates.find((m) => activeStatuses.includes(m.status) && m.playerIds.some((id) => id === userId));
    return found?._id ?? null;
  },
});
