import { internalMutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const curatedTableName = v.union(
  v.literal("sportsPlayers"),
  v.literal("sportsTeams"),
  v.literal("higherLowerPools"),
  v.literal("higherLowerFacts"),
  v.literal("verveGridApprovedIndex"),
  v.literal("verveGridBoards"),
  v.literal("whoAmIApprovedClues"),
);

type CuratedTableName =
  | "sportsPlayers"
  | "sportsTeams"
  | "higherLowerPools"
  | "higherLowerFacts"
  | "verveGridApprovedIndex"
  | "verveGridBoards"
  | "whoAmIApprovedClues";

type SeedTableName =
  | CuratedTableName
  | "statFacts"
  | "gridIndex"
  | "whoAmIClues";

type ExistingSeedDoc = {
  _id: Id<SeedTableName>;
  seedVersion?: string;
};

function withSeedVersion<T extends Record<string, unknown>>(
  record: T,
  seedVersion?: string,
): T & { seedVersion?: string } {
  return seedVersion ? { ...record, seedVersion } : record;
}

async function getExistingByExternalId(
  ctx: MutationCtx,
  tableName: SeedTableName,
  externalId: string,
): Promise<ExistingSeedDoc | null> {
  switch (tableName) {
    case "sportsPlayers":
      return (await ctx.db
        .query("sportsPlayers")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .first()) satisfies ExistingSeedDoc | null;
    case "sportsTeams":
      return (await ctx.db
        .query("sportsTeams")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .first()) satisfies ExistingSeedDoc | null;
    case "statFacts":
      return (await ctx.db
        .query("statFacts")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .first()) satisfies ExistingSeedDoc | null;
    case "higherLowerPools":
      return (await ctx.db
        .query("higherLowerPools")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .first()) satisfies ExistingSeedDoc | null;
    case "higherLowerFacts":
      return (await ctx.db
        .query("higherLowerFacts")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .first()) satisfies ExistingSeedDoc | null;
    case "gridIndex":
      return (await ctx.db
        .query("gridIndex")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .first()) satisfies ExistingSeedDoc | null;
    case "verveGridApprovedIndex":
      return (await ctx.db
        .query("verveGridApprovedIndex")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .first()) satisfies ExistingSeedDoc | null;
    case "verveGridBoards":
      return (await ctx.db
        .query("verveGridBoards")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .first()) satisfies ExistingSeedDoc | null;
    case "whoAmIClues":
      return (await ctx.db
        .query("whoAmIClues")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .first()) satisfies ExistingSeedDoc | null;
    case "whoAmIApprovedClues":
      return (await ctx.db
        .query("whoAmIApprovedClues")
        .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
        .first()) satisfies ExistingSeedDoc | null;
  }
}

async function insertSeedRecord(
  ctx: MutationCtx,
  tableName: SeedTableName,
  record: Record<string, unknown>,
  seedVersion?: string,
) {
  const doc = withSeedVersion(record, seedVersion);
  switch (tableName) {
    case "sportsPlayers":
      return ctx.db.insert("sportsPlayers", doc as never);
    case "sportsTeams":
      return ctx.db.insert("sportsTeams", doc as never);
    case "statFacts":
      return ctx.db.insert("statFacts", doc as never);
    case "higherLowerPools":
      return ctx.db.insert("higherLowerPools", doc as never);
    case "higherLowerFacts":
      return ctx.db.insert("higherLowerFacts", doc as never);
    case "gridIndex":
      return ctx.db.insert("gridIndex", doc as never);
    case "verveGridApprovedIndex":
      return ctx.db.insert("verveGridApprovedIndex", doc as never);
    case "verveGridBoards":
      return ctx.db.insert("verveGridBoards", doc as never);
    case "whoAmIClues":
      return ctx.db.insert("whoAmIClues", doc as never);
    case "whoAmIApprovedClues":
      return ctx.db.insert("whoAmIApprovedClues", doc as never);
  }
}

async function seedBatch(
  ctx: MutationCtx,
  tableName: SeedTableName,
  records: Record<string, unknown>[],
  seedVersion?: string,
  replaceExisting?: boolean,
) {
  let inserted = 0;
  let replaced = 0;

  for (const record of records) {
    const existing = await getExistingByExternalId(
      ctx,
      tableName,
      record.externalId as string,
    );

    if (!existing) {
      await insertSeedRecord(ctx, tableName, record, seedVersion);
      inserted++;
      continue;
    }

    if (!replaceExisting) {
      continue;
    }

    await ctx.db.delete(existing._id);
    await insertSeedRecord(ctx, tableName, record, seedVersion);
    replaced++;
  }

  return { inserted, replaced };
}

type SeedDocPage = {
  page: ExistingSeedDoc[];
  continueCursor: string;
  isDone: boolean;
};

async function getScopedDocsPage(
  ctx: QueryCtx | MutationCtx,
  tableName: CuratedTableName,
  sport: string,
  cursor: string | null,
): Promise<SeedDocPage> {
  const paginationOpts = { numItems: 512, cursor, maximumRowsRead: 768 };

  switch (tableName) {
    case "sportsPlayers":
      return (await ctx.db
        .query("sportsPlayers")
        .withIndex("by_sport", (q) => q.eq("sport", sport))
        .paginate(paginationOpts)) satisfies SeedDocPage;
    case "sportsTeams":
      return (await ctx.db
        .query("sportsTeams")
        .withIndex("by_sport", (q) => q.eq("sport", sport))
        .paginate(paginationOpts)) satisfies SeedDocPage;
    case "higherLowerPools":
      return (await ctx.db
        .query("higherLowerPools")
        .withIndex("by_sport", (q) => q.eq("sport", sport))
        .paginate(paginationOpts)) satisfies SeedDocPage;
    case "higherLowerFacts":
      return (await ctx.db
        .query("higherLowerFacts")
        .withIndex("by_sport", (q) => q.eq("sport", sport))
        .paginate(paginationOpts)) satisfies SeedDocPage;
    case "verveGridApprovedIndex":
      return (await ctx.db
        .query("verveGridApprovedIndex")
        .withIndex("by_sport", (q) => q.eq("sport", sport))
        .paginate(paginationOpts)) satisfies SeedDocPage;
    case "verveGridBoards":
      return (await ctx.db
        .query("verveGridBoards")
        .withIndex("by_sport", (q) => q.eq("sport", sport))
        .paginate(paginationOpts)) satisfies SeedDocPage;
    case "whoAmIApprovedClues":
      return (await ctx.db
        .query("whoAmIApprovedClues")
        .withIndex("by_sport", (q) => q.eq("sport", sport))
        .paginate(paginationOpts)) satisfies SeedDocPage;
  }
}

async function upsertCuratedSeedMetadata(
  ctx: MutationCtx,
  metadata: {
    scopeKey: string;
    tableName: CuratedTableName;
    sport: string;
    mode: string;
    artifactPath: string;
    seedVersion: string;
    artifactHash: string;
    recordCount: number;
    insertedCount: number;
    replacedCount: number;
    deletedCount: number;
    generatedAt: string;
    appliedAt: number;
    replaceStrategy: string;
  },
) {
  const existing = await ctx.db
    .query("curatedSeedMetadata")
    .withIndex("by_scope_table", (q) =>
      q.eq("scopeKey", metadata.scopeKey).eq("tableName", metadata.tableName),
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, metadata);
    return;
  }

  await ctx.db.insert("curatedSeedMetadata", metadata);
}

const seedBatchArgs = {
  seedVersion: v.optional(v.string()),
  replaceExisting: v.optional(v.boolean()),
};

export const seedPlayersBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        externalId: v.string(),
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
      }),
    ),
    ...seedBatchArgs,
  },
  handler: async (ctx, { records, seedVersion, replaceExisting }) =>
    seedBatch(ctx, "sportsPlayers", records, seedVersion, replaceExisting),
});

export const seedTeamsBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        externalId: v.string(),
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
      }),
    ),
    ...seedBatchArgs,
  },
  handler: async (ctx, { records, seedVersion, replaceExisting }) =>
    seedBatch(ctx, "sportsTeams", records, seedVersion, replaceExisting),
});

export const seedStatFactsBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        externalId: v.string(),
        sport: v.string(),
        entityType: v.string(),
        entityId: v.string(),
        entityName: v.string(),
        statKey: v.string(),
        contextKey: v.string(),
        value: v.number(),
        season: v.optional(v.number()),
      }),
    ),
    ...seedBatchArgs,
  },
  handler: async (ctx, { records, seedVersion, replaceExisting }) =>
    seedBatch(ctx, "statFacts", records, seedVersion, replaceExisting),
});

export const seedHigherLowerPoolsBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        externalId: v.string(),
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
      }),
    ),
    ...seedBatchArgs,
  },
  handler: async (ctx, { records, seedVersion, replaceExisting }) =>
    seedBatch(ctx, "higherLowerPools", records, seedVersion, replaceExisting),
});

export const seedHigherLowerFactsBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        externalId: v.string(),
        sport: v.string(),
        poolKey: v.string(),
        entityType: v.string(),
        entityId: v.string(),
        entityName: v.string(),
        statKey: v.string(),
        contextKey: v.string(),
        value: v.number(),
        season: v.optional(v.number()),
      }),
    ),
    ...seedBatchArgs,
  },
  handler: async (ctx, { records, seedVersion, replaceExisting }) =>
    seedBatch(ctx, "higherLowerFacts", records, seedVersion, replaceExisting),
});

// Legacy VerveGrid raw-table seed path. Keep for pipeline/audit backfills only;
// default Convex seeding should use verveGridApprovedIndex + verveGridBoards.
export const seedGridIndexBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        externalId: v.string(),
        sport: v.string(),
        rowType: v.string(),
        rowKey: v.string(),
        rowLabel: v.string(),
        colType: v.string(),
        colKey: v.string(),
        colLabel: v.string(),
        playerIds: v.array(v.string()),
        difficulty: v.string(),
      }),
    ),
    ...seedBatchArgs,
  },
  handler: async (ctx, { records, seedVersion, replaceExisting }) =>
    seedBatch(ctx, "gridIndex", records, seedVersion, replaceExisting),
});

export const seedVerveGridApprovedIndexBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        externalId: v.string(),
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
      }),
    ),
    ...seedBatchArgs,
  },
  handler: async (ctx, { records, seedVersion, replaceExisting }) =>
    seedBatch(ctx, "verveGridApprovedIndex", records, seedVersion, replaceExisting),
});

export const seedVerveGridBoardsBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        externalId: v.string(),
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
      }),
    ),
    ...seedBatchArgs,
  },
  handler: async (ctx, { records, seedVersion, replaceExisting }) =>
    seedBatch(ctx, "verveGridBoards", records, seedVersion, replaceExisting),
});

export const seedWhoAmICluesBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        externalId: v.string(),
        sport: v.string(),
        playerId: v.string(),
        clue1: v.string(),
        clue2: v.string(),
        clue3: v.string(),
        clue4: v.string(),
        answerName: v.string(),
        difficulty: v.string(),
      }),
    ),
    ...seedBatchArgs,
  },
  handler: async (ctx, { records, seedVersion, replaceExisting }) =>
    seedBatch(ctx, "whoAmIClues", records, seedVersion, replaceExisting),
});

export const seedWhoAmIApprovedCluesBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        externalId: v.string(),
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
      }),
    ),
    ...seedBatchArgs,
  },
  handler: async (ctx, { records, seedVersion, replaceExisting }) =>
    seedBatch(ctx, "whoAmIApprovedClues", records, seedVersion, replaceExisting),
});

export const clearCuratedSeedTablePage = internalMutation({
  args: {
    tableName: curatedTableName,
    sport: v.string(),
  },
  handler: async (ctx, { tableName, sport }) => {
    const page = await getScopedDocsPage(ctx, tableName, sport, null);

    for (const doc of page.page) {
      await ctx.db.delete(doc._id);
    }

    return {
      tableName,
      sport,
      deletedCount: page.page.length,
      hasMore: !page.isDone,
    };
  },
});

export const storeCuratedSeedMetadata = internalMutation({
  args: {
    scopeKey: v.string(),
    tableName: curatedTableName,
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
  },
  handler: async (ctx, args) => {
    const appliedAt = Date.now();
    await upsertCuratedSeedMetadata(ctx, {
      ...args,
      appliedAt,
      replaceStrategy: "authoritative_clear_and_reseed",
    });

    return {
      tableName: args.tableName,
      seedVersion: args.seedVersion,
      insertedCount: args.insertedCount,
      replacedCount: args.replacedCount,
      deletedCount: args.deletedCount,
      appliedAt,
    };
  },
});

export const getCuratedSeedTableStatusPage = query({
  args: {
    scopeKey: v.string(),
    tableName: curatedTableName,
    sport: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { scopeKey, tableName, sport, cursor }) => {
    const metadata = await ctx.db
      .query("curatedSeedMetadata")
      .withIndex("by_scope_table", (q) =>
        q.eq("scopeKey", scopeKey).eq("tableName", tableName),
      )
      .first();

    const page = await getScopedDocsPage(ctx, tableName, sport, cursor);
    const currentCount = page.page.length;
    const matchingSeedVersionCount = metadata
      ? page.page.filter((doc) => doc.seedVersion === metadata.seedVersion).length
      : 0;

    return {
      scopeKey,
      tableName,
      sport,
      metadata: metadata
        ? {
            mode: metadata.mode,
            artifactPath: metadata.artifactPath,
            seedVersion: metadata.seedVersion,
            artifactHash: metadata.artifactHash,
            recordCount: metadata.recordCount,
            insertedCount: metadata.insertedCount,
            replacedCount: metadata.replacedCount,
            deletedCount: metadata.deletedCount,
            generatedAt: metadata.generatedAt,
            appliedAt: metadata.appliedAt,
            replaceStrategy: metadata.replaceStrategy,
          }
        : null,
      currentCountInPage: currentCount,
      matchingSeedVersionCountInPage: matchingSeedVersionCount,
      staleCountInPage: currentCount - matchingSeedVersionCount,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
