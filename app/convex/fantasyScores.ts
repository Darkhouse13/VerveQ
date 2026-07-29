/**
 * Weekend Fantasy — the scoring execution pipeline (FW-4).
 *
 * SCORING_SPEC.md v0.5.1 is the authority and is LOCKED. This file does not
 * score: `lib/fantasyScoring.ts` does, and this is the machinery that gets a
 * feed payload to it, stores what came back, and never lets a number move once
 * a user has seen it.
 *
 * ── Shape ──
 *
 *   scoringPlan          internalQuery. What is due, and what it will cost in
 *                        requests. Printed before any pull, every run.
 *   scoreDueFixtures     internalAction, cron. 2 requests per due fixture
 *                        (/fixtures/players + /fixtures/events). NO in-play
 *                        polling: a fixture is only read once it is FT-class and
 *                        more than 2h past kickoff (R2).
 *   applyFixtureStats    internalMutation. The whole write path, and the only
 *                        one — the regression gate drives THIS, so the live
 *                        pipeline and the sim harness provably agree.
 *
 * ── The four things this file exists to guarantee ──
 *
 *  1. IDEMPOTENCE (R2). Every write is keyed on a content hash. Re-reading a
 *     fixture whose stats have not changed writes no raw row, no score row and
 *     no state change.
 *  2. REVISIONS NEVER MUTATE (R4). A changed hash before finality inserts a NEW
 *     score version and leaves the old one readable. After finality it records
 *     the raw revision and changes no score at all.
 *  3. AWAITING ≠ ZERO (R7). A fixture that is not scoreable produces no score
 *     rows, and the read surfaces report "awaiting" for its players. An honest
 *     zero is a stored 0. The two can never render alike because one is a row
 *     and the other is the absence of one.
 *  4. FAIL CLOSED ON A BAD FACTOR (R5). A crowd factor outside ±15% throws and
 *     rolls the transaction back rather than being clamped into something
 *     plausible.
 *
 * ── What this file does NOT decide ──
 *
 * The gameweek's finality instant. FW-2 derives it (`fantasyGameweeks.finalityAt`,
 * from `lib/fantasyGameweekWindows.windowFor`), and every check here reads that
 * value. Nothing recomputes the cut, and nothing caches it.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  ApiFootballClient,
  credentialsFromEnv,
  fetchFixtureEvents,
  fetchFixturePlayers,
} from "./fantasyApiFootball";
import {
  fantasyPlayerStatsValidator,
  fantasySlot,
  fantasyTimedEventValidator,
} from "./schema";
import { SCORING_SPEC_VERSION } from "./lib/fantasyScoring";
import {
  matchContextFor,
  slotFromFeedPosition,
  statsFromFeed,
  timedEventsByPlayer,
  entryMinute as entryMinuteOf,
} from "./lib/fantasyFeedStats";
import {
  assertCrowdFactorInBand,
  fixtureInputHashOf,
  FT_CLASS_STATUS,
  scoreAllContexts,
  scoreabilityOf,
  statHashOf,
  type PlayerFixtureLine,
} from "./lib/fantasyScorePipeline";

// ───────────────────────────────────────────────────────────────── cadence

/**
 * R2: "a cron polls fixtures whose kickoff is more than 2h past and which are
 * not yet scored".
 *
 * Two hours is a post-fixture margin, not a guess at when the feed settles: a
 * match plus stoppage plus the provider's own write-up lands inside it, and a
 * fixture that is still `live` at +2h simply is not read (the status test is
 * independent and comes first).
 */
export const SCORING_DELAY_AFTER_KICKOFF_MS = 2 * 60 * 60 * 1000;

/**
 * How many extra reads a SCORED fixture is allowed, looking for a revision.
 *
 * R4 requires a changed stat hash to be noticed before finality, which is only
 * possible by re-reading a fixture that already scored. Left unbounded that is a
 * poll on every cron tick for the whole weekend; bounded at 2, spaced 6h apart,
 * it costs 4 requests per fixture over the window and still catches the
 * corrections that actually happen (they land within a day, not within a week).
 *
 * The budget is per fixture and is what keeps a gameweek's LIFETIME spend at
 * fixtures x 3 x 2 requests — 288 for the biggest gameweek in the bootstrapped
 * season, against the ticket's 500 ceiling.
 */
export const REVISION_CHECK_BUDGET = 2;
const REVISION_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** A fixture that came back unscoreable is retried, but not on every tick. */
const AWAITING_RETRY_INTERVAL_MS = 30 * 60 * 1000;

/** /fixtures/players + /fixtures/events. */
export const CALLS_PER_FIXTURE = 2;

/** The ticket's gate: STOP if a gameweek's projected spend exceeds this. */
export const GAMEWEEK_CALL_BUDGET = 500;

/** How many fixtures one action run will read. Keeps a run well inside limits. */
const DEFAULT_FIXTURE_LIMIT = 24;

// ─────────────────────────────────────────────────────────── result shapes
//
// Explicit on every action and mutation, for the reason FW-2 recorded in D10b:
// an action that spreads a same-module `ctx.runMutation` result into its own
// return value forms a type cycle through `_generated/api`, and TypeScript
// resolves it by silently widening something in an unrelated file.

export interface PlannedFixture {
  providerFixtureId: string;
  fixtureId: Id<"fantasyFixtures">;
  gameweekId: Id<"fantasyGameweeks">;
  gwNumber: number;
  season: string;
  kickoffAt: number;
  fixtureStatus: string;
  /** "first" = never scored; "revision" = scored, re-reading for a change. */
  readKind: "first" | "retry" | "revision";
  revisionChecks: number;
}

export interface PlannedGameweek {
  gameweekId: Id<"fantasyGameweeks">;
  gwNumber: number;
  season: string;
  finalityAt: number;
  fixturesInGameweek: number;
  fixturesDueNow: number;
  callsThisRun: number;
  /** Lifetime ceiling: fixtures x (1 first read + budget) x 2 calls. */
  projectedCallsForGameweek: number;
}

export interface ScoringPlan {
  now: number;
  gameweeks: PlannedGameweek[];
  fixtures: PlannedFixture[];
  callsThisRun: number;
  /** Gameweeks whose lifetime projection breaks GAMEWEEK_CALL_BUDGET. */
  overBudget: PlannedGameweek[];
  /** Fixtures past +2h that are NOT read because they are not FT-class. */
  notFinished: { providerFixtureId: string; fixtureStatus: string }[];
}

export interface ApplyFixtureStatsResult {
  providerFixtureId: string;
  gwNumber: number;
  /** True when the stat hash was unchanged and nothing was written (R2). */
  noop: boolean;
  scoreable: boolean;
  awaitingReason: string | null;
  unscoreableReason: string | null;
  /** Why this fixture holds no scores, when it holds none. */
  notScoredReason: string | null;
  /** True when the gameweek is past its finality instant: raw only (R4). */
  afterFinality: boolean;
  rawRevisionsWritten: number;
  scoreVersionsWritten: number;
  scoresUnchanged: number;
  finalizedScoresLeftAlone: number;
  playerRows: number;
  fixtureInputHash: string | null;
}

export interface ScoreDueFixturesResult {
  plan: {
    fixturesDue: number;
    callsThisRun: number;
    gameweeks: PlannedGameweek[];
    notFinished: number;
  };
  dryRun: boolean;
  fixturesRead: number;
  callsSpent: number;
  dailyRemainingBefore: number | null;
  dailyRemainingAfter: number | null;
  results: ApplyFixtureStatsResult[];
  failures: { providerFixtureId: string; error: string }[];
}

// ────────────────────────────────────────────────────────────────── helpers

async function fixtureScoringRow(
  ctx: QueryCtx | MutationCtx,
  fixtureId: Id<"fantasyFixtures">,
): Promise<Doc<"fantasyFixtureScoring"> | null> {
  return ctx.db
    .query("fantasyFixtureScoring")
    .withIndex("by_fixture", (q) => q.eq("fixtureId", fixtureId))
    .first();
}

export async function gameweekScoringRow(
  ctx: QueryCtx | MutationCtx,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<Doc<"fantasyGameweekScoring"> | null> {
  return ctx.db
    .query("fantasyGameweekScoring")
    .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweekId))
    .first();
}

/**
 * The current (highest, un-superseded) score version for a player in a gameweek.
 *
 * Keyed on the PROVIDER player id rather than the Convex id, for the reason
 * FW-3's draft log records in item 5b: it is the identifier that survives the
 * deletion of a `fantasyPlayers` row, and it is environment-independent.
 */
export async function currentScoreRow(
  ctx: QueryCtx | MutationCtx,
  gameweekId: Id<"fantasyGameweeks">,
  providerPlayerId: string,
): Promise<Doc<"fantasyPlayerScores"> | null> {
  return ctx.db
    .query("fantasyPlayerScores")
    .withIndex("by_gameweek_player_version", (q) =>
      q.eq("gameweekId", gameweekId).eq("providerPlayerId", providerPlayerId),
    )
    .order("desc")
    .first();
}

/**
 * Is this gameweek past the cut?
 *
 * The INSTANT decides, not the status row: a finalization cron that has not run
 * yet must not be a window in which new scores can still land. FW-2 owns the
 * instant; this reads it.
 */
export function isAfterFinality(
  gameweek: Doc<"fantasyGameweeks">,
  scoring: Doc<"fantasyGameweekScoring"> | null,
  now: number,
): boolean {
  return now >= gameweek.finalityAt || scoring?.state === "final";
}

// ─────────────────────────────────────────────────────────────── the plan

/**
 * What is due to be read, and what it costs. Pure of the network.
 *
 * The gameweek table is collected whole rather than indexed: a season is ~49
 * rows (36 weekend + 13 midweek, measured on the bootstrapped 2026-2027 season)
 * and there is no index that would narrow "windows that have not settled yet"
 * without duplicating FW-2's finality derivation into a stored field, which
 * FW-4's contract forbids.
 */
export const scoringPlan = internalQuery({
  args: { now: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<ScoringPlan> => {
    const now = args.now ?? Date.now();
    const limit = args.limit ?? DEFAULT_FIXTURE_LIMIT;
    const readableBefore = now - SCORING_DELAY_AFTER_KICKOFF_MS;

    const gameweeks = await ctx.db.query("fantasyGameweeks").collect();
    const plannedGameweeks: PlannedGameweek[] = [];
    const due: PlannedFixture[] = [];
    const notFinished: { providerFixtureId: string; fixtureStatus: string }[] = [];

    for (const gameweek of gameweeks) {
      // Past the cut: nothing here can produce a score any more (R3/R4), so it
      // is not worth a request. Raw revisions are still recorded if something
      // else reads the fixture, but the pipeline stops chasing them.
      if (now >= gameweek.finalityAt) continue;

      const fixtures = await ctx.db
        .query("fantasyFixtures")
        .withIndex("by_gameweek_kickoff", (q) =>
          q.eq("gameweekId", gameweek._id).lte("kickoffAt", readableBefore),
        )
        .collect();
      if (fixtures.length === 0) continue;

      const allFixtures = await ctx.db
        .query("fantasyFixtures")
        .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
        .collect();

      let dueHere = 0;
      for (const fixture of fixtures) {
        if (fixture.status !== FT_CLASS_STATUS) {
          notFinished.push({
            providerFixtureId: fixture.providerFixtureId,
            fixtureStatus: fixture.status,
          });
          continue;
        }

        const scoring = await fixtureScoringRow(ctx, fixture._id);
        let readKind: PlannedFixture["readKind"] | null = null;

        if (scoring === null) {
          readKind = "first";
        } else if (scoring.state === "awaiting_data") {
          if (now - scoring.lastAttemptAt >= AWAITING_RETRY_INTERVAL_MS) readKind = "retry";
        } else {
          const checks = scoring.revisionChecks ?? 0;
          if (
            checks < REVISION_CHECK_BUDGET &&
            now - scoring.lastAttemptAt >= REVISION_CHECK_INTERVAL_MS
          ) {
            readKind = "revision";
          }
        }

        if (readKind === null) continue;
        dueHere += 1;
        due.push({
          providerFixtureId: fixture.providerFixtureId,
          fixtureId: fixture._id,
          gameweekId: gameweek._id,
          gwNumber: gameweek.gwNumber,
          season: gameweek.season,
          kickoffAt: fixture.kickoffAt,
          fixtureStatus: fixture.status,
          readKind,
          revisionChecks: scoring?.revisionChecks ?? 0,
        });
      }

      plannedGameweeks.push({
        gameweekId: gameweek._id,
        gwNumber: gameweek.gwNumber,
        season: gameweek.season,
        finalityAt: gameweek.finalityAt,
        fixturesInGameweek: allFixtures.length,
        fixturesDueNow: dueHere,
        callsThisRun: dueHere * CALLS_PER_FIXTURE,
        projectedCallsForGameweek:
          allFixtures.length * (1 + REVISION_CHECK_BUDGET) * CALLS_PER_FIXTURE,
      });
    }

    // Oldest kickoff first: a fixture that has waited longest is the one a user
    // is most likely staring at an "awaiting data" label for.
    due.sort((a, b) => a.kickoffAt - b.kickoffAt);
    const fixtures = due.slice(0, limit);

    return {
      now,
      gameweeks: plannedGameweeks.filter((g) => g.fixturesDueNow > 0 || g.projectedCallsForGameweek > GAMEWEEK_CALL_BUDGET),
      fixtures,
      callsThisRun: fixtures.length * CALLS_PER_FIXTURE,
      overBudget: plannedGameweeks.filter(
        (g) => g.projectedCallsForGameweek > GAMEWEEK_CALL_BUDGET,
      ),
      notFinished,
    };
  },
});

// ───────────────────────────────────────────────────────────── write path

const feedRowValidator = v.object({
  providerPlayerId: v.string(),
  clubId: v.string(),
  /** The feed's lineup position for this appearance, mapped. Null if absent. */
  feedPosition: v.union(fantasySlot, v.null()),
  stats: fantasyPlayerStatsValidator,
  events: v.array(fantasyTimedEventValidator),
  entryMinute: v.union(v.number(), v.null()),
  /**
   * CROWD_VOTING has not shipped, so this is absent everywhere and treated as 0
   * (R5). The argument exists so the pipeline that will carry a factor is the
   * pipeline that is tested against the band today, rather than a later edit to
   * a path nobody has exercised.
   */
  crowdFactor: v.optional(v.number()),
});

/**
 * Ingest one fixture's stats and score it. The ONLY write path, and idempotent
 * from end to end.
 *
 * Takes normalised rows rather than the raw feed envelope, because a mutation
 * cannot touch the network and because the regression gate needs to drive this
 * exact code with rows the sim harness produced from its own on-disk sample.
 * The normalisation itself is shared with the harness
 * (lib/fantasyFeedStats.ts) — see FW-4 P2.
 */
export const applyFixtureStats = internalMutation({
  args: {
    providerFixtureId: v.string(),
    hasPlayerStats: v.boolean(),
    hasEvents: v.boolean(),
    rows: v.array(feedRowValidator),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ApplyFixtureStatsResult> => {
    const now = args.now ?? Date.now();

    // R5, FIRST — before the fixture is even looked up, and long before the
    // idempotence short-circuit below. A factor outside ±15% is rejected on
    // every path, including the one where nothing else would have been written:
    // "already ingested" must never be able to swallow a bad number.
    for (const row of args.rows) {
      assertCrowdFactorInBand(row.crowdFactor ?? 0, `player ${row.providerPlayerId}`);
    }

    const fixture = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_providerFixtureId", (q) =>
        q.eq("providerFixtureId", args.providerFixtureId),
      )
      .first();
    if (fixture === null) {
      // Never invent a fixture. FW-2's ingestion owns that table; a stat line
      // for a fixture it has not seen means the two are out of step, and writing
      // a score against nothing would bury it.
      throw new Error(
        `No fantasyFixtures row for provider fixture ${args.providerFixtureId}. Run fantasyIngest:syncFixtures first.`,
      );
    }

    const gameweek = await ctx.db.get(fixture.gameweekId);
    if (gameweek === null) {
      throw new Error(`Fixture ${args.providerFixtureId} references a missing gameweek.`);
    }

    const gwScoring = await gameweekScoringRow(ctx, gameweek._id);
    const afterFinality = isAfterFinality(gameweek, gwScoring, now);

    // ── build one scoreable line per feed row ──
    const hasFixtureScore = fixture.homeGoals !== undefined && fixture.awayGoals !== undefined;
    const homeGoals = fixture.homeGoals ?? 0;
    const awayGoals = fixture.awayGoals ?? 0;

    let playedRowsWithoutPosition = 0;
    let rowsWithUnknownClub = 0;

    const lines: (PlayerFixtureLine & {
      providerPlayerId: string;
      clubId: string;
      crowdFactor: number;
      statHash: string;
    })[] = [];

    for (const row of args.rows) {
      const isHome = row.clubId === fixture.homeClubId;
      const isAway = row.clubId === fixture.awayClubId;
      if (!isHome && !isAway) rowsWithUnknownClub += 1;
      if (row.feedPosition === null && row.stats.minutes > 0) playedRowsWithoutPosition += 1;

      const line: PlayerFixtureLine & {
        providerPlayerId: string;
        clubId: string;
        crowdFactor: number;
        statHash: string;
      } = {
        providerPlayerId: row.providerPlayerId,
        clubId: row.clubId,
        stats: row.stats,
        context: matchContextFor(
          isHome ? homeGoals : awayGoals,
          isHome ? awayGoals : homeGoals,
        ),
        events: row.events,
        entryMinute: row.entryMinute,
        verdictPosition: row.feedPosition,
        crowdFactor: row.crowdFactor ?? 0,
        statHash: "",
      };
      lines.push({ ...line, statHash: statHashOf(line) });
    }

    const scoreability = scoreabilityOf({
      fixtureStatus: fixture.status,
      hasPlayerStats: args.hasPlayerStats && args.rows.length > 0,
      hasEvents: args.hasEvents,
      playedRowsWithoutPosition,
      hasFixtureScore,
      rowsWithUnknownClub,
    });

    const fixtureInputHash = fixtureInputHashOf(lines);
    const existing = await fixtureScoringRow(ctx, fixture._id);

    // ── R2's no-op ──
    //
    // Same hash, already scored: no raw row, no score row, no state change. The
    // ONLY field that moves is the poll bookkeeping (lastAttemptAt and the
    // revision-check counter), which is a fact about this pipeline's polling and
    // not about the fixture's data — and it is what stops the pipeline re-reading
    // a settled fixture forever.
    if (
      existing !== null &&
      existing.state === "scored" &&
      existing.fixtureInputHash === fixtureInputHash
    ) {
      await ctx.db.patch(existing._id, {
        lastAttemptAt: now,
        revisionChecks: (existing.revisionChecks ?? 0) + 1,
        fixtureStatus: fixture.status,
      });
      return {
        providerFixtureId: args.providerFixtureId,
        gwNumber: gameweek.gwNumber,
        noop: true,
        scoreable: true,
        awaitingReason: null,
        unscoreableReason: null,
        notScoredReason: null,
        afterFinality,
        rawRevisionsWritten: 0,
        scoreVersionsWritten: 0,
        scoresUnchanged: lines.length,
        finalizedScoresLeftAlone: 0,
        playerRows: lines.length,
        fixtureInputHash,
      };
    }

    // ── raw rows (R4) ──
    //
    // Written for an FT-class fixture even when it cannot be scored: the raw
    // line is the record of what the feed said, and the reason a later scoring
    // pass does not have to re-read it. NOT written for a fixture that is not
    // FT-class — that would be an in-play snapshot, which R2 forbids.
    let rawRevisionsWritten = 0;
    const rawRevisionByPlayer = new Map<string, number>();
    const playerIdByProviderId = new Map<string, Id<"fantasyPlayers">>();

    if (fixture.status === FT_CLASS_STATUS) {
      for (const line of lines) {
        const player = await ctx.db
          .query("fantasyPlayers")
          .withIndex("by_providerPlayerId", (q) =>
            q.eq("providerPlayerId", line.providerPlayerId),
          )
          .first();
        if (player !== null) playerIdByProviderId.set(line.providerPlayerId, player._id);

        const current = await ctx.db
          .query("fantasyFixtureStats")
          .withIndex("by_fixture_player_revision", (q) =>
            q.eq("fixtureId", fixture._id).eq("providerPlayerId", line.providerPlayerId),
          )
          .order("desc")
          .first();

        if (current !== null && current.statHash === line.statHash) {
          rawRevisionByPlayer.set(line.providerPlayerId, current.revision);
          continue;
        }

        const revision = (current?.revision ?? 0) + 1;
        await ctx.db.insert("fantasyFixtureStats", {
          fixtureId: fixture._id,
          gameweekId: gameweek._id,
          providerPlayerId: line.providerPlayerId,
          ...(player === null ? {} : { playerId: player._id }),
          clubId: line.clubId,
          revision,
          statHash: line.statHash,
          feedPosition: line.verdictPosition,
          stats: line.stats,
          events: [...line.events],
          entryMinute: line.entryMinute,
          fixtureStatus: fixture.status,
          ingestedAt: now,
        });
        rawRevisionByPlayer.set(line.providerPlayerId, revision);
        rawRevisionsWritten += 1;
      }
    }

    // ── scores ──
    let scoreVersionsWritten = 0;
    let scoresUnchanged = 0;
    let finalizedScoresLeftAlone = 0;

    if (scoreability.scoreable && !afterFinality) {
      for (const line of lines) {
        // R5, before anything is written: a factor outside the band throws and
        // takes the whole transaction with it.
        assertCrowdFactorInBand(line.crowdFactor, `player ${line.providerPlayerId}`);

        const current = await currentScoreRow(ctx, gameweek._id, line.providerPlayerId);

        if (current !== null && current.state === "final") {
          // Unreachable while `afterFinality` is false, because finalization and
          // the cut are the same instant. Asserted rather than assumed: this is
          // the invariant R4 asks for, and a future caller that reaches it gets
          // counted rather than silently overwriting a settled number.
          finalizedScoresLeftAlone += 1;
          continue;
        }

        if (
          current !== null &&
          current.statHash === line.statHash &&
          current.crowdFactor === line.crowdFactor
        ) {
          scoresUnchanged += 1;
          continue;
        }

        const version = (current?.version ?? 0) + 1;
        const playerId = playerIdByProviderId.get(line.providerPlayerId);
        await ctx.db.insert("fantasyPlayerScores", {
          gameweekId: gameweek._id,
          fixtureId: fixture._id,
          providerPlayerId: line.providerPlayerId,
          ...(playerId === undefined ? {} : { playerId }),
          version,
          state: "provisional",
          baseScores: scoreAllContexts(line),
          crowdFactor: line.crowdFactor,
          verdictPosition: line.verdictPosition,
          statHash: line.statHash,
          rawRevision: rawRevisionByPlayer.get(line.providerPlayerId) ?? 1,
          ...(current === null ? {} : { revisedFrom: current.version }),
          specVersion: SCORING_SPEC_VERSION,
          scoredAt: now,
        });
        if (current !== null) {
          // The superseded row keeps its numbers; only the pointer is added.
          await ctx.db.patch(current._id, { supersededByVersion: version });
        }
        scoreVersionsWritten += 1;
      }
    }

    // ── fixture status row ──
    //
    // "scored" means THIS FIXTURE HAS SCORE ROWS — not "its data looked fine".
    // The difference is a fixture whose feed arrived after the cut: the stats are
    // perfectly good, they are recorded as raw, and no score exists or ever will
    // (R4). Labelling that "scored" would tell every read surface its players
    // have totals, and R7's whole point is that a player with no score reads
    // "awaiting data" rather than zero.
    const hadScores = existing !== null && existing.state === "scored";
    const wroteScores = scoreability.scoreable && !afterFinality;
    const scored = wroteScores || hadScores;
    const state: Doc<"fantasyFixtureScoring">["state"] = scored ? "scored" : "awaiting_data";
    const scoredPlayerRows = scored ? lines.length : 0;
    const notScoredReason = scored
      ? null
      : (scoreability.unscoreableReason ??
        (afterFinality
          ? "the feed arrived after this gameweek's finality instant: recorded as raw, scores unchanged (R4)"
          : scoreability.awaitingReason));

    if (existing === null) {
      await ctx.db.insert("fantasyFixtureScoring", {
        fixtureId: fixture._id,
        gameweekId: gameweek._id,
        state,
        ...(wroteScores ? { fixtureInputHash } : {}),
        fixtureStatus: fixture.status,
        hasPlayerStats: args.hasPlayerStats && args.rows.length > 0,
        hasEvents: args.hasEvents,
        playerRows: lines.length,
        scoredPlayerRows,
        revisions: 0,
        ...(afterFinality && rawRevisionsWritten > 0
          ? { postFinalityRevisions: rawRevisionsWritten }
          : {}),
        revisionChecks: 0,
        ...(notScoredReason === null ? {} : { notScoredReason }),
        ...(scored ? { firstScoredAt: now, scoredAt: now } : {}),
        lastAttemptAt: now,
      });
    } else {
      await ctx.db.patch(existing._id, {
        state,
        ...(wroteScores ? { fixtureInputHash } : {}),
        fixtureStatus: fixture.status,
        hasPlayerStats: args.hasPlayerStats && args.rows.length > 0,
        hasEvents: args.hasEvents,
        playerRows: lines.length,
        scoredPlayerRows,
        revisions: existing.revisions + (scoreVersionsWritten > 0 && existing.state === "scored" ? 1 : 0),
        ...(afterFinality && rawRevisionsWritten > 0
          ? { postFinalityRevisions: (existing.postFinalityRevisions ?? 0) + rawRevisionsWritten }
          : {}),
        // A changed hash resets the revision-check budget: the fixture moved, so
        // it earns a fresh look for the correction after the correction.
        revisionChecks: existing.fixtureInputHash === fixtureInputHash ? (existing.revisionChecks ?? 0) : 0,
        notScoredReason: notScoredReason ?? undefined,
        ...(scored
          ? { scoredAt: now, firstScoredAt: existing.firstScoredAt ?? now }
          : {}),
        lastAttemptAt: now,
      });
    }

    // ── gameweek status row ──
    await refreshGameweekScoring(ctx, gameweek, now);

    if (scoreability.unscoreableReason !== null) {
      // FT-class and still not scoreable is the ticket's STOP condition. It is
      // logged loudly AND left on the fixture row (`notScoredReason`) so it is
      // queryable; the 6h alert reads the same fact.
      console.error(
        `[FW-4] fixture ${args.providerFixtureId} (GW${gameweek.gwNumber}) is ${scoreability.unscoreableReason}`,
      );
    }

    return {
      providerFixtureId: args.providerFixtureId,
      gwNumber: gameweek.gwNumber,
      noop: false,
      scoreable: scoreability.scoreable,
      awaitingReason: scoreability.awaitingReason,
      unscoreableReason: scoreability.unscoreableReason,
      notScoredReason,
      afterFinality,
      rawRevisionsWritten,
      scoreVersionsWritten,
      scoresUnchanged,
      finalizedScoresLeftAlone,
      playerRows: lines.length,
      fixtureInputHash,
    };
  },
});

// ──────────────────────────────────────────────── finalization + the alert
//
// R3: "provisional on fixture ingest; final at the gameweek's finality instant
// (from FW-2). Finalization is a cron consuming FW-2's instant, idempotent."
//
// R7: "Alert (log + a queryable flag) if any fixture in a gameweek is unscored
// 6h before the finality instant."

/** How long before the cut R7's alert fires. */
export const UNSCORED_ALERT_LEAD_MS = 6 * 60 * 60 * 1000;

/** Score rows flipped per transaction. A busy gameweek carries ~1,800 of them. */
const FINALIZE_CHUNK = 200;

export interface SettlementCandidate {
  gameweekId: Id<"fantasyGameweeks">;
  season: string;
  gwNumber: number;
  finalityAt: number;
  scoringState: "provisional" | "final" | null;
  fixturesTotal: number;
  fixturesScored: number;
  /** Fixtures with no `scored` status row. Postponements included, with reasons. */
  unscored: { providerFixtureId: string; fixtureStatus: string; reason: string | null }[];
  needsFinalization: boolean;
  needsAlert: boolean;
  msToFinality: number;
}

export interface SettlementPlan {
  now: number;
  candidates: SettlementCandidate[];
}

/**
 * Which gameweeks need settling, and which need the 6h alert.
 *
 * A gameweek needs finalization when `now >= finalityAt` and its scoring row is
 * not `final` yet. It needs an alert when the cut is 6h or less away, has not
 * passed, something is unscored, and no alert has been written — once, not on
 * every tick, because an alert that repeats is an alert nobody reads.
 */
export const settlementPlan = internalQuery({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args): Promise<SettlementPlan> => {
    const now = args.now ?? Date.now();
    const gameweeks = await ctx.db.query("fantasyGameweeks").collect();
    const candidates: SettlementCandidate[] = [];

    for (const gameweek of gameweeks) {
      const msToFinality = gameweek.finalityAt - now;
      const withinAlertWindow = msToFinality > 0 && msToFinality <= UNSCORED_ALERT_LEAD_MS;
      const pastCut = msToFinality <= 0;
      if (!withinAlertWindow && !pastCut) continue;

      const scoring = await gameweekScoringRow(ctx, gameweek._id);
      if (pastCut && scoring?.state === "final") continue; // already settled
      if (withinAlertWindow && scoring?.unscoredAlertAt !== undefined) continue; // already alerted

      const fixtures = await ctx.db
        .query("fantasyFixtures")
        .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
        .collect();
      if (fixtures.length === 0) continue; // a window with no fixtures is not a gameweek

      const unscored: SettlementCandidate["unscored"] = [];
      let fixturesScored = 0;
      for (const fixture of fixtures) {
        const row = await fixtureScoringRow(ctx, fixture._id);
        if (row !== null && row.state === "scored") {
          fixturesScored += 1;
          continue;
        }
        unscored.push({
          providerFixtureId: fixture.providerFixtureId,
          fixtureStatus: fixture.status,
          reason: row?.notScoredReason ?? null,
        });
      }

      const needsAlert = withinAlertWindow && unscored.length > 0;
      const needsFinalization = pastCut;
      if (!needsAlert && !needsFinalization) continue;

      candidates.push({
        gameweekId: gameweek._id,
        season: gameweek.season,
        gwNumber: gameweek.gwNumber,
        finalityAt: gameweek.finalityAt,
        scoringState: scoring?.state ?? null,
        fixturesTotal: fixtures.length,
        fixturesScored,
        unscored,
        needsFinalization,
        needsAlert,
        msToFinality,
      });
    }

    candidates.sort((a, b) => a.finalityAt - b.finalityAt);
    return { now, candidates };
  },
});

export interface FinalizeChunkResult {
  gwNumber: number;
  season: string;
  finalityAt: number;
  /** False when called before the cut: finalization refuses to run early. */
  eligible: boolean;
  rowsFinalized: number;
  /** True when no provisional current-version row remains. */
  done: boolean;
  gameweekState: "provisional" | "final";
  fixturesScored: number;
  fixturesTotal: number;
  unscoredAtFinality: number;
}

/**
 * Flip one chunk of a gameweek's current score rows from provisional to final.
 *
 * IDEMPOTENT three times over: it refuses to run before the cut, it only ever
 * touches rows whose state is still `provisional`, and a second call after the
 * last chunk finds nothing and returns done. Re-running it produces byte-
 * identical rows, because `finalizedAt` is only written on the transition.
 *
 * SUPERSEDED VERSIONS ARE LEFT ALONE, on purpose. A row that was replaced before
 * the cut was never the final number, and relabelling it `final` would say it
 * was. `supersededByVersion` is what marks it, and the filter here is what keeps
 * the pass from finding it again forever.
 *
 * The only field it writes on a score row is `state` (plus the `finalizedAt`
 * stamp) — R4's guarantee that no code path updates a finalized SCORE holds
 * because no code path here touches baseScores, crowdFactor or verdictPosition.
 */
export const finalizeGameweekChunk = internalMutation({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<FinalizeChunkResult> => {
    const now = args.now ?? Date.now();
    const limit = args.limit ?? FINALIZE_CHUNK;

    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) throw new Error("Gameweek not found.");

    // FW-2's instant, consumed. Nothing here derives or second-guesses it.
    if (now < gameweek.finalityAt) {
      const scoring = await gameweekScoringRow(ctx, gameweek._id);
      return {
        gwNumber: gameweek.gwNumber,
        season: gameweek.season,
        finalityAt: gameweek.finalityAt,
        eligible: false,
        rowsFinalized: 0,
        done: false,
        gameweekState: scoring?.state ?? "provisional",
        fixturesScored: scoring?.fixturesScored ?? 0,
        fixturesTotal: scoring?.fixturesTotal ?? 0,
        unscoredAtFinality: 0,
      };
    }

    const provisional = await ctx.db
      .query("fantasyPlayerScores")
      .withIndex("by_gameweek_state", (q) =>
        q.eq("gameweekId", gameweek._id).eq("state", "provisional"),
      )
      .filter((q) => q.eq(q.field("supersededByVersion"), undefined))
      .take(limit);

    for (const row of provisional) {
      await ctx.db.patch(row._id, { state: "final", finalizedAt: now });
    }

    const done = provisional.length < limit;

    // Counts come from the fixture rows, not from a running total, so a re-run
    // cannot drift them.
    const fixtures = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
      .collect();
    const scoredFixtures = await ctx.db
      .query("fantasyFixtureScoring")
      .withIndex("by_gameweek_state", (q) =>
        q.eq("gameweekId", gameweek._id).eq("state", "scored"),
      )
      .collect();

    const existing = await gameweekScoringRow(ctx, gameweek._id);
    const alreadyFinalized = existing?.scoreRowsFinalized ?? 0;
    const totalFinalized = alreadyFinalized + provisional.length;

    if (existing === null) {
      await ctx.db.insert("fantasyGameweekScoring", {
        gameweekId: gameweek._id,
        state: done ? "final" : "provisional",
        fixturesTotal: fixtures.length,
        fixturesScored: scoredFixtures.length,
        ...(done ? { finalizedAt: now } : {}),
        scoreRowsFinalized: totalFinalized,
      });
    } else {
      await ctx.db.patch(existing._id, {
        state: done ? "final" : existing.state,
        fixturesTotal: fixtures.length,
        fixturesScored: scoredFixtures.length,
        scoreRowsFinalized: totalFinalized,
        ...(done && existing.finalizedAt === undefined ? { finalizedAt: now } : {}),
      });
    }

    // ── the one write outside this ticket's own tables ──
    //
    // `fantasyGameweeks.status` is FW-1/FW-2's lifecycle field, and its schema
    // comment reserves this exact write: "a lifecycle field driven by the passage
    // of time and (later) by settlement". Settlement is this pass.
    //
    // It is not cosmetic. `fantasyDraftRooms.targetGameweek` picks the
    // earliest-finality gameweek whose status is upcoming|live, so with nothing
    // ever moving the field, every crew room opened after the first weekend would
    // target that dead first weekend forever. Writing "final" at the cut is what
    // lets the draft room advance — and it correctly closes squad edits, which
    // `fantasySquads.gameweekAcceptsEdits` gates on the same field.
    if (done && gameweek.status !== "final") {
      await ctx.db.patch(gameweek._id, { status: "final" });
    }

    return {
      gwNumber: gameweek.gwNumber,
      season: gameweek.season,
      finalityAt: gameweek.finalityAt,
      eligible: true,
      rowsFinalized: provisional.length,
      done,
      gameweekState: done ? "final" : (existing?.state ?? "provisional"),
      fixturesScored: scoredFixtures.length,
      fixturesTotal: fixtures.length,
      unscoredAtFinality: fixtures.length - scoredFixtures.length,
    };
  },
});

export interface UnscoredAlertResult {
  gwNumber: number;
  season: string;
  written: boolean;
  unscoredCount: number;
  hoursToFinality: number;
}

/**
 * R7's alert: a log line AND a queryable flag, written once per gameweek.
 *
 * Both halves are required by the ruling and neither is redundant. The log is
 * what an operator watching the deployment sees at 6h; the flag is what a
 * dashboard, a test, or a later investigation can ask about — a log line that has
 * scrolled away is not a surface.
 *
 * The payload records each unscored fixture's STATUS and reason, because
 * "unscored" spans a postponement that will never be scored in this window
 * (nothing is broken) and an FT-class fixture the feed has not supplied
 * (something is). An alert that could not tell them apart would be noise within
 * a season.
 */
export const writeUnscoredAlert = internalMutation({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    now: v.optional(v.number()),
    unscored: v.array(
      v.object({
        providerFixtureId: v.string(),
        fixtureStatus: v.string(),
        reason: v.union(v.string(), v.null()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<UnscoredAlertResult> => {
    const now = args.now ?? Date.now();
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) throw new Error("Gameweek not found.");

    const hoursToFinality = (gameweek.finalityAt - now) / 3_600_000;
    const existing = await gameweekScoringRow(ctx, gameweek._id);

    if (existing?.unscoredAlertAt !== undefined) {
      return {
        gwNumber: gameweek.gwNumber,
        season: gameweek.season,
        written: false,
        unscoredCount: existing.unscoredAlertCount ?? 0,
        hoursToFinality,
      };
    }

    const fields = {
      unscoredAlertAt: now,
      unscoredAlertCount: args.unscored.length,
      unscoredAlertFixtures: args.unscored,
    };

    if (existing === null) {
      const fixtures = await ctx.db
        .query("fantasyFixtures")
        .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
        .collect();
      await ctx.db.insert("fantasyGameweekScoring", {
        gameweekId: gameweek._id,
        state: "provisional",
        fixturesTotal: fixtures.length,
        fixturesScored: fixtures.length - args.unscored.length,
        ...fields,
      });
    } else {
      await ctx.db.patch(existing._id, fields);
    }

    console.error(
      `[FW-4 ALERT] ${gameweek.season} GW${gameweek.gwNumber}: ${args.unscored.length} fixture(s) unscored ` +
        `${hoursToFinality.toFixed(1)}h before finality — ` +
        args.unscored
          .map((f) => `${f.providerFixtureId} (${f.fixtureStatus}${f.reason === null ? "" : `: ${f.reason}`})`)
          .join(", "),
    );

    return {
      gwNumber: gameweek.gwNumber,
      season: gameweek.season,
      written: true,
      unscoredCount: args.unscored.length,
      hoursToFinality,
    };
  },
});

export interface SettleGameweeksResult {
  now: number;
  finalized: FinalizeChunkResult[];
  alerted: UnscoredAlertResult[];
  candidates: number;
}

/**
 * The settlement cron: finalize what is past the cut, alert on what is 6h from
 * it.
 *
 * An action rather than a mutation because a busy gameweek's ~1,800 score rows
 * cannot be flipped in one transaction, and looping chunked mutations is the
 * house pattern for that (FW-2 D10a). It makes no network request at all.
 */
export const settleGameweeks = internalAction({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args): Promise<SettleGameweeksResult> => {
    const plan: SettlementPlan = await ctx.runQuery(internal.fantasyScores.settlementPlan, {
      ...(args.now === undefined ? {} : { now: args.now }),
    });

    const finalized: FinalizeChunkResult[] = [];
    const alerted: UnscoredAlertResult[] = [];

    for (const candidate of plan.candidates) {
      if (candidate.needsAlert) {
        const result: UnscoredAlertResult = await ctx.runMutation(
          internal.fantasyScores.writeUnscoredAlert,
          {
            gameweekId: candidate.gameweekId,
            unscored: candidate.unscored,
            ...(args.now === undefined ? {} : { now: args.now }),
          },
        );
        if (result.written) alerted.push(result);
      }

      if (!candidate.needsFinalization) continue;

      // Chunk until done. Bounded by construction: every chunk either flips
      // `limit` rows or is the last one.
      let guard = 0;
      let last: FinalizeChunkResult | null = null;
      while (guard < 200) {
        guard += 1;
        const result: FinalizeChunkResult = await ctx.runMutation(
          internal.fantasyScores.finalizeGameweekChunk,
          {
            gameweekId: candidate.gameweekId,
            ...(args.now === undefined ? {} : { now: args.now }),
          },
        );
        last = result;
        if (!result.eligible || result.done) break;
      }
      if (last !== null) {
        finalized.push(last);
        console.log(
          `[FW-4] finalized ${last.season} GW${last.gwNumber}: ${last.fixturesScored}/${last.fixturesTotal} fixtures scored, ` +
            `${last.unscoredAtFinality} unscored at the cut, state ${last.gameweekState}`,
        );
      }
    }

    return {
      now: plan.now,
      finalized,
      alerted,
      candidates: plan.candidates.length,
    };
  },
});

/**
 * Recount a gameweek's scoring status.
 *
 * Derived from the fixture rows rather than incremented, so a re-run cannot
 * drift the counts — the same reason FW-2's ingestion upserts instead of
 * appending. Never touches `state`: only finalization moves that (R3).
 */
export async function refreshGameweekScoring(
  ctx: MutationCtx,
  gameweek: Doc<"fantasyGameweeks">,
  now: number,
): Promise<void> {
  const fixtures = await ctx.db
    .query("fantasyFixtures")
    .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
    .collect();
  const scoredRows = await ctx.db
    .query("fantasyFixtureScoring")
    .withIndex("by_gameweek_state", (q) =>
      q.eq("gameweekId", gameweek._id).eq("state", "scored"),
    )
    .collect();

  const existing = await gameweekScoringRow(ctx, gameweek._id);
  const fields = {
    fixturesTotal: fixtures.length,
    fixturesScored: scoredRows.length,
    lastScoredAt: now,
  };

  if (existing === null) {
    await ctx.db.insert("fantasyGameweekScoring", {
      gameweekId: gameweek._id,
      state: "provisional",
      ...fields,
      firstScoredAt: scoredRows.length > 0 ? now : undefined,
    });
    return;
  }
  await ctx.db.patch(existing._id, {
    ...fields,
    firstScoredAt: existing.firstScoredAt ?? (scoredRows.length > 0 ? now : undefined),
  });
}

// ────────────────────────────────────────────────────────────── the cron

/**
 * Read every due fixture and score it. 2 requests per fixture.
 *
 * The call plan is printed BEFORE the client is even constructed, and a gameweek
 * whose projected spend breaks GAMEWEEK_CALL_BUDGET aborts the run without a
 * single request — the ticket's gate, and the only useful place for it is here,
 * ahead of the first pull rather than after the budget is gone.
 */
export const scoreDueFixtures = internalAction({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ScoreDueFixturesResult> => {
    const plan: ScoringPlan = await ctx.runQuery(internal.fantasyScores.scoringPlan, {
      ...(args.now === undefined ? {} : { now: args.now }),
      ...(args.limit === undefined ? {} : { limit: args.limit }),
    });

    // ── the call plan, printed every run ──
    console.log(
      `[FW-4 call plan] ${plan.fixtures.length} fixture(s) due, ${plan.callsThisRun} request(s) this run ` +
        `(${CALLS_PER_FIXTURE}/fixture: /fixtures/players + /fixtures/events)`,
    );
    for (const gw of plan.gameweeks) {
      console.log(
        `[FW-4 call plan]   ${gw.season} GW${gw.gwNumber}: ${gw.fixturesDueNow}/${gw.fixturesInGameweek} fixtures due, ` +
          `${gw.callsThisRun} calls now, ${gw.projectedCallsForGameweek} projected for the gameweek ` +
          `(ceiling ${GAMEWEEK_CALL_BUDGET})`,
      );
    }
    for (const skipped of plan.notFinished) {
      console.log(
        `[FW-4 call plan]   skipping ${skipped.providerFixtureId}: status ${skipped.fixtureStatus}, not FT-class (R2/R7)`,
      );
    }

    if (plan.overBudget.length > 0) {
      const detail = plan.overBudget
        .map((g) => `${g.season} GW${g.gwNumber} projects ${g.projectedCallsForGameweek}`)
        .join("; ");
      throw new Error(
        `[FW-4] STOP: projected gameweek spend exceeds ${GAMEWEEK_CALL_BUDGET} calls (${detail}). No request was made.`,
      );
    }

    if (args.dryRun === true || plan.fixtures.length === 0) {
      return {
        plan: {
          fixturesDue: plan.fixtures.length,
          callsThisRun: plan.callsThisRun,
          gameweeks: plan.gameweeks,
          notFinished: plan.notFinished.length,
        },
        dryRun: args.dryRun === true,
        fixturesRead: 0,
        callsSpent: 0,
        dailyRemainingBefore: null,
        dailyRemainingAfter: null,
        results: [],
        failures: [],
      };
    }

    const client = new ApiFootballClient(credentialsFromEnv());
    const results: ApplyFixtureStatsResult[] = [];
    const failures: { providerFixtureId: string; error: string }[] = [];
    let callsSpent = 0;
    let dailyRemainingBefore: number | null = null;

    for (const planned of plan.fixtures) {
      try {
        const teams = await fetchFixturePlayers(client, planned.providerFixtureId);
        callsSpent += 1;
        if (dailyRemainingBefore === null) dailyRemainingBefore = client.dailyRemaining;
        const events = await fetchFixtureEvents(client, planned.providerFixtureId);
        callsSpent += 1;

        const timed = timedEventsByPlayer(events);
        const rows = [];
        for (const team of teams) {
          for (const entry of team.players ?? []) {
            const statistics = entry.statistics?.[0];
            const base = statsFromFeed(statistics);
            const playerEvents = timed.get(entry.player.id) ?? [];
            const ownGoals = playerEvents.filter((e) => e.kind === "ownGoal").length;
            rows.push({
              providerPlayerId: String(entry.player.id),
              clubId: String(team.team.id),
              feedPosition: slotFromFeedPosition(statistics?.games?.position),
              stats: { ...base, ownGoals },
              events: playerEvents,
              entryMinute: entryMinuteOf(events, entry.player.id),
            });
          }
        }

        const result: ApplyFixtureStatsResult = await ctx.runMutation(
          internal.fantasyScores.applyFixtureStats,
          {
            providerFixtureId: planned.providerFixtureId,
            hasPlayerStats: rows.length > 0,
            hasEvents: events.length > 0,
            rows,
            ...(args.now === undefined ? {} : { now: args.now }),
          },
        );
        results.push(result);
      } catch (cause) {
        // One bad fixture does not abandon the rest of the weekend. The failure
        // is reported with the fixture id; the fixture stays unscored and its
        // players keep reading "awaiting data", which is the honest state.
        const error = cause instanceof Error ? cause.message : String(cause);
        console.error(`[FW-4] fixture ${planned.providerFixtureId} failed: ${error}`);
        failures.push({ providerFixtureId: planned.providerFixtureId, error });
      }
    }

    console.log(
      `[FW-4] read ${results.length} fixture(s), ${callsSpent} request(s) spent, ` +
        `provider reports ${client.dailyRemaining ?? "?"} remaining today`,
    );

    return {
      plan: {
        fixturesDue: plan.fixtures.length,
        callsThisRun: plan.callsThisRun,
        gameweeks: plan.gameweeks,
        notFinished: plan.notFinished.length,
      },
      dryRun: false,
      fixturesRead: results.length,
      callsSpent,
      dailyRemainingBefore,
      dailyRemainingAfter: client.dailyRemaining,
      results,
      failures,
    };
  },
});
