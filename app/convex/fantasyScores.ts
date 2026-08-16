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
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { fixtureForClub, lockStateForSlots } from "./fantasyLocks";
// Type-only, so the runtime module graph stays acyclic (fantasyCrowdVoting
// imports this module's helpers; the calls below go through `internal.…`).
import type {
  ApplyCrowdFactorsResult,
  RaterAccuracyResult,
} from "./fantasyCrowdVoting";
import {
  orderTiedGroup,
  type TiedGroupMember,
  type WeekendComparable,
} from "./lib/fantasyTieBreaks";
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
} from "./lib/fantasyScoreValidators";
import { SCORING_SPEC_VERSION, type Slot, type SlotRole } from "./lib/fantasyScoring";
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
  isMismatch,
  scoreAllContexts,
  scoreabilityOf,
  statHashOf,
  totalFor,
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
 * fixtures x 4 x 2 requests (first read + budget + last-look) — 384 for the
 * biggest gameweek in the bootstrapped season, against the ticket's 500 ceiling.
 *
 * THE BUDGET BOUNDS SPEND; IT CANNOT BOUND THE BLIND TAIL (FW-4R N1). A fixture
 * scored early in a long window spends both checks within twelve hours and is
 * then blind for the days between its last check and the cut — exactly where a
 * late correction would slip past R4. The last-look sweep below is what bounds
 * that tail: at finality−8h every scored fixture in the settling gameweek is
 * re-read once more, whatever its counter says.
 */
export const REVISION_CHECK_BUDGET = 2;
const REVISION_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * The last-look sweep (FW-4R N1): how far before the cut every scored fixture
 * of a settling gameweek is re-read one final time.
 *
 * Eight hours is late enough that the corrections a whole weekend produces have
 * landed, and early enough that a revision it catches still takes the normal
 * pre-finality path — a NEW score version (R4), visible to users before their
 * totals settle. An unchanged hash is R2's no-op.
 *
 * ONCE PER GAMEWEEK, WITHOUT A NEW FIELD. The sweep's record is the fixture's
 * own `lastAttemptAt`: a fixture is due for its last look only while that stamp
 * predates the window's start, and the read itself — no-op included — moves the
 * stamp past it. Re-running the plan therefore re-proposes nothing, and a
 * fixture first scored INSIDE the window is never proposed at all (its blind
 * tail is already shorter than the lead). If FW-2 moves the cut later, the
 * window moves with it and the sweep honestly runs again for the new tail.
 */
export const LAST_LOOK_LEAD_MS = 8 * 60 * 60 * 1000;

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
  /**
   * "first" = never scored; "retry" = unscoreable last time, trying again;
   * "revision" = scored, one of the budgeted early re-reads; "lastLook" =
   * scored, the once-per-gameweek finality−8h sweep (FW-4R N1).
   */
  readKind: "first" | "retry" | "revision" | "lastLook";
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
  /** Lifetime ceiling: fixtures x (1 first read + budget + 1 last look) x 2 calls. */
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
          // The last look outranks the budget test: it exists precisely for the
          // fixture whose counter is spent (see LAST_LOOK_LEAD_MS). `lastAttemptAt`
          // is both the trigger and the record — the read stamps it past the
          // window's start, so the sweep runs once per gameweek by construction.
          const lastLookFrom = gameweek.finalityAt - LAST_LOOK_LEAD_MS;
          const checks = scoring.revisionChecks ?? 0;
          if (now >= lastLookFrom && scoring.lastAttemptAt < lastLookFrom) {
            readKind = "lastLook";
          } else if (
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
          allFixtures.length * (1 + REVISION_CHECK_BUDGET + 1) * CALLS_PER_FIXTURE,
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

    // O3: a PASSED reclamation-court verdict overrides the feed's position
    // for the rest of this gameweek — a revision landing between a ruling
    // and finality must re-score WITH the ruling, not reset it to the feed.
    // Read inline (fantasyCourt imports this module; a value import back
    // would cycle the runtime graph).
    const passedClaims = await ctx.db
      .query("fantasyCourtClaims")
      .withIndex("by_gameweek_status", (q) =>
        q.eq("gameweekId", gameweek._id).eq("status", "passed"),
      )
      .collect();
    const courtVerdictByPlayer = new Map(
      passedClaims.map((c) => [c.providerPlayerId, c.claimedPosition]),
    );

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
        verdictPosition:
          courtVerdictByPlayer.get(row.providerPlayerId) ?? row.feedPosition,
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
    // a settled fixture forever. `lastAttemptAt` moving is also what marks a
    // last-look re-read done (FW-4R N1): once it passes the window's start, the
    // plan cannot propose the fixture again.
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
 * A gameweek needs settlement work when `now >= finalityAt` and its scoring row
 * is not `final` yet — where "final" is only written once BOTH halves of
 * settlement are done: every current score row flipped AND every squad's total
 * stamped (FW-4R N2/N3). That is what makes this plan the retry path for the
 * crash window between the two: finalize done, stamp lost, and the gameweek is
 * still a candidate on the next tick, where the (idempotent) finalize pass
 * flips nothing and the stamp pass completes the job.
 *
 * It needs an alert when the cut is 6h or less away, has not passed, something
 * is unscored, and no alert has been written — once, not on every tick, because
 * an alert that repeats is an alert nobody reads.
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
      // "final" means FULLY settled — rows flipped and totals stamped. A crash
      // between the two leaves it provisional, so it is revisited here (N3).
      if (pastCut && scoring?.state === "final") continue;
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
 * IT DOES NOT MARK THE GAMEWEEK SETTLED (FW-4R N3). `fantasyGameweekScoring.state`
 * flips to "final" only when the OTHER half of settlement — the squad-total
 * stamps — has also completed, in `stampSquadFinalTotals`. Rows-flipped with the
 * gameweek row still provisional is exactly the crash window the settlement plan
 * retries, and marking it settled here would close that window unstamped.
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

    // `state` is deliberately not touched: it says "settled", and settlement is
    // not done until the squad totals are stamped too (N3).
    if (existing === null) {
      await ctx.db.insert("fantasyGameweekScoring", {
        gameweekId: gameweek._id,
        state: "provisional",
        fixturesTotal: fixtures.length,
        fixturesScored: scoredFixtures.length,
        scoreRowsFinalized: totalFinalized,
      });
    } else {
      await ctx.db.patch(existing._id, {
        fixturesTotal: fixtures.length,
        fixturesScored: scoredFixtures.length,
        scoreRowsFinalized: totalFinalized,
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
      // Still "provisional" even when done: the gameweek is settled by the
      // stamping pass, not by this one (N3).
      gameweekState: existing?.state ?? "provisional",
      fixturesScored: scoredFixtures.length,
      fixturesTotal: fixtures.length,
      unscoredAtFinality: fixtures.length - scoredFixtures.length,
    };
  },
});

export interface StampSquadTotalsResult {
  gwNumber: number;
  /** False when called before the cut — a total is only settled after it. */
  eligible: boolean;
  stamped: number;
  alreadyStamped: number;
  /** True when every squad in the gameweek carries a stamped total. */
  done: boolean;
}

/** Squads stamped per transaction. Each costs ~26 indexed reads. */
const STAMP_CHUNK = 25;

/**
 * Stamp each squad's settled weekend total onto `fantasySquads.finalScore`,
 * and — once every squad carries one — mark the gameweek SETTLED.
 *
 * Runs after the score rows of a gameweek have gone final, and only then: the
 * numbers it records cannot move afterwards (R4), which is what makes a stored
 * total a record rather than a cache. Idempotent — a squad that already carries
 * one is skipped, so re-running writes nothing.
 *
 * This exists for the crew table. Cumulative points are a sum over every weekend
 * a crew has played, and re-deriving each of those from thirteen slot lookups
 * would make one crew page cost thousands of reads by the end of a season.
 *
 * THE SETTLEMENT STAMP LIVES HERE (FW-4R N2/N3). `fantasyGameweekScoring.state`
 * flips to "final" only when the last squad is stamped — the last write of the
 * whole settlement sequence — because that stamp is what every user-facing
 * "final" label derives from, and a label written before the work is done is a
 * label a crash can make a lie. Guarded: it refuses to mark settled while any
 * current-version score row is still provisional, so calling this pass out of
 * order cannot skip finalization.
 */
export const stampSquadFinalTotals = internalMutation({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<StampSquadTotalsResult> => {
    const now = args.now ?? Date.now();
    const limit = args.limit ?? STAMP_CHUNK;

    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) throw new Error("Gameweek not found.");
    if (now < gameweek.finalityAt) {
      return { gwNumber: gameweek.gwNumber, eligible: false, stamped: 0, alreadyStamped: 0, done: false };
    }

    const squads = await ctx.db
      .query("fantasySquads")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
      .collect();

    let stamped = 0;
    let alreadyStamped = 0;
    for (const squad of squads) {
      if (squad.finalScore !== undefined) {
        alreadyStamped += 1;
        continue;
      }
      if (stamped >= limit) {
        return { gwNumber: gameweek.gwNumber, eligible: true, stamped, alreadyStamped, done: false };
      }
      const score = await squadScore(ctx, squad, gameweek, now, false);
      await ctx.db.patch(squad._id, {
        finalScore: {
          total: score.total,
          scoredSlots: score.scoredSlots,
          awaitingSlots: score.awaitingSlots,
          emptySlots: score.emptySlots,
          at: now,
        },
      });
      stamped += 1;
    }

    // Every squad in the gameweek is stamped (there may be none at all): the
    // settlement sequence is complete, and only now may the gameweek say so.
    await markGameweekSettled(ctx, gameweek, now);

    return { gwNumber: gameweek.gwNumber, eligible: true, stamped, alreadyStamped, done: true };
  },
});

/**
 * The settlement stamp: `fantasyGameweekScoring.state = "final"`, written once,
 * as the LAST act of settling a gameweek.
 *
 * Refuses while any current-version score row is still provisional — the stamp
 * asserts "nothing here can change AND every derived record is written", and a
 * caller that reached this out of order must not be able to fake that. The
 * refusal is silent rather than a throw because the settlement cron will simply
 * complete the missing half and land here again (N3).
 */
async function markGameweekSettled(
  ctx: MutationCtx,
  gameweek: Doc<"fantasyGameweeks">,
  now: number,
): Promise<void> {
  const provisionalLeft = await ctx.db
    .query("fantasyPlayerScores")
    .withIndex("by_gameweek_state", (q) =>
      q.eq("gameweekId", gameweek._id).eq("state", "provisional"),
    )
    .filter((q) => q.eq(q.field("supersededByVersion"), undefined))
    .first();
  if (provisionalLeft !== null) return;

  const existing = await gameweekScoringRow(ctx, gameweek._id);
  if (existing === null) {
    // Reachable only when stamping ran on a gameweek nothing ever scored or
    // finalized (it holds no score rows at all). Settled-empty is still settled.
    const fixtures = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
      .collect();
    await ctx.db.insert("fantasyGameweekScoring", {
      gameweekId: gameweek._id,
      state: "final",
      fixturesTotal: fixtures.length,
      fixturesScored: 0,
      finalizedAt: now,
    });
    return;
  }
  if (existing.state !== "final") {
    await ctx.db.patch(existing._id, {
      state: "final",
      ...(existing.finalizedAt === undefined ? { finalizedAt: now } : {}),
    });
  }
}

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
  /** Squads whose settled weekend total was stamped, per gameweek. */
  stampedSquads: { gwNumber: number; squads: number }[];
  candidates: number;
}

/**
 * The settlement cron: finalize what is past the cut, alert on what is 6h from
 * it.
 *
 * An action rather than a mutation because a busy gameweek's ~1,800 score rows
 * cannot be flipped in one transaction, and looping chunked mutations is the
 * house pattern for that (FW-2 D10a). It makes no network request at all.
 *
 * CRASH-SAFE BY RE-ENTRY (N3): the sequence per gameweek is flip rows → stamp
 * squads → mark settled, every step idempotent, and the settled mark is the
 * last write. Die anywhere in the middle and the plan proposes the gameweek
 * again next tick; the steps already done flip/stamp nothing and the sequence
 * runs to the mark.
 */
export const settleGameweeks = internalAction({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args): Promise<SettleGameweeksResult> => {
    const plan: SettlementPlan = await ctx.runQuery(internal.fantasyScores.settlementPlan, {
      ...(args.now === undefined ? {} : { now: args.now }),
    });

    const finalized: FinalizeChunkResult[] = [];
    const alerted: UnscoredAlertResult[] = [];
    const stampedSquads: { gwNumber: number; squads: number }[] = [];

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

      // O2: the frozen crowd factors land FIRST, as new provisional versions,
      // so the finalizer below flips rows that already carry them ("the
      // factor applied is the frozen one" — CROWD_VOTING §Rating math). The
      // mutation refuses before the cut and on a settled gameweek, and
      // converges to zero writes, so re-entry is as safe as the rest.
      let crowdGuard = 0;
      while (crowdGuard < 100) {
        crowdGuard += 1;
        const crowd: ApplyCrowdFactorsResult = await ctx.runMutation(
          internal.fantasyCrowdVoting.applyCrowdFactorsForGameweek,
          {
            gameweekId: candidate.gameweekId,
            ...(args.now === undefined ? {} : { now: args.now }),
          },
        );
        if (crowd.written > 0) {
          console.log(
            `[FW-LAUNCH O2] crowd factors: ${crowd.written} version(s) written, ${crowd.insufficient} below threshold`,
          );
        }
        if (crowd.done) break;
      }

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
            `${last.unscoredAtFinality} unscored at the cut`,
        );

        // Stamp the settled weekend totals only once the score rows are all
        // final — a total stamped mid-flip would be a partial sum wearing a
        // settled label.
        if (last.done) {
          let stampGuard = 0;
          let totalStamped = 0;
          while (stampGuard < 400) {
            stampGuard += 1;
            const stamp: StampSquadTotalsResult = await ctx.runMutation(
              internal.fantasyScores.stampSquadFinalTotals,
              {
                gameweekId: candidate.gameweekId,
                ...(args.now === undefined ? {} : { now: args.now }),
              },
            );
            totalStamped += stamp.stamped;
            if (!stamp.eligible || stamp.done) break;
          }
          if (totalStamped > 0) {
            stampedSquads.push({ gwNumber: last.gwNumber, squads: totalStamped });
          }
          console.log(
            `[FW-4] settled ${last.season} GW${last.gwNumber}: ${totalStamped} squad total(s) stamped this run`,
          );

          // O2: once settled, score the raters against the frozen consensus
          // (the sealed second game). Idempotent — scored users are skipped.
          let raterGuard = 0;
          while (raterGuard < 50) {
            raterGuard += 1;
            const rater: RaterAccuracyResult = await ctx.runMutation(
              internal.fantasyCrowdVoting.scoreRaterAccuracy,
              {
                gameweekId: candidate.gameweekId,
                ...(args.now === undefined ? {} : { now: args.now }),
              },
            );
            if (rater.done) break;
          }

          // FW-RECEIPT: the percentile rollup — additive, writes only its own
          // table, and self-guarding on the settlement stamp (it refuses until
          // `fantasyGameweekScoring.state === "final"`, so a tick that reaches
          // here before the stamp simply retries next tick).
          let percentileGuard = 0;
          while (percentileGuard < 50) {
            percentileGuard += 1;
            const stamp = await ctx.runMutation(
              internal.fantasyReceipts.stampGameweekPercentiles,
              {
                gameweekId: candidate.gameweekId,
                ...(args.now === undefined ? {} : { now: args.now }),
              },
            );
            if (!stamp.eligible || stamp.done) break;
          }
        }
      }
    }

    return {
      now: plan.now,
      finalized,
      alerted,
      stampedSquads,
      candidates: plan.candidates.length,
    };
  },
});

// ───────────────────────────────────────────────── squad aggregation (R3/R7)
//
// P5: "player-fixture scores → squad gameweek totals, honoring FW-1
// lineup/finisher/lock semantics. Unscored players contribute nothing and are
// reported as awaiting, not as 0."
//
// The two sentences are one rule seen from both ends. A slot with no score adds
// NOTHING to the total (not zero — nothing), and the fact that it is waiting
// travels with the total so no surface can present an incomplete number as a
// finished one. `points: null` is how a slot says "no number yet"; `0` is only
// ever a number that was RESOLVED — the engine scored his line to 0, or his
// fixture was scored without a line for him at all, which is the one absence
// that is an answer rather than a wait: he did not appear (FW-4R N5).

/** Why a slot has no points. Never conflated with a score OF zero. */
export type SlotScoreState =
  /**
   * The slot has a NUMBER: a score row exists for this player, or his fixture
   * was scored without a line for him — he was not in the matchday squad, and
   * that is an honest 0 with `zeroReason` saying so (FW-4R N5).
   */
  | "scored"
  /**
   * The slot is filled and the player's fixture is not scored yet (R7).
   * Reserved for UNSCORED fixtures: once a fixture is scored, every fielded
   * player of it has a number, present in the feed or not (N5).
   */
  | "awaiting"
  /** No player in the slot. BUDGET_MODE: an unfilled slot scores zero, honestly. */
  | "empty";

export interface SlotScore {
  slotIndex: number;
  slotRole: Slot;
  isFinisher: boolean;
  playerId: Id<"fantasyPlayers"> | null;
  playerName: string | null;
  clubId: string | null;
  /** FW-1's live lock test, not the sweep's stamp. */
  locked: boolean;
  state: SlotScoreState;
  /** Present when state is "awaiting" — what the surface should say instead of 0. */
  awaitingReason: string | null;
  /**
   * Present on a scored slot whose 0 has no score row behind it: the fixture
   * was scored and this player had no line in it ("did not appear", N5). The
   * per-score fields below (baseScore, version, rowState…) stay null on such a
   * slot, and this is what says the 0 is a resolution, not a missing row.
   */
  zeroReason: string | null;
  /** null unless state is "scored". NEVER 0 as a stand-in for "no data". */
  points: number | null;
  baseScore: number | null;
  crowdFactor: number | null;
  verdictPosition: Slot | null;
  /** True when the ×0.75 dampener applied to this slot (R6). */
  mismatch: boolean;
  version: number | null;
  rowState: "provisional" | "final" | null;
  /**
   * O2: this gameweek's crowd vote count for the slot's player, fetched only
   * `withReasons` (single-squad views). Lets the surface render "insufficient
   * votes" — visible, not silent — when a settled factor is 0 for lack of
   * liquidity rather than by verdict (CROWD_VOTING §Rating math).
   */
  crowdVotes: number | null;
}

export interface SquadScore {
  squadId: Id<"fantasySquads">;
  userId: Id<"users">;
  context: "budget" | "crew";
  gameweekId: Id<"fantasyGameweeks">;
  season: string;
  gwNumber: number;
  /**
   * R3's state for this total, derived from the SETTLEMENT STAMP
   * (`fantasyGameweekScoring.state`), never from `now >= finalityAt` (FW-4R N2).
   *
   * The instant cannot carry a user-facing label, because FW-2 can MOVE it: a
   * postponed fixture re-windows the gameweek and `applyGameweeks` shifts
   * `finalityAt` later, and a label that read "final" off the old instant would
   * revert to "provisional" in front of the user. The stamp only ever moves
   * provisional → final, so a label derived from it cannot flicker. The cost is
   * honesty's direction: in the minutes between the cut and the settlement cron
   * the total still reads "provisional" — a late label, never a wrong one.
   */
  state: "provisional" | "final";
  finalityAt: number;
  finalizedAt: number | null;
  /** Sum of the SCORED slots only. Awaiting slots contribute nothing. */
  total: number;
  scoredSlots: number;
  awaitingSlots: number;
  emptySlots: number;
  /** True while any filled slot is still awaiting data: `total` is incomplete. */
  awaiting: boolean;
  slots: SlotScore[];
}

/**
 * Score one squad from the stored player-fixture rows.
 *
 * `withReasons` controls a per-slot fixture lookup used only to explain an
 * awaiting slot ("his match hasn't finished", "postponed", the pipeline's own
 * recorded reason). The crew table skips it — it aggregates dozens of squads and
 * only needs the counts — while a single squad view asks for it, because "awaiting"
 * with no reason is the kind of blank a user reads as a bug.
 */
export async function squadScore(
  ctx: QueryCtx,
  squad: Doc<"fantasySquads">,
  gameweek: Doc<"fantasyGameweeks">,
  now: number,
  withReasons: boolean,
): Promise<SquadScore> {
  const slots = await ctx.db
    .query("fantasySquadSlots")
    .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
    .collect();
  slots.sort((a, b) => a.slotIndex - b.slotIndex);

  const lockedByIndex = await lockStateForSlots(ctx, gameweek._id, slots, now);
  const gwScoring = await gameweekScoringRow(ctx, gameweek._id);

  const out: SlotScore[] = [];
  let total = 0;
  let scoredSlots = 0;
  let awaitingSlots = 0;
  let emptySlots = 0;

  for (const slot of slots) {
    const base: SlotScore = {
      slotIndex: slot.slotIndex,
      slotRole: slot.slotRole,
      isFinisher: slot.isFinisher,
      playerId: slot.playerId ?? null,
      playerName: null,
      clubId: null,
      locked: lockedByIndex.get(slot.slotIndex) === true,
      state: "empty",
      awaitingReason: null,
      zeroReason: null,
      points: null,
      baseScore: null,
      crowdFactor: null,
      verdictPosition: null,
      mismatch: false,
      version: null,
      rowState: null,
      crowdVotes: null,
    };

    if (slot.playerId === undefined) {
      emptySlots += 1;
      out.push(base);
      continue;
    }

    const player = await ctx.db.get(slot.playerId);
    if (player === null) {
      // FW-1 deactivates rather than deletes, so this is a broken invariant and
      // not an expected state. Reported as awaiting — never as a zero, which
      // would silently cost the user points he may be owed.
      awaitingSlots += 1;
      out.push({
        ...base,
        state: "awaiting",
        awaitingReason: "that player's record is unavailable",
      });
      continue;
    }

    const row = await currentScoreRow(ctx, gameweek._id, player.providerPlayerId);
    const role: SlotRole = slot.isFinisher ? "finisher" : "starter";

    if (row === null) {
      // No score row. Which of two very different facts is it? His fixture is
      // not scored (awaiting, R7) — or his fixture IS scored and the feed had
      // no line for him, meaning he was not in the matchday squad at all. The
      // second is not missing data: every line the fixture produced has been
      // scored, and a player outside the squad list scores what an unused
      // player scores — an honest 0 (N5). Without this, one left-out player
      // reads "awaiting data" forever and his squad never stops being
      // provisional, because no later ingest will ever produce his row.
      const fixture = await fixtureForClub(ctx, gameweek._id, player.clubId);
      const fixtureScoring = fixture === null ? null : await fixtureScoringRow(ctx, fixture._id);

      if (fixtureScoring?.state === "scored") {
        scoredSlots += 1; // contributes 0 to the total, and counts as resolved
        out.push({
          ...base,
          playerName: player.name,
          clubId: player.clubId,
          state: "scored",
          zeroReason: "did not appear",
          points: 0,
        });
        continue;
      }

      awaitingSlots += 1;
      out.push({
        ...base,
        playerName: player.name,
        clubId: player.clubId,
        state: "awaiting",
        awaitingReason: withReasons
          ? awaitingReasonFor(fixture, fixtureScoring)
          : "awaiting data",
      });
      continue;
    }

    // R5's derivation, through the engine's own expression: the stored base and
    // factor are kept apart and the total is computed, never stored.
    const points = totalFor(row.baseScores, slot.slotRole, role, row.crowdFactor);
    total = cleanTotal(total + points);
    scoredSlots += 1;

    // O2: vote liquidity, single-squad views only (same withReasons economy
    // as the awaiting reasons). Read inline rather than via fantasyCrowdVoting
    // to keep the module graph acyclic — that module imports this one.
    let crowdVotes: number | null = null;
    if (withReasons) {
      const rating = await ctx.db
        .query("fantasyCrowdRatings")
        .withIndex("by_gameweek_player", (q) =>
          q.eq("gameweekId", gameweek._id).eq("playerId", slot.playerId!),
        )
        .first();
      crowdVotes = rating?.voteCount ?? 0;
    }

    out.push({
      ...base,
      playerName: player.name,
      clubId: player.clubId,
      state: "scored",
      points,
      baseScore: row.baseScores[role][slot.slotRole],
      crowdFactor: row.crowdFactor,
      verdictPosition: row.verdictPosition,
      mismatch: isMismatch(row.verdictPosition, slot.slotRole),
      version: row.version,
      rowState: row.state,
      crowdVotes,
    });
  }

  return {
    squadId: squad._id,
    userId: squad.userId,
    context: squad.context,
    gameweekId: gameweek._id,
    season: gameweek.season,
    gwNumber: gameweek.gwNumber,
    state: gwScoring?.state === "final" ? "final" : "provisional",
    finalityAt: gameweek.finalityAt,
    finalizedAt: gwScoring?.finalizedAt ?? null,
    total,
    scoredSlots,
    awaitingSlots,
    emptySlots,
    awaiting: awaitingSlots > 0,
    slots: out,
  };
}

/**
 * Why this player has no score yet, in words a surface can show.
 *
 * Reads the fixture and the pipeline's own status row rather than guessing: "his
 * match hasn't finished" and "the feed has not supplied this fixture" are
 * different things to a user, and the second one is the pipeline's fault rather
 * than football's. Takes the already-fetched docs — the caller needed them
 * anyway, to tell awaiting from did-not-appear (N5).
 */
function awaitingReasonFor(
  fixture: Doc<"fantasyFixtures"> | null,
  scoring: Doc<"fantasyFixtureScoring"> | null,
): string {
  if (fixture === null) return "no fixture for his club in this gameweek";
  if (scoring?.notScoredReason !== undefined && scoring.notScoredReason !== null) {
    return scoring.notScoredReason;
  }
  if (fixture.status !== FT_CLASS_STATUS) return `his match is ${fixture.status}`;
  return "awaiting data for his match";
}

/** Sum without accumulating IEEE-754 noise across thirteen slots. */
function cleanTotal(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

/**
 * The caller's own squad score for a gameweek.
 *
 * Deliberately a NEW query rather than a widening of `fantasySquads.getSquad`:
 * that one is FW-1's contract and its consumers (the lock-engine suites) assert
 * its shape. Scores are also only interesting once a weekend is underway, so a
 * separate subscription is what a client actually wants.
 */
export const getSquadScore = query({
  args: {
    gameweekId: v.id("fantasyGameweeks"),
    context: v.union(v.literal("budget"), v.literal("crew")),
    crewRoomId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SquadScore | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const contextKey = args.context === "budget" ? "budget" : `crew:${args.crewRoomId}`;
    const squad = await ctx.db
      .query("fantasySquads")
      .withIndex("by_user_gameweek_contextKey", (q) =>
        q.eq("userId", userId).eq("gameweekId", args.gameweekId).eq("contextKey", contextKey),
      )
      .first();
    if (squad === null) return null;

    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) return null;

    return squadScore(ctx, squad, gameweek, Date.now(), true);
  },
});

// ─────────────────────────────────────────────── the global weekend board

export interface WeekendLeaderboardRow {
  /** Competition rank: equal totals share a place. */
  rank: number;
  name: string;
  total: number;
  scoredSlots: number;
  awaitingSlots: number;
  emptySlots: number;
  tied: boolean;
  isYou: boolean;
}

export interface WeekendLeaderboard {
  gameweekId: Id<"fantasyGameweeks">;
  season: string;
  gwNumber: number;
  state: "provisional" | "final";
  /** Every budget squad entered in this gameweek, including those awaiting all data. */
  participants: number;
  /** Squads with at least one resolved slot and therefore an honest total. */
  ranked: number;
  rows: WeekendLeaderboardRow[];
}

interface InternalWeekendLeaderboardRow extends WeekendLeaderboardRow {
  userId: Id<"users">;
}

interface BuiltWeekendLeaderboard {
  state: "provisional" | "final";
  participants: number;
  squadUserIds: Set<Id<"users">>;
  rows: InternalWeekendLeaderboardRow[];
}

function rankWeekendRows(rows: InternalWeekendLeaderboardRow[]): void {
  rows.sort(
    (a, b) =>
      b.total - a.total ||
      a.name.localeCompare(b.name) ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );

  let rank = 0;
  let previousTotal: number | undefined;
  rows.forEach((row, index) => {
    if (index === 0 || row.total !== previousTotal) rank = index + 1;
    row.rank = rank;
    row.tied = rows[index - 1]?.total === row.total || rows[index + 1]?.total === row.total;
    previousTotal = row.total;
  });
}

async function buildBudgetWeekendLeaderboard(
  ctx: QueryCtx,
  gameweek: Doc<"fantasyGameweeks">,
  callerId: Id<"users"> | null,
  now: number,
  names: Map<Id<"users">, string>,
): Promise<BuiltWeekendLeaderboard> {
  const squads = (
    await ctx.db
      .query("fantasySquads")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
      .collect()
  ).filter((squad) => squad.context === "budget");
  const scoring = await gameweekScoringRow(ctx, gameweek._id);
  const state: "provisional" | "final" = scoring?.state === "final" ? "final" : "provisional";
  const anyScored = (scoring?.fixturesScored ?? 0) > 0 || state === "final";
  const rows: InternalWeekendLeaderboardRow[] = [];

  for (const squad of squads) {
    // Before the first fixture score lands, no squad has an honest number.
    // Avoid thirteen slot reads per entrant merely to rediscover that fact.
    if (squad.finalScore === undefined && !anyScored) continue;
    const score =
      squad.finalScore !== undefined
        ? squad.finalScore
        : await squadScore(ctx, squad, gameweek, now, false);
    if (score.scoredSlots === 0) continue;

    let name = names.get(squad.userId);
    if (name === undefined) {
      const user = await ctx.db.get(squad.userId);
      name = user?.username ?? user?.displayName ?? "Weekend player";
      names.set(squad.userId, name);
    }
    rows.push({
      rank: 0,
      name,
      total: score.total,
      scoredSlots: score.scoredSlots,
      awaitingSlots: score.awaitingSlots,
      emptySlots: score.emptySlots,
      tied: false,
      isYou: callerId === squad.userId,
      userId: squad.userId,
    });
  }

  rankWeekendRows(rows);
  return {
    state,
    participants: squads.length,
    squadUserIds: new Set(squads.map((squad) => squad.userId)),
    rows,
  };
}

/**
 * The general THE WEEKEND leaderboard: budget squads only, never crew sheets.
 *
 * It deliberately derives live totals through `squadScore`, the same function
 * used by the squad card and receipt. Convex subscriptions then invalidate this
 * query whenever a score version lands, so provisional standings move with the
 * scoring pipeline without a second cache or write path. A squad with no
 * resolved player is absent rather than presented as an invented zero.
 */
export const getWeekendLeaderboard = query({
  args: { gameweekId: v.id("fantasyGameweeks") },
  handler: async (ctx, args): Promise<WeekendLeaderboard | null> => {
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) return null;

    const callerId = await getAuthUserId(ctx);
    const built = await buildBudgetWeekendLeaderboard(
      ctx,
      gameweek,
      callerId,
      Date.now(),
      new Map(),
    );
    return {
      gameweekId: gameweek._id,
      season: gameweek.season,
      gwNumber: gameweek.gwNumber,
      state: built.state,
      participants: built.participants,
      ranked: built.rows.length,
      rows: built.rows.map(({ userId: _userId, ...row }) => row),
    };
  },
});

export interface WeekendSeasonLeaderboardRow {
  rank: number;
  name: string;
  total: number;
  playedWeekends: number;
  provisional: boolean;
  tied: boolean;
  isYou: boolean;
}

export interface WeekendSeasonHistoryRow {
  gwNumber: number;
  total: number;
  rank: number;
  population: number;
  percentile: number;
}

export interface WeekendPodiumWeek {
  gwNumber: number;
  podium: Array<{ rank: number; name: string; total: number }>;
  mostImproved: { name: string; places: number } | null;
}

export interface WeekendSeasonLeaderboard {
  season: string;
  state: "provisional" | "final";
  participants: number;
  ranked: number;
  rows: WeekendSeasonLeaderboardRow[];
  weeks: WeekendPodiumWeek[];
  me: {
    rank: number;
    total: number;
    playedWeekends: number;
    bestRank: number;
    topHalfStreak: number;
    topTenPercentFinishes: number;
    changeFromPrevious: number | null;
    history: WeekendSeasonHistoryRow[];
  } | null;
}

/**
 * Season-long budget standings and the small history/reward layer around them.
 * Settled weekends read immutable `finalScore` stamps; only the in-flight
 * weekend derives live totals. Nothing here writes a second score or reward
 * ledger, so the weekly board and season board cannot disagree.
 */
export const getWeekendSeasonLeaderboard = query({
  args: { season: v.string() },
  handler: async (ctx, args): Promise<WeekendSeasonLeaderboard> => {
    const callerId = await getAuthUserId(ctx);
    const gameweeks = (
      await ctx.db
      .query("fantasyGameweeks")
      .withIndex("by_season_gwNumber", (q) => q.eq("season", args.season))
      .collect()
    ).filter((gameweek) => gameweek.gwNumber > 0);
    gameweeks.sort((a, b) => a.gwNumber - b.gwNumber);

    const names = new Map<Id<"users">, string>();
    const now = Date.now();
    const builtWeeks: Array<{
      gameweek: Doc<"fantasyGameweeks">;
      board: BuiltWeekendLeaderboard;
    }> = [];
    const participantIds = new Set<Id<"users">>();
    for (const gameweek of gameweeks) {
      const board = await buildBudgetWeekendLeaderboard(ctx, gameweek, callerId, now, names);
      board.squadUserIds.forEach((userId) => participantIds.add(userId));
      builtWeeks.push({ gameweek, board });
    }

    const aggregates = new Map<
      Id<"users">,
      {
        userId: Id<"users">;
        name: string;
        total: number;
        playedWeekends: number;
        provisional: boolean;
        isYou: boolean;
      }
    >();
    for (const { board } of builtWeeks) {
      for (const row of board.rows) {
        const current = aggregates.get(row.userId) ?? {
          userId: row.userId,
          name: row.name,
          total: 0,
          playedWeekends: 0,
          provisional: false,
          isYou: row.isYou,
        };
        current.total = cleanTotal(current.total + row.total);
        current.playedWeekends += 1;
        current.provisional ||= board.state === "provisional";
        aggregates.set(row.userId, current);
      }
    }

    const seasonRows = [...aggregates.values()].sort(
      (a, b) =>
        b.total - a.total ||
        a.name.localeCompare(b.name) ||
        (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
    );
    let seasonRank = 0;
    let previousTotal: number | undefined;
    const publicRows: WeekendSeasonLeaderboardRow[] = seasonRows.map((row, index) => {
      if (index === 0 || row.total !== previousTotal) seasonRank = index + 1;
      previousTotal = row.total;
      return {
        rank: seasonRank,
        name: row.name,
        total: row.total,
        playedWeekends: row.playedWeekends,
        provisional: row.provisional,
        tied:
          seasonRows[index - 1]?.total === row.total || seasonRows[index + 1]?.total === row.total,
        isYou: row.isYou,
      };
    });

    const settledWeeks = builtWeeks.filter(({ board }) => board.state === "final");
    const weeksAscending: WeekendPodiumWeek[] = settledWeeks.map(({ gameweek, board }, index) => {
      const previous = settledWeeks[index - 1]?.board;
      let mostImproved: WeekendPodiumWeek["mostImproved"] = null;
      if (previous !== undefined) {
        const previousRanks = new Map(previous.rows.map((row) => [row.userId, row.rank]));
        for (const row of board.rows) {
          const previousRank = previousRanks.get(row.userId);
          if (previousRank === undefined) continue;
          const places = previousRank - row.rank;
          if (
            places > 0 &&
            (mostImproved === null ||
              places > mostImproved.places ||
              (places === mostImproved.places && row.name < mostImproved.name))
          ) {
            mostImproved = { name: row.name, places };
          }
        }
      }
      return {
        gwNumber: gameweek.gwNumber,
        podium: board.rows
          .filter((row) => row.rank <= 3)
          .map((row) => ({ rank: row.rank, name: row.name, total: row.total })),
        mostImproved,
      };
    });

    const meSeason = publicRows.find((row) => row.isYou) ?? null;
    const history = settledWeeks
      .map(({ gameweek, board }): WeekendSeasonHistoryRow | null => {
        const row = board.rows.find((entry) => entry.isYou);
        if (row === undefined || board.rows.length === 0) return null;
        return {
          gwNumber: gameweek.gwNumber,
          total: row.total,
          rank: row.rank,
          population: board.rows.length,
          percentile: Math.ceil((row.rank / board.rows.length) * 100),
        };
      })
      .filter((row): row is WeekendSeasonHistoryRow => row !== null)
      .reverse();

    let topHalfStreak = 0;
    for (const { board } of [...settledWeeks].reverse()) {
      const row = board.rows.find((entry) => entry.isYou);
      if (row === undefined || board.rows.length === 0) break;
      if (Math.ceil((row.rank / board.rows.length) * 100) > 50) break;
      topHalfStreak += 1;
    }

    const me =
      meSeason === null
        ? null
        : {
            rank: meSeason.rank,
            total: meSeason.total,
            playedWeekends: meSeason.playedWeekends,
            bestRank:
              history.length === 0
                ? meSeason.rank
                : Math.min(...history.map((row) => row.rank)),
            topHalfStreak,
            topTenPercentFinishes: history.filter((row) => row.percentile <= 10).length,
            changeFromPrevious:
              history.length < 2 ? null : history[1].rank - history[0].rank,
            history,
          };

    return {
      season: args.season,
      state: seasonRows.some((row) => row.provisional) ? "provisional" : "final",
      participants: participantIds.size,
      ranked: publicRows.length,
      rows: publicRows,
      weeks: weeksAscending.reverse(),
      me,
    };
  },
});

// ─────────────────────────────────────────────────────── the crew table (P6)
//
// FW-3 shipped the crew page with the standings column reading "points: awaits
// scoring pipeline". This is the pipeline. The column now carries real numbers,
// and where a weekend has no numbers yet it says so rather than showing a zero.
//
// TIE-BREAKS ARE NOT IMPLEMENTED HERE, deliberately. DRAFT_ROOM_SPEC v1.2.0
// ledger item 5 rules the ladders (crew table: head-to-head weekend wins, then
// cumulative points) and its §Explicitly deferred section schedules them as
// later work; this ticket orders by cumulative points and DISPLAYS a tie as a
// tie. `tieBreaksApplied: false` travels in the payload so no client can
// mistake the ordering for a settled ladder.

export interface CrewWeekendScore {
  roomId: Id<"fantasyDraftRooms">;
  gameweekId: Id<"fantasyGameweeks">;
  gwNumber: number;
  season: string;
  /** null when this member's weekend has no scored slot at all — never 0. */
  points: number | null;
  state: "provisional" | "final";
  scoredSlots: number;
  awaitingSlots: number;
  /** True when the total came from the stamped settled figure. */
  settled: boolean;
}

export interface CrewTableRow {
  userId: Id<"users">;
  name: string;
  /** Sum over the weekends that have scores. null when none have (R7). */
  cumulativePoints: number | null;
  scoredWeekends: number;
  awaitingWeekends: number;
  /** True while any counted weekend is still provisional or incomplete. */
  provisional: boolean;
  /** Shared rank on a tie; 1-based. */
  rank: number;
  tied: boolean;
  weekends: CrewWeekendScore[];
}

export interface CrewTable {
  crewId: Id<"fantasyCrews">;
  code: string;
  name: string;
  rows: CrewTableRow[];
  weekends: {
    roomId: Id<"fantasyDraftRooms">;
    gameweekId: Id<"fantasyGameweeks">;
    gwNumber: number;
    season: string;
    state: "provisional" | "final";
    /** False while the gameweek has no scored fixture at all. */
    anyScored: boolean;
  }[];
  /** DRAFT_ROOM_SPEC v1.2.1 ledger item 5 — the ladders are BUILT (FW-LAUNCH
   *  O4): equal cumulative points break by head-to-head weekend wins, each
   *  weekend decided by points → highest single-player score → fewest
   *  auto-picks; an exhausted ladder stays a displayed tie. */
  tieBreaksApplied: true;
}

/**
 * The crew table: cumulative points per member, and each weekend's result.
 *
 * Only COMPLETED rooms count — a room still drafting has no sheets to score. A
 * settled weekend is read from the squad's stamped `finalScore`; the weekend in
 * flight is derived live from the score rows, which is the only one that can
 * still move.
 */
export const getCrewTable = query({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<CrewTable | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return crewTableFor(ctx, args.code, userId);
  },
});

/** The crew-table core, sans authentication — the seam the O5 integration
 *  sim reads through (fantasySquads' `…For` precedent). */
export async function crewTableFor(
  ctx: QueryCtx,
  code: string,
  userId: Id<"users">,
): Promise<CrewTable | null> {
  {
    const args = { code };
    const crew = await ctx.db
      .query("fantasyCrews")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim().toUpperCase()))
      .first();
    if (crew === null) return null;

    // Crew-internal, like every other crew read (DRAFT_ROOM §Room parameters):
    // the table is visible to members and to nobody else.
    const membership = await ctx.db
      .query("fantasyCrewMembers")
      .withIndex("by_crew_user", (q) => q.eq("crewId", crew._id).eq("userId", userId))
      .first();
    if (membership === null || !membership.active) return null;

    const members = (
      await ctx.db
        .query("fantasyCrewMembers")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .collect()
    ).filter((m) => m.active);

    const rooms = (
      await ctx.db
        .query("fantasyDraftRooms")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .collect()
    ).filter((room) => room.status === "completed");

    const now = Date.now();
    const weekends: CrewTable["weekends"] = [];
    const byMember = new Map<string, CrewWeekendScore[]>();
    for (const member of members) byMember.set(member.userId, []);

    for (const room of rooms) {
      const gameweek = await ctx.db.get(room.gameweekId);
      if (gameweek === null) continue;

      const gwScoring = await gameweekScoringRow(ctx, gameweek._id);
      const anyScored = (gwScoring?.fixturesScored ?? 0) > 0;
      // From the settlement stamp, like every user-facing "final" (N2): a label
      // derived from the movable instant could revert when FW-2 re-windows.
      const state: "provisional" | "final" =
        gwScoring?.state === "final" ? "final" : "provisional";

      weekends.push({
        roomId: room._id,
        gameweekId: gameweek._id,
        gwNumber: gameweek.gwNumber,
        season: gameweek.season,
        state,
        anyScored,
      });

      for (const member of members) {
        const squad = await ctx.db
          .query("fantasySquads")
          .withIndex("by_user_gameweek_contextKey", (q) =>
            q
              .eq("userId", member.userId)
              .eq("gameweekId", gameweek._id)
              .eq("contextKey", `crew:${room._id}`),
          )
          .first();
        if (squad === null) continue; // not seated in that draft

        const entry: CrewWeekendScore = {
          roomId: room._id,
          gameweekId: gameweek._id,
          gwNumber: gameweek.gwNumber,
          season: gameweek.season,
          points: null,
          state,
          scoredSlots: 0,
          awaitingSlots: 0,
          settled: false,
        };

        if (squad.finalScore !== undefined) {
          // Settled: read the stamped figure rather than 13 lookups.
          entry.points = squad.finalScore.scoredSlots > 0 ? squad.finalScore.total : null;
          entry.scoredSlots = squad.finalScore.scoredSlots;
          entry.awaitingSlots = squad.finalScore.awaitingSlots;
          entry.settled = true;
        } else if (anyScored) {
          // The weekend in flight — the only one whose numbers can still change.
          const score = await squadScore(ctx, squad, gameweek, now, false);
          entry.points = score.scoredSlots > 0 ? score.total : null;
          entry.scoredSlots = score.scoredSlots;
          entry.awaitingSlots = score.awaitingSlots;
        }
        // else: nothing in this gameweek is scored yet, so the weekend reads as
        // awaiting for everyone and costs no per-slot reads at all.

        byMember.get(member.userId)?.push(entry);
      }
    }

    weekends.sort((a, b) => a.gwNumber - b.gwNumber);

    const rows: CrewTableRow[] = members.map((member) => {
      const entries = (byMember.get(member.userId) ?? []).sort((a, b) => a.gwNumber - b.gwNumber);
      const scored = entries.filter((e) => e.points !== null);
      const cumulativePoints =
        scored.length === 0
          ? null
          : cleanTotal(scored.reduce((sum, e) => sum + (e.points ?? 0), 0));
      return {
        userId: member.userId,
        name: member.nameSnapshot,
        cumulativePoints,
        scoredWeekends: scored.length,
        awaitingWeekends: entries.length - scored.length,
        provisional:
          entries.some((e) => e.state === "provisional") || entries.some((e) => e.awaitingSlots > 0),
        rank: 0,
        tied: false,
        weekends: entries,
      };
    });

    // Order by cumulative points, highest first. A member with nothing scored has
    // no number at all and sorts last — not as a zero, which would rank him
    // alongside somebody who genuinely scored nothing.
    rows.sort((a, b) => {
      if (a.cumulativePoints === null && b.cumulativePoints === null) {
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      }
      if (a.cumulativePoints === null) return 1;
      if (b.cumulativePoints === null) return -1;
      return b.cumulativePoints - a.cumulativePoints;
    });

    // Shared rank on equal points, then the LADDER (O4, ledger item 5):
    // equal cumulative points break by head-to-head weekend wins, each
    // weekend decided by points → top single-player score → fewest
    // auto-picks. An exhausted ladder is still displayed as a tie.
    let rank = 0;
    let previous: number | null | undefined;
    rows.forEach((row, index) => {
      if (index === 0 || row.cumulativePoints !== previous) {
        rank = index + 1;
        previous = row.cumulativePoints;
      }
      row.rank = rank;
      row.tied = false;
    });

    // Ladder inputs are fetched lazily, for tied clusters only — the top
    // single-player score needs per-slot reads and the auto-pick counts need
    // the draft log, neither of which the untied table should pay for.
    const autoPicksByRoom = new Map<string, Map<string, number>>();
    const autoPicksFor = async (
      room: Doc<"fantasyDraftRooms">,
      memberId: Id<"users">,
    ): Promise<number | null> => {
      let byUser = autoPicksByRoom.get(room._id);
      if (byUser === undefined) {
        byUser = new Map<string, number>();
        const entries = await ctx.db
          .query("fantasyDraftLog")
          .withIndex("by_room_seq", (q) => q.eq("roomId", room._id))
          .collect();
        for (const seat of room.seats) byUser.set(seat.userId, 0);
        for (const entry of entries) {
          if (entry.entryType !== "pick" || entry.auto !== true) continue;
          const seat = room.seats[entry.seatIndex];
          if (seat === undefined) continue;
          byUser.set(seat.userId, (byUser.get(seat.userId) ?? 0) + 1);
        }
        autoPicksByRoom.set(room._id, byUser);
      }
      return byUser.get(memberId) ?? null;
    };

    const topPlayerScoreFor = async (
      room: Doc<"fantasyDraftRooms">,
      memberId: Id<"users">,
    ): Promise<number | null> => {
      const gameweek = await ctx.db.get(room.gameweekId);
      if (gameweek === null) return null;
      const squad = await ctx.db
        .query("fantasySquads")
        .withIndex("by_user_gameweek_contextKey", (q) =>
          q
            .eq("userId", memberId)
            .eq("gameweekId", gameweek._id)
            .eq("contextKey", `crew:${room._id}`),
        )
        .first();
      if (squad === null) return null;
      const score = await squadScore(ctx, squad, gameweek, now, false);
      let top: number | null = null;
      for (const slot of score.slots) {
        if (slot.state !== "scored" || slot.points === null) continue;
        if (top === null || slot.points > top) top = slot.points;
      }
      return top;
    };

    const roomById = new Map(rooms.map((room) => [room._id as string, room]));
    let index = 0;
    while (index < rows.length) {
      const cluster = rows.filter((row) => row.rank === rows[index].rank);
      if (cluster.length >= 2 && rows[index].cumulativePoints === null) {
        // An all-null cluster IS the exhausted ladder: nobody has a scored
        // weekend, so every head-to-head rung abstains and no fact separates
        // the members — the shared rank is a DISPLAYED tie, and the ladder's
        // lazy inputs stay unfetched because they could decide nothing.
        for (const row of cluster) row.tied = true;
        index += cluster.length;
        continue;
      }
      if (cluster.length < 2) {
        index += cluster.length;
        continue;
      }

      const groupMembers: TiedGroupMember<Id<"users">>[] = [];
      for (const row of cluster) {
        const comparable = new Map<string, WeekendComparable>();
        for (const entry of row.weekends) {
          const room = roomById.get(entry.roomId);
          if (room === undefined) continue;
          comparable.set(entry.roomId, {
            points: entry.points,
            topPlayerScore: await topPlayerScoreFor(room, row.userId),
            autoPicks: await autoPicksFor(room, row.userId),
          });
        }
        groupMembers.push({ key: row.userId, weekends: comparable });
      }

      const ordered = orderTiedGroup(groupMembers);
      const baseRank = rows[index].rank;
      const rowByUser = new Map(cluster.map((row) => [row.userId as string, row]));
      ordered.forEach((result) => {
        const row = rowByUser.get(result.key);
        if (row === undefined) return;
        row.rank = baseRank + result.subRank;
        row.tied = result.stillTied;
      });
      // Reorder the cluster's slice to match the ladder.
      const slice = ordered
        .map((result) => rowByUser.get(result.key))
        .filter((row): row is CrewTableRow => row !== undefined);
      rows.splice(index, slice.length, ...slice);
      index += cluster.length;
    }

    return {
      crewId: crew._id,
      code: crew.code,
      name: crew.name,
      rows,
      weekends,
      tieBreaksApplied: true,
    };
  }
}

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
    const lastLooks = plan.fixtures.filter((f) => f.readKind === "lastLook").length;
    if (lastLooks > 0) {
      console.log(
        `[FW-4 call plan]   ${lastLooks} of these are the finality−8h last-look sweep (FW-4R N1), ` +
          `${lastLooks * CALLS_PER_FIXTURE} request(s)`,
      );
    }
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
