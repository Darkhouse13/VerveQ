import {
  internalMutation,
  internalQuery,
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
import { matchLogoGuess } from "./lib/logoTextAnswers";
import { orderAnswerOptions } from "./lib/answerOptions";
import {
  composeLocalizedQuestion,
  fetchQuestionTranslation,
} from "./lib/contentI18n";
import { assertUsernameRequiredUser } from "./lib/authz";
import {
  challengeArenaCapitalCityQuestions,
  challengeArenaEnterpriseLogoQuestions,
  challengeArenaGeneralKnowledgeQuestions,
  challengeArenaWhichCameFirstQuestions,
  type ChallengeArenaQuestionSeed,
} from "./challengeArenaContent";
import {
  ARENA_CIE_SPORT,
  arenaCieSeedPlan,
  type ArenaCiePlannedRow,
} from "./challengeArenaCieContent";
import { contentDuplicateKey } from "./lib/contentQa";

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
const FOOTBALL_IMAGE_QUESTION_CAP = 2;
const RECENTLY_SEEN_WINDOW_COUNT = ARENA_ROUNDS * QUESTIONS_PER_ROUND * 2;
const RECENTLY_SEEN_WINDOW_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const INDEXED_POOL_PAGE_SIZE = 64;
const INDEXED_POOL_MAX_READS = 192;
const FOOTBALL_IMAGE_CANDIDATE_MAX_READS = 16;
const SEED_BACKED_MAX_READS = 96;
const SEED_CONTENT_BATCH_SIZE = 250;
const SEED_CONTENT_MAX_BATCH_SIZE = 500;
const CONTENT_STATUS_KNOWLEDGE_READ_CAP = 3_000;
const CONTENT_STATUS_FOOTBALL_READ_CAP = 750;
const CONTENT_STATUS_CIE_READ_CAP = 3_000;
const CHECKSUM_CURSOR_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789_";
const NUMERIC_CURSOR_ALPHABET = "0123456789";

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
  "enterprise_logos",
  "capital_cities",
] as const;

const SEED_CONTENT_GROUPS: Array<{
  key: SeedContentCategory;
  insertedKey:
    | "insertedCapitalCities"
    | "insertedGeneralKnowledge"
    | "insertedWhichCameFirst"
    | "insertedEnterpriseLogos";
  seeds: ChallengeArenaQuestionSeed[];
}> = [
  {
    key: "capitalCities",
    insertedKey: "insertedCapitalCities",
    seeds: challengeArenaCapitalCityQuestions,
  },
  {
    key: "generalKnowledge",
    insertedKey: "insertedGeneralKnowledge",
    seeds: challengeArenaGeneralKnowledgeQuestions,
  },
  {
    key: "whichCameFirst",
    insertedKey: "insertedWhichCameFirst",
    seeds: challengeArenaWhichCameFirstQuestions,
  },
  {
    key: "enterpriseLogos",
    insertedKey: "insertedEnterpriseLogos",
    seeds: challengeArenaEnterpriseLogoQuestions,
  },
];

type Arena = Doc<"arenas">;
type ArenaAnswer = Doc<"arenaAnswers">;
type ArenaPlayer = Arena["players"][number];
type ArenaMode = Arena["mode"];
type Question = Doc<"quizQuestions">;
type QuestionKind = "mcq" | "which_came_first" | "logo_text";
type RecentlySeenMap = Map<string, number>;
type SeedContentCategory =
  | "capitalCities"
  | "generalKnowledge"
  | "whichCameFirst"
  | "enterpriseLogos";
type SeedCursor = {
  categoryIndex: number;
  offset: number;
};
type IndexedCandidateScope = {
  sport: string;
  category?: string;
  media?: "text" | "imageId" | "imageUrl";
  cursorPrefix?: string;
  cursorAlphabet?: string;
};
type IndexedCandidateOptions = {
  maxReads?: number;
};
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

function hasQuestionImage(question: Question) {
  return !!question.imageId || !!question.imageUrl;
}

function isValidLogoQuestion(question: Question) {
  return (
    question.category === "badge_identification" &&
    !!question.imageId &&
    isAnswerableMcq(question)
  );
}

function questionKind(question: Question): QuestionKind {
  if (
    question.questionKind === "logo_text" ||
    question.category === "enterprise_logos"
  ) {
    return "logo_text";
  }
  if (
    question.questionKind === "which_came_first" ||
    question.category === "which_came_first"
  ) {
    return "which_came_first";
  }
  return "mcq";
}

function isLogoTextQuestion(question: Question) {
  return (
    questionKind(question) === "logo_text" &&
    question.category === "enterprise_logos" &&
    !!question.imageUrl &&
    question.correctAnswer.trim().length > 0
  );
}

function isFootballQuizQuestion(question: Question) {
  return (
    question.category !== "which_came_first" &&
    question.category !== "badge_identification" &&
    isAnswerableMcq(question)
  );
}

function isFootballTextQuestion(question: Question) {
  return isFootballQuizQuestion(question) && !hasQuestionImage(question);
}

function isFootballImageQuestion(question: Question) {
  return isFootballQuizQuestion(question) && hasQuestionImage(question);
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

function checksumCursor(
  seed: string,
  attempt: number,
  prefix = "",
  alphabet = CHECKSUM_CURSOR_ALPHABET,
) {
  const rand = seededRandom(`${seed}:cursor:${attempt}`);
  let cursor = prefix;
  for (let i = 0; i < 12; i += 1) {
    cursor += alphabet[Math.floor(rand() * alphabet.length)];
  }
  return cursor;
}

async function takeSportChecksumWindow(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  sport: string,
  cursor: string,
  limit: number,
) {
  const forward = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_checksum", (q) =>
      q.eq("sport", sport).gte("checksum", cursor),
    )
    .take(limit);
  if (forward.length >= limit) return forward;

  const wrapped = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_checksum", (q) =>
      q.eq("sport", sport).lt("checksum", cursor),
    )
    .take(limit - forward.length);
  return [...forward, ...wrapped];
}

async function takeSportCategoryChecksumWindow(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  sport: string,
  category: string,
  cursor: string,
  limit: number,
) {
  const forward = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_category_checksum", (q) =>
      q.eq("sport", sport).eq("category", category).gte("checksum", cursor),
    )
    .take(limit);
  if (forward.length >= limit) return forward;

  const wrapped = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_category_checksum", (q) =>
      q.eq("sport", sport).eq("category", category).lt("checksum", cursor),
    )
    .take(limit - forward.length);
  return [...forward, ...wrapped];
}

async function takeSportTextChecksumWindow(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  sport: string,
  cursor: string,
  limit: number,
) {
  const forward = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_imageId_imageUrl_checksum", (q) =>
      q
        .eq("sport", sport)
        .eq("imageId", undefined)
        .eq("imageUrl", undefined)
        .gte("checksum", cursor),
    )
    .take(limit);
  if (forward.length >= limit) return forward;

  const wrapped = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_imageId_imageUrl_checksum", (q) =>
      q
        .eq("sport", sport)
        .eq("imageId", undefined)
        .eq("imageUrl", undefined)
        .lt("checksum", cursor),
    )
    .take(limit - forward.length);
  return [...forward, ...wrapped];
}

async function takeSportImageIdWindow(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  sport: string,
  cursor: string,
  limit: number,
) {
  const imageIdCursor = cursor as Id<"_storage">;
  const minImageId = "" as Id<"_storage">;
  const forward = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_imageId_imageUrl_checksum", (q) =>
      q.eq("sport", sport).gt("imageId", imageIdCursor),
    )
    .take(limit);
  if (forward.length >= limit) return forward;

  const wrapped = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_imageId_imageUrl_checksum", (q) =>
      q
        .eq("sport", sport)
        .gt("imageId", minImageId)
        .lt("imageId", imageIdCursor),
    )
    .take(limit - forward.length);
  return [...forward, ...wrapped];
}

async function takeSportImageUrlWindow(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  sport: string,
  cursor: string,
  limit: number,
) {
  const forward = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_imageId_imageUrl_checksum", (q) =>
      q.eq("sport", sport).eq("imageId", undefined).gt("imageUrl", cursor),
    )
    .take(limit);
  if (forward.length >= limit) return forward;

  const wrapped = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_imageId_imageUrl_checksum", (q) =>
      q
        .eq("sport", sport)
        .eq("imageId", undefined)
        .gt("imageUrl", "")
        .lt("imageUrl", cursor),
    )
    .take(limit - forward.length);
  return [...forward, ...wrapped];
}

async function collectIndexedCandidates(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  scope: IndexedCandidateScope,
  seed: string,
  used: Set<string>,
  predicate: (question: Question) => boolean,
  targetCandidates: number,
  options: IndexedCandidateOptions = {},
) {
  const byChecksum = new Map<string, Question>();
  let remainingReads = options.maxReads ?? INDEXED_POOL_MAX_READS;

  for (
    let attempt = 0;
    byChecksum.size < targetCandidates && remainingReads > 0;
    attempt += 1
  ) {
    const before = byChecksum.size;
    const limit = Math.min(INDEXED_POOL_PAGE_SIZE, remainingReads);
    const cursor = checksumCursor(
      seed,
      attempt,
      scope.cursorPrefix ?? "",
      scope.cursorAlphabet,
    );
    const rows =
      scope.media === "text"
        ? await takeSportTextChecksumWindow(ctx, scope.sport, cursor, limit)
        : scope.media === "imageId"
          ? await takeSportImageIdWindow(ctx, scope.sport, cursor, limit)
          : scope.media === "imageUrl"
            ? await takeSportImageUrlWindow(ctx, scope.sport, cursor, limit)
        : scope.category
          ? await takeSportCategoryChecksumWindow(
              ctx,
              scope.sport,
              scope.category,
              cursor,
              limit,
            )
          : await takeSportChecksumWindow(ctx, scope.sport, cursor, limit);
    remainingReads -= rows.length;

    for (const question of rows) {
      if (!used.has(question.checksum) && predicate(question)) {
        byChecksum.set(question.checksum, question);
      }
    }

    if (rows.length < limit || byChecksum.size === before) break;
  }

  return [...byChecksum.values()].sort((a, b) =>
    a.checksum.localeCompare(b.checksum),
  );
}

async function readQuestionByChecksum(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  checksum: string,
) {
  return await ctx.db
    .query("quizQuestions")
    .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
    .first();
}

function uniqueStableSeeds(
  seeds: ChallengeArenaQuestionSeed[],
  used: Set<string>,
) {
  const byChecksum = new Map<string, ChallengeArenaQuestionSeed>();
  for (const seed of seeds) {
    if (!used.has(seed.checksum)) byChecksum.set(seed.checksum, seed);
  }
  return [...byChecksum.values()].sort((a, b) =>
    a.checksum.localeCompare(b.checksum),
  );
}

async function collectSeedBackedCandidates(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  seeds: ChallengeArenaQuestionSeed[],
  used: Set<string>,
  recentlySeen: RecentlySeenMap,
  seed: string,
  predicate: (question: Question) => boolean,
) {
  const base = uniqueStableSeeds(seeds, used);
  const eligible = applyRecentlySeenExclusion(
    base,
    recentlySeen,
    QUESTIONS_PER_ROUND,
  );
  const eligibleChecksums = new Set(eligible.map((candidate) => candidate.checksum));
  const readOrder = [
    ...seededShuffle(eligible, seed),
    ...seededShuffle(
      base.filter((candidate) => !eligibleChecksums.has(candidate.checksum)),
      `${seed}:overflow`,
    ),
  ].slice(0, SEED_BACKED_MAX_READS);

  const questions: Question[] = [];
  for (const candidate of readOrder) {
    const question = await readQuestionByChecksum(ctx, candidate.checksum);
    if (question && !used.has(question.checksum) && predicate(question)) {
      questions.push(question);
      if (questions.length >= QUESTIONS_PER_ROUND) break;
    }
  }
  return questions;
}

function questionSeedDocument(seed: ChallengeArenaQuestionSeed) {
  return {
    sport: seed.sport,
    category: seed.category,
    question: seed.question,
    options: seed.options,
    correctAnswer: seed.correctAnswer,
    ...(seed.acceptedAliases ? { acceptedAliases: seed.acceptedAliases } : {}),
    ...(seed.explanation ? { explanation: seed.explanation } : {}),
    ...(seed.questionKind ? { questionKind: seed.questionKind } : {}),
    difficulty: seed.difficulty,
    bucket: seed.bucket,
    checksum: seed.checksum,
    ...(seed.imageUrl ? { imageUrl: seed.imageUrl } : {}),
  };
}

async function upsertQuestionSeed(
  ctx: Pick<MutationCtx, "db">,
  seed: ChallengeArenaQuestionSeed,
) {
  const existing = await ctx.db
    .query("quizQuestions")
    .withIndex("by_checksum", (q) => q.eq("checksum", seed.checksum))
    .first();
  const doc = questionSeedDocument(seed);
  if (existing) {
    await ctx.db.patch(existing._id, doc);
    return false;
  }

  await ctx.db.insert("quizQuestions", {
    ...doc,
    difficultyVotes: 0,
    difficultyScore: 0,
    timesAnswered: 0,
    timesCorrect: 0,
    usageCount: 0,
  });
  return true;
}

function parseSeedCursor(cursor: string | undefined): SeedCursor {
  if (!cursor) return { categoryIndex: 0, offset: 0 };
  const [categoryIndexRaw, offsetRaw] = cursor.split(":");
  const categoryIndex = Number(categoryIndexRaw);
  const offset = Number(offsetRaw);
  if (
    !Number.isInteger(categoryIndex) ||
    !Number.isInteger(offset) ||
    categoryIndex < 0 ||
    categoryIndex > SEED_CONTENT_GROUPS.length ||
    offset < 0
  ) {
    throw new Error("Invalid challenge arena seed cursor");
  }
  return { categoryIndex, offset };
}

function encodeSeedCursor(cursor: SeedCursor) {
  return `${cursor.categoryIndex}:${cursor.offset}`;
}

function emptySeedInsertCounts() {
  return {
    insertedCapitalCities: 0,
    insertedGeneralKnowledge: 0,
    insertedWhichCameFirst: 0,
    insertedEnterpriseLogos: 0,
  };
}

async function ensureQuestionSeedBatch(
  ctx: Pick<MutationCtx, "db">,
  startCursor: SeedCursor,
  batchLimit: number,
) {
  const inserted = emptySeedInsertCounts();
  let processed = 0;
  let categoryIndex = startCursor.categoryIndex;
  let offset = startCursor.offset;

  while (categoryIndex < SEED_CONTENT_GROUPS.length && processed < batchLimit) {
    const group = SEED_CONTENT_GROUPS[categoryIndex];
    if (offset >= group.seeds.length) {
      categoryIndex += 1;
      offset = 0;
      continue;
    }

    const remaining = batchLimit - processed;
    const end = Math.min(group.seeds.length, offset + remaining);
    for (const seed of group.seeds.slice(offset, end)) {
      if (await upsertQuestionSeed(ctx, seed)) {
        inserted[group.insertedKey] += 1;
      }
    }

    processed += end - offset;
    offset = end;
    if (offset >= group.seeds.length) {
      categoryIndex += 1;
      offset = 0;
    }
  }

  const isDone = categoryIndex >= SEED_CONTENT_GROUPS.length;
  return {
    ...inserted,
    processed,
    nextCursor: isDone ? null : encodeSeedCursor({ categoryIndex, offset }),
    isDone,
  };
}

function uniqueStableQuestionCandidates(
  questions: Question[],
  used: Set<string>,
  predicate: (question: Question) => boolean,
) {
  const byChecksum = new Map<string, Question>();
  for (const question of questions) {
    if (!used.has(question.checksum) && predicate(question)) {
      byChecksum.set(question.checksum, question);
    }
  }
  return [...byChecksum.values()].sort((a, b) =>
    a.checksum.localeCompare(b.checksum),
  );
}

function oldestRecentlySeenCandidates<T extends { checksum: string }>(
  candidates: T[],
  recentlySeen: RecentlySeenMap,
) {
  return candidates
    .filter((candidate) => recentlySeen.has(candidate.checksum))
    .sort(
      (a, b) =>
        (recentlySeen.get(a.checksum) ?? 0) -
          (recentlySeen.get(b.checksum) ?? 0) ||
        a.checksum.localeCompare(b.checksum),
    );
}

function applyRecentlySeenExclusion<T extends { checksum: string }>(
  candidates: T[],
  recentlySeen: RecentlySeenMap,
  needed: number,
) {
  if (recentlySeen.size === 0) return candidates;

  const included = candidates.filter(
    (candidate) => !recentlySeen.has(candidate.checksum),
  );
  if (included.length >= needed) return included;

  included.push(
    ...oldestRecentlySeenCandidates(candidates, recentlySeen).slice(
      0,
      needed - included.length,
    ),
  );
  const includedChecksums = new Set(
    included.map((candidate) => candidate.checksum),
  );
  return candidates.filter((candidate) =>
    includedChecksums.has(candidate.checksum),
  );
}

function recentlySeenCountForScopes(
  recentlySeen: RecentlySeenMap,
  scopes: IndexedCandidateScope[],
  fallbackSeeds?: ChallengeArenaQuestionSeed[],
) {
  if (recentlySeen.size === 0) return 0;

  const fallbackChecksums = fallbackSeeds
    ? new Set(fallbackSeeds.map((seed) => seed.checksum))
    : null;
  const cursorPrefixes = scopes
    .map((scope) => scope.cursorPrefix)
    .filter((prefix): prefix is string => !!prefix);
  let count = 0;
  for (const checksum of recentlySeen.keys()) {
    if (
      fallbackChecksums?.has(checksum) ||
      cursorPrefixes.some((prefix) => checksum.startsWith(prefix))
    ) {
      count += 1;
    }
  }
  return count;
}

function footballRoundCapacity(candidates: Question[]) {
  const imageCount = candidates.filter(hasQuestionImage).length;
  return (
    candidates.length -
    imageCount +
    Math.min(imageCount, FOOTBALL_IMAGE_QUESTION_CAP)
  );
}

function applyRecentlySeenFootballExclusion(
  candidates: Question[],
  recentlySeen: RecentlySeenMap,
) {
  if (recentlySeen.size === 0) return candidates;

  const included = candidates.filter(
    (candidate) => !recentlySeen.has(candidate.checksum),
  );
  if (footballRoundCapacity(included) >= QUESTIONS_PER_ROUND) return included;

  for (const candidate of oldestRecentlySeenCandidates(candidates, recentlySeen)) {
    included.push(candidate);
    if (footballRoundCapacity(included) >= QUESTIONS_PER_ROUND) break;
  }

  const includedChecksums = new Set(
    included.map((candidate) => candidate.checksum),
  );
  return candidates.filter((candidate) =>
    includedChecksums.has(candidate.checksum),
  );
}

async function pickSeedBackedChecksums(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  seeds: ChallengeArenaQuestionSeed[],
  used: Set<string>,
  recentlySeen: RecentlySeenMap,
  seed: string,
  label: string,
  predicate: (question: Question) => boolean = isAnswerableMcq,
) {
  const picked = await collectSeedBackedCandidates(
    ctx,
    seeds,
    used,
    recentlySeen,
    seed,
    predicate,
  );
  if (picked.length < QUESTIONS_PER_ROUND) {
    throw new Error(
      `Not enough challenge arena questions for ${label}: ${picked.length}/${QUESTIONS_PER_ROUND}`,
    );
  }
  for (const question of picked) used.add(question.checksum);
  return picked.map((question) => question.checksum);
}

async function pickIndexedChecksums(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  scopes: IndexedCandidateScope[],
  used: Set<string>,
  recentlySeen: RecentlySeenMap,
  seed: string,
  label: string,
  predicate: (question: Question) => boolean,
  fallbackSeeds?: ChallengeArenaQuestionSeed[],
) {
  const relevantRecentlySeen = recentlySeenCountForScopes(
    recentlySeen,
    scopes,
    fallbackSeeds,
  );
  const targetCandidates =
    QUESTIONS_PER_ROUND + Math.min(relevantRecentlySeen, 40) + 32;
  const questions: Question[] = [];
  for (const [scopeIndex, scope] of scopes.entries()) {
    questions.push(
      ...(await collectIndexedCandidates(
        ctx,
        scope,
        scopeIndex === 0 ? seed : `${seed}:scope${scopeIndex}`,
        used,
        predicate,
        targetCandidates,
      )),
    );
  }
  const candidates = applyRecentlySeenExclusion(
    uniqueStableQuestionCandidates(questions, used, predicate),
    recentlySeen,
    QUESTIONS_PER_ROUND,
  );
  const picked = seededShuffle(candidates, seed).slice(0, QUESTIONS_PER_ROUND);
  if (picked.length >= QUESTIONS_PER_ROUND) {
    for (const question of picked) used.add(question.checksum);
    return picked.map((question) => question.checksum);
  }

  if (fallbackSeeds) {
    return await pickSeedBackedChecksums(
      ctx,
      fallbackSeeds,
      used,
      recentlySeen,
      `${seed}:seedFallback`,
      label,
      predicate,
    );
  }

  throw new Error(
    `Not enough challenge arena questions for ${label}: ${picked.length}/${QUESTIONS_PER_ROUND}`,
  );
}

async function pickFootballChecksums(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  used: Set<string>,
  recentlySeen: RecentlySeenMap,
  seed: string,
  label: string,
) {
  const footballScope = { sport: "football", cursorPrefix: "football_" };
  const relevantRecentlySeen = recentlySeenCountForScopes(recentlySeen, [
    footballScope,
  ]);
  const targetTextCandidates =
    QUESTIONS_PER_ROUND +
    Math.min(relevantRecentlySeen, 40) +
    32;
  const targetImageCandidates =
    FOOTBALL_IMAGE_QUESTION_CAP + Math.min(relevantRecentlySeen, 8) + 8;
  const textQuestions = await collectIndexedCandidates(
    ctx,
    { sport: "football", media: "text", cursorPrefix: "football_" },
    `${seed}:text`,
    used,
    isFootballTextQuestion,
    targetTextCandidates,
  );
  const imageIdQuestions = await collectIndexedCandidates(
    ctx,
    { sport: "football", media: "imageId" },
    `${seed}:imageId`,
    used,
    isFootballImageQuestion,
    targetImageCandidates,
    { maxReads: FOOTBALL_IMAGE_CANDIDATE_MAX_READS },
  );
  const imageUrlQuestions =
    imageIdQuestions.length >= FOOTBALL_IMAGE_QUESTION_CAP
      ? []
      : await collectIndexedCandidates(
          ctx,
          { sport: "football", media: "imageUrl" },
          `${seed}:imageUrl`,
          used,
          isFootballImageQuestion,
          targetImageCandidates,
          { maxReads: FOOTBALL_IMAGE_CANDIDATE_MAX_READS },
        );
  const candidates = seededShuffle(
    applyRecentlySeenFootballExclusion(
      uniqueStableQuestionCandidates(
        [...textQuestions, ...imageIdQuestions, ...imageUrlQuestions],
        used,
        isFootballQuizQuestion,
      ),
      recentlySeen,
    ),
    seed,
  );
  const imagePicked = candidates
    .filter(hasQuestionImage)
    .slice(0, FOOTBALL_IMAGE_QUESTION_CAP);
  const textPicked = candidates
    .filter((question) => !hasQuestionImage(question))
    .slice(0, QUESTIONS_PER_ROUND - imagePicked.length);
  const picked = seededShuffle([...imagePicked, ...textPicked], `${seed}:order`);

  if (picked.length < QUESTIONS_PER_ROUND) {
    throw new Error(
      `Not enough challenge arena text questions for ${label}: ${textPicked.length}/${QUESTIONS_PER_ROUND - imagePicked.length}`,
    );
  }
  if (picked.filter(hasQuestionImage).length > FOOTBALL_IMAGE_QUESTION_CAP) {
    throw new Error(`Too many image questions selected for ${label}`);
  }

  for (const question of picked) {
    used.add(question.checksum);
  }
  return picked.map((question) => question.checksum);
}

async function loadCrewRecentlySeenChecksums(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  userIds: Id<"users">[],
  now: number,
) {
  const cutoff = now - RECENTLY_SEEN_WINDOW_AGE_MS;
  const recentlySeen: RecentlySeenMap = new Map();

  for (const userId of userIds) {
    const rows = await ctx.db
      .query("arenaRecentlySeenQuestions")
      .withIndex("by_user_seen_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(RECENTLY_SEEN_WINDOW_COUNT);
    const windowRows = rows
      .filter((row) => row.seenAt >= cutoff)
      .sort(
        (a, b) =>
          b.seenAt - a.seenAt ||
          a.checksum.localeCompare(b.checksum) ||
          String(a._id).localeCompare(String(b._id)),
      )
      .slice(0, RECENTLY_SEEN_WINDOW_COUNT);

    for (const row of windowRows) {
      recentlySeen.set(
        row.checksum,
        Math.max(recentlySeen.get(row.checksum) ?? 0, row.seenAt),
      );
    }
  }

  return recentlySeen;
}

async function pruneRecentlySeenForUser(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  _now: number,
) {
  const rows = await ctx.db
    .query("arenaRecentlySeenQuestions")
    .withIndex("by_user_seen_at", (q) => q.eq("userId", userId))
    .order("desc")
    .take(RECENTLY_SEEN_WINDOW_COUNT + QUESTIONS_PER_ROUND + 1);
  const keepIds = new Set(
    rows
      .sort(
        (a, b) =>
          b.seenAt - a.seenAt ||
          a.checksum.localeCompare(b.checksum) ||
          String(a._id).localeCompare(String(b._id)),
      )
      .slice(0, RECENTLY_SEEN_WINDOW_COUNT)
      .map((row) => row._id),
  );

  for (const row of rows) {
    if (!keepIds.has(row._id)) {
      await ctx.db.delete(row._id);
    }
  }
}

async function recordRecentlySeenArenaQuestions(
  ctx: Pick<MutationCtx, "db">,
  userIds: Id<"users">[],
  checksums: string[],
  seenAt: number,
) {
  const uniqueChecksums = [...new Set(checksums)];
  for (const userId of userIds) {
    for (const checksum of uniqueChecksums) {
      const existing = await ctx.db
        .query("arenaRecentlySeenQuestions")
        .withIndex("by_user_checksum", (q) =>
          q.eq("userId", userId).eq("checksum", checksum),
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { seenAt });
      } else {
        await ctx.db.insert("arenaRecentlySeenQuestions", {
          userId,
          checksum,
          seenAt,
        });
      }
    }
    await pruneRecentlySeenForUser(ctx, userId, seenAt);
  }
}

async function lockRoundQuestionSets(
  ctx: Pick<MutationCtx, "db">,
  seed: string,
  playerIds: Id<"users">[],
  now: number,
) {
  const recentlySeen = await loadCrewRecentlySeenChecksums(ctx, playerIds, now);
  const used = new Set<string>();
  const categories: string[] = [];
  const rounds: string[][] = [];

  for (const category of DEFAULT_ROUND_CATEGORIES) {
    if (category === "football_quiz") {
      rounds.push(
        await pickFootballChecksums(
          ctx,
          used,
          recentlySeen,
          `${seed}:${category}`,
          "football quiz",
        ),
      );
      categories.push(category);
      continue;
    }

    if (category === "general_knowledge") {
      rounds.push(
        await pickIndexedChecksums(
          ctx,
          [
            { sport: "knowledge", cursorPrefix: "knowledge_" },
            { sport: ARENA_CIE_SPORT, cursorPrefix: "knowledge_" },
          ],
          used,
          recentlySeen,
          `${seed}:${category}`,
          "general knowledge",
          (question) =>
            question.category !== "which_came_first" &&
            question.category !== "enterprise_logos" &&
            question.category !== "capital_cities" &&
            isAnswerableMcq(question),
          challengeArenaGeneralKnowledgeQuestions,
        ),
      );
      categories.push(category);
      continue;
    }

    if (category === "which_came_first") {
      rounds.push(
        await pickIndexedChecksums(
          ctx,
          [
            {
              sport: "knowledge",
              category: "which_came_first",
              cursorPrefix: "knowledge_came_first_v",
              cursorAlphabet: NUMERIC_CURSOR_ALPHABET,
            },
            {
              sport: ARENA_CIE_SPORT,
              category: "which_came_first",
              cursorPrefix: "knowledge_",
            },
          ],
          used,
          recentlySeen,
          `${seed}:${category}`,
          "which came first",
          (question) =>
            question.category === "which_came_first" &&
            isAnswerableMcq(question),
          challengeArenaWhichCameFirstQuestions,
        ),
      );
      categories.push(category);
      continue;
    }

    if (category === "enterprise_logos") {
      rounds.push(
        await pickIndexedChecksums(
          ctx,
          [
            {
              sport: "knowledge",
              category: "enterprise_logos",
              cursorPrefix: "challenge_arena_enterprise_logos_v1_",
              cursorAlphabet: NUMERIC_CURSOR_ALPHABET,
            },
          ],
          used,
          recentlySeen,
          `${seed}:${category}`,
          "enterprise logos",
          isLogoTextQuestion,
          challengeArenaEnterpriseLogoQuestions,
        ),
      );
      categories.push(category);
      continue;
    }

    rounds.push(
      await pickIndexedChecksums(
        ctx,
        [
          {
            sport: "knowledge",
            category: "capital_cities",
            cursorPrefix: "challenge_arena_capitals_v",
            cursorAlphabet: NUMERIC_CURSOR_ALPHABET,
          },
          {
            sport: ARENA_CIE_SPORT,
            category: "capital_cities",
            cursorPrefix: "knowledge_geography_cie_score_v",
          },
        ],
        used,
        recentlySeen,
        `${seed}:${category}`,
        "capital cities",
        (question) =>
          question.category === "capital_cities" && isAnswerableMcq(question),
        challengeArenaCapitalCityQuestions,
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

const UPCOMING_IMAGE_LOOKAHEAD = 18;

async function collectUpcomingImageUrls(
  ctx: Pick<QueryCtx | MutationCtx, "db" | "storage">,
  arena: Arena,
): Promise<string[]> {
  if (
    arena.phase === "lobby" ||
    arena.phase === "final" ||
    arena.phase === "abandoned"
  ) {
    return [];
  }
  if (!arena.roundChecksums.length) return [];

  let startRound = arena.currentRound;
  let startIdx = arena.currentQuestionIndex;
  if (arena.phase === "question" || arena.phase === "reveal") {
    startIdx += 1;
  } else if (arena.phase === "round_break") {
    startRound += 1;
    startIdx = 0;
  }

  const urls: string[] = [];
  const seen = new Set<string>();
  for (
    let r = startRound;
    r < arena.roundChecksums.length && urls.length < UPCOMING_IMAGE_LOOKAHEAD;
    r += 1
  ) {
    const round = arena.roundChecksums[r];
    if (!round) continue;
    const fromIdx = r === startRound ? startIdx : 0;
    for (
      let i = fromIdx;
      i < round.length && urls.length < UPCOMING_IMAGE_LOOKAHEAD;
      i += 1
    ) {
      const checksum = round[i];
      if (!checksum || seen.has(checksum)) continue;
      seen.add(checksum);
      const question = await ctx.db
        .query("quizQuestions")
        .withIndex("by_checksum", (qb) => qb.eq("checksum", checksum))
        .first();
      if (!question) continue;
      const url =
        question.imageUrl ??
        (question.imageId ? await ctx.storage.getUrl(question.imageId) : null);
      if (url) urls.push(url);
    }
  }
  return urls;
}

async function sanitizeQuestion(
  ctx: Pick<QueryCtx | MutationCtx, "storage" | "db">,
  question: Question,
  includeCorrectAnswer: boolean,
  locale?: string,
) {
  const kind = questionKind(question);
  const imageUrl = question.imageUrl ?? (question.imageId
    ? await ctx.storage.getUrl(question.imageId)
    : null);

  if (kind === "logo_text") {
    return {
      kind,
      category: question.category,
      difficulty: question.difficulty,
      imageUrl,
      ...(includeCorrectAnswer
        ? {
            question: question.question,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation ?? null,
          }
        : {}),
    };
  }

  // Display-translate, grade-canonical (docs/I18N_CONTENT_DESIGN.md): players
  // submit the canonical optionValues; options may be localized labels.
  const orderedValues = orderAnswerOptions(
    question.options,
    question.correctAnswer,
    question.checksum,
  );
  const translation = await fetchQuestionTranslation(
    ctx,
    question.checksum,
    locale,
  );
  const localized = composeLocalizedQuestion(question, orderedValues, translation);
  return {
    kind,
    question: localized.question,
    options: localized.options,
    optionValues: localized.optionValues,
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

function assertFinal(arena: Arena) {
  if (arena.status !== "final" || arena.phase !== "final") {
    throw new Error("Arena is not finished");
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

/**
 * Points for a correct answer: base 100 + time bonus (0–100 scaled by the
 * remaining question window) + rank bonus by correct-arrival order (0-based).
 * Shared by at-submit scoring and the closeQuestionNow legacy settlement so
 * both paths always agree.
 */
function correctAnswerPoints(
  questionWindowMs: number,
  serverTimeMs: number,
  rank: number,
): number {
  const timeBonus = Math.round(
    100 * Math.max(0, (questionWindowMs - serverTimeMs) / questionWindowMs),
  );
  const rankBonus = RANK_BONUS[Math.min(rank, RANK_BONUS.length - 1)] ?? 10;
  return 100 + timeBonus + rankBonus;
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

  // Settlement only covers rows not already scored at submit time (answers
  // written before at-submit scoring deployed). At-submit rows have final
  // points and their totalScore contribution is already banked, so they must
  // not be re-added here. Ranks are computed over the full correct ordering,
  // which matches what at-submit scoring assigned positionally.
  const pointsByUser = new Map<Id<"users">, number>();
  for (const answer of activeAnswers) {
    if (answer.scoredAtSubmit) continue;
    if (!answer.correct) {
      pointsByUser.set(answer.userId, 0);
      continue;
    }
    const rank = rankByUser.get(answer.userId) ?? 0;
    pointsByUser.set(
      answer.userId,
      correctAnswerPoints(arena.questionWindowMs, answer.serverTimeMs, rank),
    );
  }

  for (const answer of answers) {
    if (answer.scoredAtSubmit) continue;
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
    rematchArenaId: arena.rematchArenaId ?? null,
    rematchArenaCode: arena.rematchArenaCode ?? null,
    players,
    rankings: {
      players: rankedSummaryPlayers(players),
      teams: isTeamMode ? rankedSummaryTeams(players) : [],
    },
    superlatives: buildSummarySuperlatives(players),
  };
}

async function getContentCounts(ctx: Pick<QueryCtx | MutationCtx, "db">) {
  const footballRows = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_checksum", (q) => q.eq("sport", "football"))
    .take(CONTENT_STATUS_FOOTBALL_READ_CAP + 1);
  const knowledgeRows = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_checksum", (q) => q.eq("sport", "knowledge"))
    .take(CONTENT_STATUS_KNOWLEDGE_READ_CAP + 1);
  const cieRows = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_checksum", (q) => q.eq("sport", ARENA_CIE_SPORT))
    .take(CONTENT_STATUS_CIE_READ_CAP + 1);
  const footballCapped = footballRows.length > CONTENT_STATUS_FOOTBALL_READ_CAP;
  const knowledgeCapped = knowledgeRows.length > CONTENT_STATUS_KNOWLEDGE_READ_CAP;
  const cieCapped = cieRows.length > CONTENT_STATUS_CIE_READ_CAP;
  const football = footballRows.slice(0, CONTENT_STATUS_FOOTBALL_READ_CAP);
  const knowledge = knowledgeRows.slice(0, CONTENT_STATUS_KNOWLEDGE_READ_CAP);
  const cie = cieRows.slice(0, CONTENT_STATUS_CIE_READ_CAP);
  const footballQuiz = football.filter(
    (q) =>
      q.category !== "which_came_first" &&
      q.category !== "badge_identification" &&
      isAnswerableMcq(q),
  );
  const generalKnowledge = knowledge.filter(
    (q) =>
      q.category !== "which_came_first" &&
      q.category !== "enterprise_logos" &&
      q.category !== "capital_cities" &&
      isAnswerableMcq(q),
  );
  return {
    footballQuiz: footballQuiz.length,
    footballQuizText: footballQuiz.filter((q) => !hasQuestionImage(q)).length,
    footballQuizImages: footballQuiz.filter(hasQuestionImage).length,
    footballImageQuestionCap: FOOTBALL_IMAGE_QUESTION_CAP,
    recentlySeenWindowCount: RECENTLY_SEEN_WINDOW_COUNT,
    recentlySeenWindowAgeMs: RECENTLY_SEEN_WINDOW_AGE_MS,
    generalKnowledge: generalKnowledge.length,
    whichCameFirst: knowledge.filter(
      (q) => q.category === "which_came_first" && isAnswerableMcq(q),
    ).length,
    enterpriseLogos: knowledge.filter(isLogoTextQuestion).length,
    legacyLogoMcqImages: football.filter(isValidLogoQuestion).length,
    capitalCities: knowledge.filter(
      (q) => q.category === "capital_cities" && isAnswerableMcq(q),
    ).length,
    cieTotal: cie.length,
    cieCapitalCities: cie.filter(
      (q) => q.category === "capital_cities" && isAnswerableMcq(q),
    ).length,
    cieGeneralKnowledge: cie.filter(
      (q) =>
        q.category !== "which_came_first" &&
        q.category !== "enterprise_logos" &&
        q.category !== "capital_cities" &&
        isAnswerableMcq(q),
    ).length,
    cieWhichCameFirst: cie.filter(
      (q) => q.category === "which_came_first" && isAnswerableMcq(q),
    ).length,
    countsCapped: footballCapped || knowledgeCapped || cieCapped,
    contentStatusReadCaps: {
      football: CONTENT_STATUS_FOOTBALL_READ_CAP,
      knowledge: CONTENT_STATUS_KNOWLEDGE_READ_CAP,
      cie: CONTENT_STATUS_CIE_READ_CAP,
    },
    bundledCapitalSeeds: challengeArenaCapitalCityQuestions.length,
    bundledGeneralKnowledgeSeeds: challengeArenaGeneralKnowledgeQuestions.length,
    bundledWhichCameFirstSeeds: challengeArenaWhichCameFirstQuestions.length,
    bundledEnterpriseLogoSeeds: challengeArenaEnterpriseLogoQuestions.length,
    plannedCieSeeds: arenaCieSeedPlan().totals.planned,
  };
}

export const create = mutation({
  args: { mode: arenaMode },
  handler: async (ctx, { mode }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await assertUsernameRequiredUser(ctx, userId);
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
    const user = await assertUsernameRequiredUser(ctx, userId);

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
    const starterIds = starters.map((player) => player.userId);
    const locked = await lockRoundQuestionSets(ctx, seed, starterIds, now);
    await recordRecentlySeenArenaQuestions(
      ctx,
      starterIds,
      locked.rounds.flat(),
      now,
    );
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

    const question = await loadCurrentQuestion(ctx, arena);
    if (!question) throw new Error("Question not found");
    const kind = questionKind(question);

    if (kind === "logo_text") {
      if (existingAnswers.some((row) => row.userId === userId && row.correct)) {
        throw new Error("Already answered this question");
      }

      const result = matchLogoGuess(answer, question);
      if (!result.correct) {
        return {
          result: "wrong" as const,
          close: result.close,
        };
      }

      // Score at submit so the standings move in real time. Rank is the
      // arrival order among correct answers so far — serverTimeMs is
      // monotonic with mutation order, so this matches the close-time sort.
      const activeIds = new Set(activePlayers(arena).map((player) => player.userId));
      const correctSoFar = existingAnswers.filter(
        (row) => activeIds.has(row.userId) && row.correct,
      ).length;
      const points = correctAnswerPoints(arena.questionWindowMs, serverTimeMs, correctSoFar);

      await ctx.db.insert("arenaAnswers", {
        arenaId,
        round: arena.currentRound,
        questionIndex: arena.currentQuestionIndex,
        userId,
        answer,
        serverTimeMs,
        correct: true,
        points,
        scoredAtSubmit: true,
      });

      const scoredPlayers = arena.players.map((player) =>
        player.userId === userId
          ? { ...player, totalScore: player.totalScore + points }
          : player,
      );
      await ctx.db.patch(arena._id, { players: scoredPlayers });
      const scoredArena = { ...arena, players: scoredPlayers };

      const correctIds = new Set([
        ...existingAnswers
          .filter((row) => activeIds.has(row.userId) && row.correct)
          .map((row) => row.userId),
        userId,
      ]);
      if (correctIds.size >= activeIds.size) {
        await closeQuestionNow(ctx, scoredArena, arena.currentRound, arena.currentQuestionIndex);
      }

      return { accepted: true, result: "correct" as const, serverTimeMs };
    }

    if (existingAnswers.some((row) => row.userId === userId)) {
      throw new Error("Already answered this question");
    }

    const correct = normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer);

    // Score at submit so the standings move in real time (see logo path).
    const activeIds = new Set(activePlayers(arena).map((player) => player.userId));
    const correctSoFar = existingAnswers.filter(
      (row) => activeIds.has(row.userId) && row.correct,
    ).length;
    const points = correct
      ? correctAnswerPoints(arena.questionWindowMs, serverTimeMs, correctSoFar)
      : 0;

    await ctx.db.insert("arenaAnswers", {
      arenaId,
      round: arena.currentRound,
      questionIndex: arena.currentQuestionIndex,
      userId,
      answer,
      serverTimeMs,
      correct,
      points,
      scoredAtSubmit: true,
    });

    let scoredArena = arena;
    if (points > 0) {
      const scoredPlayers = arena.players.map((player) =>
        player.userId === userId
          ? { ...player, totalScore: player.totalScore + points }
          : player,
      );
      await ctx.db.patch(arena._id, { players: scoredPlayers });
      scoredArena = { ...arena, players: scoredPlayers };
    }

    const answeredIds = new Set([
      ...existingAnswers
        .filter((row) => activeIds.has(row.userId))
        .map((row) => row.userId),
      userId,
    ]);
    if (answeredIds.size >= activeIds.size) {
      await closeQuestionNow(ctx, scoredArena, arena.currentRound, arena.currentQuestionIndex);
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
    assertFinal(arena);

    if (arena.rematchArenaId && arena.rematchArenaCode) {
      return {
        arenaId: arena.rematchArenaId,
        code: arena.rematchArenaCode,
      };
    }

    if (arena.rematchArenaId) {
      const rematchArena = await ctx.db.get(arena.rematchArenaId);
      if (!rematchArena) throw new Error("Rematch arena not found");
      await ctx.db.patch(arena._id, { rematchArenaCode: rematchArena.code });
      return { arenaId: rematchArena._id, code: rematchArena.code };
    }

    if (arena.rematchArenaCode) {
      const rematchArena = await getArenaByCode(ctx, arena.rematchArenaCode);
      if (!rematchArena) throw new Error("Rematch arena not found");
      await ctx.db.patch(arena._id, { rematchArenaId: rematchArena._id });
      return { arenaId: rematchArena._id, code: rematchArena.code };
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

    await ctx.db.patch(arena._id, {
      rematchArenaId: rematchId,
      rematchArenaCode: code,
    });

    return { arenaId: rematchId, code };
  },
});

export const getRoom = query({
  args: {
    arenaId: v.optional(v.id("arenas")),
    code: v.optional(v.string()),
    locale: v.optional(v.string()),
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
      ? await sanitizeQuestion(ctx, question, includeCorrectAnswer, args.locale)
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

    const upcomingImageUrls = await collectUpcomingImageUrls(ctx, arena);

    return {
      arenaId: arena._id,
      code: arena.code,
      hostId: arena.hostId,
      mode: arena.mode,
      status: arena.status,
      phase: arena.phase,
      rematchArenaId: arena.rematchArenaId ?? null,
      rematchArenaCode: arena.rematchArenaCode ?? null,
      upcomingImageUrls,
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
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, limit }) => {
    const batchLimit = Math.max(
      1,
      Math.min(Math.floor(limit ?? SEED_CONTENT_BATCH_SIZE), SEED_CONTENT_MAX_BATCH_SIZE),
    );
    const seeded = await ensureQuestionSeedBatch(
      ctx,
      parseSeedCursor(cursor),
      batchLimit,
    );
    return {
      ...seeded,
      batchLimit,
      bundledCapitalSeeds: challengeArenaCapitalCityQuestions.length,
      bundledGeneralKnowledgeSeeds: challengeArenaGeneralKnowledgeQuestions.length,
      bundledWhichCameFirstSeeds: challengeArenaWhichCameFirstQuestions.length,
      bundledEnterpriseLogoSeeds: challengeArenaEnterpriseLogoQuestions.length,
    };
  },
});

// Live normalized prompt+answer identities across the knowledge quiz pool;
// CIE rows that collide with one of these are excluded from seeding (the QA
// harness would flag the pair as an EXACT_DUPLICATE ERROR).
async function loadLiveKnowledgeDuplicateKeys(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
) {
  const rows = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_checksum", (q) => q.eq("sport", "knowledge"))
    .collect();
  return new Set(rows.map((row) => contentDuplicateKey(row)));
}

function tallyCieRows(rows: ArenaCiePlannedRow[]) {
  const bySubject: Record<string, number> = {};
  const byShape: Record<string, number> = {};
  const byArenaCategory: Record<string, number> = {};
  for (const row of rows) {
    bySubject[row.subject] = (bySubject[row.subject] ?? 0) + 1;
    byShape[row.shape] = (byShape[row.shape] ?? 0) + 1;
    byArenaCategory[row.arenaCategory] =
      (byArenaCategory[row.arenaCategory] ?? 0) + 1;
  }
  return { bySubject, byShape, byArenaCategory };
}

// Dry run for the CIE → Arena seed. Read-only by construction (internalQuery);
// the returned newChecksums list is the rollback key for the matching
// seedCieContent execution.
export const cieContentPlan = internalQuery({
  args: {},
  handler: async (ctx) => {
    const plan = arenaCieSeedPlan();
    const liveKeys = await loadLiveKnowledgeDuplicateKeys(ctx);
    const toSeed: ArenaCiePlannedRow[] = [];
    const liveDuplicateChecksums: string[] = [];
    const alreadySeededChecksums: string[] = [];

    for (const row of plan.rows) {
      if (liveKeys.has(contentDuplicateKey(row.seed))) {
        liveDuplicateChecksums.push(row.seed.checksum);
        continue;
      }
      const existing = await readQuestionByChecksum(ctx, row.seed.checksum);
      if (existing) {
        alreadySeededChecksums.push(row.seed.checksum);
        continue;
      }
      toSeed.push(row);
    }

    return {
      sport: ARENA_CIE_SPORT,
      registeredQuestions: plan.totals.registeredQuestions,
      plannedAfterStaticEligibility: plan.totals.planned,
      staticExclusionsByReason: plan.totals.excludedByReason,
      staticExclusions: plan.exclusions,
      liveDuplicateChecksums,
      alreadySeededChecksums,
      toSeedCount: toSeed.length,
      toSeedBreakdown: tallyCieRows(toSeed),
      newChecksums: toSeed.map((row) => row.seed.checksum),
    };
  },
});

// Additive-only CIE seed: inserts new rows keyed by checksum under
// ARENA_CIE_SPORT. Existing quizQuestions rows are never patched or deleted —
// rows whose checksum already exists are skipped and counted.
export const seedCieContent = internalMutation({
  args: {
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, limit }) => {
    const batchLimit = Math.max(
      1,
      Math.min(Math.floor(limit ?? SEED_CONTENT_BATCH_SIZE), SEED_CONTENT_MAX_BATCH_SIZE),
    );
    const plan = arenaCieSeedPlan();
    const start = Math.max(0, Math.floor(cursor ?? 0));
    if (start > plan.rows.length) {
      throw new Error("Invalid CIE seed cursor");
    }
    const page = plan.rows.slice(start, start + batchLimit);
    const liveKeys = await loadLiveKnowledgeDuplicateKeys(ctx);

    let inserted = 0;
    let skippedExisting = 0;
    let skippedLiveDuplicates = 0;
    const insertedChecksums: string[] = [];
    for (const row of page) {
      if (liveKeys.has(contentDuplicateKey(row.seed))) {
        skippedLiveDuplicates += 1;
        continue;
      }
      const existing = await readQuestionByChecksum(ctx, row.seed.checksum);
      if (existing) {
        skippedExisting += 1;
        continue;
      }
      await ctx.db.insert("quizQuestions", {
        ...questionSeedDocument(row.seed),
        provenance: row.seed.provenance,
        difficultyVotes: 0,
        difficultyScore: 0,
        timesAnswered: 0,
        timesCorrect: 0,
        usageCount: 0,
      });
      inserted += 1;
      insertedChecksums.push(row.seed.checksum);
    }

    const nextOffset = start + page.length;
    const isDone = nextOffset >= plan.rows.length;
    return {
      inserted,
      skippedExisting,
      skippedLiveDuplicates,
      insertedChecksums,
      processed: page.length,
      plannedTotal: plan.rows.length,
      nextCursor: isDone ? null : nextOffset,
      isDone,
      batchLimit,
    };
  },
});

// Ops verification: spot-check seeded CIE rows by checksum.
export const cieSpotCheck = internalQuery({
  args: { checksums: v.array(v.string()) },
  handler: async (ctx, { checksums }) => {
    const checks = [];
    for (const checksum of checksums.slice(0, 50)) {
      const row = await readQuestionByChecksum(ctx, checksum);
      checks.push(
        row
          ? {
              checksum,
              found: true,
              sport: row.sport,
              category: row.category,
              difficulty: row.difficulty,
              hasProvenance: !!row.provenance,
              provenanceVerdict: row.provenance?.verdict ?? null,
              provenanceBatchId: row.provenance?.batchId ?? null,
              provenanceClaims: row.provenance?.claims.length ?? 0,
            }
          : { checksum, found: false },
      );
    }
    return checks;
  },
});

// Ops verification: replicate the exact non-arena knowledge selection index
// (by_sport_difficulty, sport "knowledge" — the candidate set quiz/blitz/
// daily/duels draw from) and prove it contains no CIE rows.
export const cieSelectionProbe = internalQuery({
  args: {},
  handler: async (ctx) => {
    const result: Record<
      string,
      { candidates: number; cieChecksums: number; cieSportRows: number }
    > = {};
    for (const difficulty of ["easy", "intermediate", "hard"] as const) {
      const rows = await ctx.db
        .query("quizQuestions")
        .withIndex("by_sport_difficulty", (q) =>
          q.eq("sport", "knowledge").eq("difficulty", difficulty),
        )
        .take(5000);
      result[difficulty] = {
        candidates: rows.length,
        cieChecksums: rows.filter((row) =>
          /_cie_score_v\d+_/.test(row.checksum),
        ).length,
        cieSportRows: rows.filter((row) => row.sport === ARENA_CIE_SPORT).length,
      };
    }
    return result;
  },
});

// Ops verification: page deterministic table-wide counts by sport.
export const quizQuestionCountsPage = internalQuery({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { cursor, limit }) => {
    const pageLimit = Math.max(1, Math.min(Math.floor(limit ?? 1000), 2000));
    const rows =
      cursor === undefined
        ? await ctx.db
            .query("quizQuestions")
            .withIndex("by_checksum")
            .take(pageLimit)
        : await ctx.db
            .query("quizQuestions")
            .withIndex("by_checksum", (q) => q.gt("checksum", cursor))
            .take(pageLimit);
    const bySport: Record<string, number> = {};
    for (const row of rows) {
      bySport[row.sport] = (bySport[row.sport] ?? 0) + 1;
    }
    return {
      read: rows.length,
      bySport,
      nextCursor:
        rows.length < pageLimit ? null : rows[rows.length - 1].checksum,
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
