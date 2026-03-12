import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedPlayersBatch = mutation({
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
  },
  handler: async (ctx, { records }) => {
    let inserted = 0;
    for (const record of records) {
      const existing = await ctx.db
        .query("sportsPlayers")
        .withIndex("by_external_id", (q) => q.eq("externalId", record.externalId))
        .first();
      if (!existing) {
        await ctx.db.insert("sportsPlayers", record);
        inserted++;
      }
    }
    return { inserted };
  },
});

export const seedTeamsBatch = mutation({
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
  },
  handler: async (ctx, { records }) => {
    let inserted = 0;
    for (const record of records) {
      const existing = await ctx.db
        .query("sportsTeams")
        .withIndex("by_external_id", (q) => q.eq("externalId", record.externalId))
        .first();
      if (!existing) {
        await ctx.db.insert("sportsTeams", record);
        inserted++;
      }
    }
    return { inserted };
  },
});

export const seedStatFactsBatch = mutation({
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
  },
  handler: async (ctx, { records }) => {
    let inserted = 0;
    for (const record of records) {
      const existing = await ctx.db
        .query("statFacts")
        .withIndex("by_external_id", (q) => q.eq("externalId", record.externalId))
        .first();
      if (!existing) {
        await ctx.db.insert("statFacts", record);
        inserted++;
      }
    }
    return { inserted };
  },
});

export const seedGridIndexBatch = mutation({
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
  },
  handler: async (ctx, { records }) => {
    let inserted = 0;
    for (const record of records) {
      const existing = await ctx.db
        .query("gridIndex")
        .withIndex("by_external_id", (q) => q.eq("externalId", record.externalId))
        .first();
      if (!existing) {
        await ctx.db.insert("gridIndex", record);
        inserted++;
      }
    }
    return { inserted };
  },
});

export const seedWhoAmICluesBatch = mutation({
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
  },
  handler: async (ctx, { records }) => {
    let inserted = 0;
    for (const record of records) {
      const existing = await ctx.db
        .query("whoAmIClues")
        .withIndex("by_external_id", (q) => q.eq("externalId", record.externalId))
        .first();
      if (!existing) {
        await ctx.db.insert("whoAmIClues", record);
        inserted++;
      }
    }
    return { inserted };
  },
});
