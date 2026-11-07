/**
 * Challenge Arena content: everything that needs the bundled question banks
 * (fallback seeds per category, the seed/CIE registries) lives here, OUT of
 * challengeArenas.ts. Convex evaluates a function's whole bundle on every
 * call; with the banks imported there, every heartbeat, answer and room read
 * paid ~125 ms just to load ~3 MB of questions it never touched. The hot
 * module reaches this one through ctx.runMutation / ctx.runQuery only where
 * content is needed (arena start, content status, seeding ops), keeping the
 * same transaction and the same public/internal function paths.
 */
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
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
import { scienceQuestions } from "./scienceQuestionsV1";
import { worldHistoryQuestions } from "./worldHistoryQuestionsV1";
import { moviesTvQuestions } from "./moviesTvQuestionsV1";
import { musicQuestions } from "./musicQuestionsV1";
import { videoGamesQuestions } from "./videoGamesQuestionsV1";
import { contentDuplicateKey } from "./lib/contentQa";
import {
  FOOTBALL_IMAGE_QUESTION_CAP,
  RECENTLY_SEEN_WINDOW_AGE_MS,
  RECENTLY_SEEN_WINDOW_COUNT,
  hasQuestionImage,
  isAnswerableMcq,
  isLogoTextQuestion,
  isValidLogoQuestion,
  lockRoundQuestionSetsWith,
  questionSeedDocument,
  readQuestionByChecksum,
  upsertQuestionSeed,
} from "./challengeArenas";

const SEED_CONTENT_BATCH_SIZE = 250;
const SEED_CONTENT_MAX_BATCH_SIZE = 500;
const CONTENT_STATUS_KNOWLEDGE_READ_CAP = 3_000;
const CONTENT_STATUS_FOOTBALL_READ_CAP = 750;
const CONTENT_STATUS_CIE_READ_CAP = 3_000;

export type SeedContentCategory =
  | "capitalCities"
  | "generalKnowledge"
  | "whichCameFirst"
  | "enterpriseLogos";
type SeedCursor = {
  categoryIndex: number;
  offset: number;
};

/** Bundled fallback questions per round category (the indexed pool's
 *  guaranteed backstop). Counts must match lib/arenaContentFloors.ts. */
export const ARENA_FALLBACK_SEEDS: Record<string, ChallengeArenaQuestionSeed[]> = {
  general_knowledge: challengeArenaGeneralKnowledgeQuestions,
  which_came_first: challengeArenaWhichCameFirstQuestions,
  enterprise_logos: challengeArenaEnterpriseLogoQuestions,
  capital_cities: challengeArenaCapitalCityQuestions,
  science: scienceQuestions,
  world_history: worldHistoryQuestions,
  movies_tv: moviesTvQuestions,
  music: musicQuestions,
  video_games: videoGamesQuestions,
};

/** Locks every round's question checksums at arena start (called from
 *  challengeArenas.start via ctx.runMutation — same transaction). */
export const lockRoundQuestionSets = internalMutation({
  args: {
    seed: v.string(),
    playerIds: v.array(v.id("users")),
    now: v.number(),
    config: v.object({
      rounds: v.number(),
      perRound: v.number(),
      categories: v.array(v.string()),
    }),
  },
  handler: async (ctx, { seed, playerIds, now, config }) => {
    return await lockRoundQuestionSetsWith(
      ctx,
      seed,
      playerIds,
      now,
      config,
      (category) => ARENA_FALLBACK_SEEDS[category],
    );
  },
});

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

export const contentStatus = internalQuery({
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


export type ArenaContentCounts = Awaited<ReturnType<typeof getContentCounts>>;
export type ArenaSeedContentGapsResult = Awaited<
  ReturnType<typeof ensureQuestionSeedBatch>
> & {
  batchLimit: number;
  bundledCapitalSeeds: number;
  bundledGeneralKnowledgeSeeds: number;
  bundledWhichCameFirstSeeds: number;
  bundledEnterpriseLogoSeeds: number;
};
export type ArenaCieContentPlan = {
  sport: string;
  registeredQuestions: number;
  plannedAfterStaticEligibility: number;
  staticExclusionsByReason: ReturnType<typeof arenaCieSeedPlan>["totals"]["excludedByReason"];
  staticExclusions: ReturnType<typeof arenaCieSeedPlan>["exclusions"];
  liveDuplicateChecksums: string[];
  alreadySeededChecksums: string[];
  toSeedCount: number;
  toSeedBreakdown: ReturnType<typeof tallyCieRows>;
  newChecksums: string[];
};
export type ArenaSeedCieContentResult = {
  inserted: number;
  skippedExisting: number;
  skippedLiveDuplicates: number;
  insertedChecksums: string[];
  processed: number;
  plannedTotal: number;
  nextCursor: number | null;
  isDone: boolean;
  batchLimit: number;
};
