/**
 * Weekend Fantasy — feed ingestion (FW-2).
 *
 * Turns the API-Football feed into the FW-1 data layer: fixtures grouped into
 * gameweek windows, and a player universe for the five leagues.
 *
 * ── Shape ──
 *
 *   bootstrapSeason   one-shot. 5 requests. Fixtures for all five leagues →
 *                     windows → gameweeks → fixture rows.
 *   bootstrapPlayers  one-shot. 5 + 96 requests. Every club's squad, prices null.
 *   syncFixtures      cron. 5 requests. A rolling date window, so kickoff
 *                     changes, postponements and results land without
 *                     re-reading a whole season every quarter hour.
 *
 * Actions fetch; mutations write. No mutation in this file touches the network,
 * which is what keeps every write transactional and replayable.
 *
 * ── Idempotence ──
 *
 * Every write is an upsert keyed on a provider id, and re-running any of the
 * three is a no-op beyond field refreshes. This matters more than it usually
 * does: a cron that half-fails and retries must not double-create a gameweek
 * and orphan a squad that already points at the first one.
 *
 * ── The one thing this file will not do ──
 *
 * It never invents football data. A provider status it does not recognise is
 * reported in the action's return value with the fixture id and the raw code,
 * and the row's existing status is left alone — it is not guessed at, and not
 * silently defaulted to "scheduled". See `mapStatus`.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  ApiFootballClient,
  credentialsFromEnv,
  fetchLeagueFixtures,
  fetchLeagueTeams,
  fetchSquad,
  type FeedFixture,
} from "./fantasyApiFootball";
import { isOnPriceScale, LEAGUE_IDS, PRICE_MAX, PRICE_MIN } from "./lib/fantasyConstants";
import { constituteGameweeks, seasonLabel, windowFor } from "./lib/fantasyGameweekWindows";

/**
 * The season ingestion targets, as API-Football names it (opening calendar
 * year). Proven served on the Pro key 2026-07-29: league 39 season 2026
 * returned 380 fixtures across 38 rounds.
 */
export const CURRENT_API_SEASON = 2026;

/** How far either side of now `syncFixtures` re-reads. */
const SYNC_LOOKBACK_DAYS = 3;
const SYNC_LOOKAHEAD_DAYS = 10;

const MS_PER_DAY = 86_400_000;

type FixtureStatus = Doc<"fantasyFixtures">["status"];

/**
 * ── Why every action below carries an explicit return type ──
 *
 * An action that spreads a `ctx.runMutation` result into its own return value
 * creates a type CYCLE when the mutation lives in the same module: the action's
 * inferred return type needs the mutation's type, which comes from
 * `_generated/api`, which is generated from this module, which needs the
 * action's type. TypeScript does not error on the cycle — it silently gives up
 * and widens, and the damage lands somewhere else entirely. Adding these three
 * actions without annotations degraded `ctx.runQuery` inference in
 * `opsActiveUsers.ts` and `ShellProfileScreen.tsx`, two files that have nothing
 * to do with fantasy, into `unknown`.
 *
 * Annotating the handlers breaks the cycle at the source. Do not remove these.
 */
export interface ApplyGameweeksResult {
  created: number;
  updated: number;
  total: number;
}

export interface ApplyFixturesResult {
  created: number;
  updated: number;
  unchanged: number;
  unmapped: { providerFixtureId: string; rawStatus: string }[];
}

export interface ApplyPlayersResult {
  created: number;
  updated: number;
  deactivated: number;
}

export interface IngestTotals extends ApplyFixturesResult {
  gameweeksCreated: number;
  gameweeksUpdated: number;
  gameweeksTotal: number;
  chunks: number;
}

export interface BootstrapSeasonResult extends IngestTotals {
  season: string;
  apiSeason: number;
  fixturesFetched: number;
  perLeague: Record<number, number>;
  dailyRemaining: number | null;
}

export interface SyncFixturesResult extends Partial<IngestTotals> {
  season: string;
  from: string;
  to: string;
  fixturesFetched: number;
  dailyRemaining: number | null;
}

export interface BootstrapPlayersResult {
  apiSeason: number;
  clubs: number;
  created: number;
  updated: number;
  deactivated: number;
  skippedNoPosition: number;
  perLeague: Record<number, { clubs: number; players: number }>;
  dailyRemaining: number | null;
}

/**
 * Provider status short-code → our lifecycle status.
 *
 * Exhaustive over the codes API-Football v3 documents. `null` means "we do not
 * recognise this", which is a reportable event and never a silent default —
 * mapping an unknown code onto "scheduled" would re-open a locked squad, and
 * mapping it onto "finished" would tell a scoring pass to settle a match that
 * may still be in progress.
 *
 * AWD (technical win) and WO (walkover) map to "finished" because that is a
 * statement about the fixture's LIFECYCLE — it is over and a result stands —
 * and carries no claim about player statistics, which such fixtures largely
 * lack. What a scoring pass does with an empty stat line is its decision, not
 * ingestion's.
 */
function mapStatus(short: string): FixtureStatus | null {
  switch (short) {
    case "TBD":
    case "NS":
      return "scheduled";
    case "1H":
    case "HT":
    case "2H":
    case "ET":
    case "BT":
    case "P":
    case "SUSP":
    case "INT":
    case "LIVE":
      return "live";
    case "FT":
    case "AET":
    case "PEN":
    case "AWD":
    case "WO":
      return "finished";
    case "PST":
      return "postponed";
    case "CANC":
      return "cancelled";
    case "ABD":
      return "abandoned";
    default:
      return null;
  }
}

/** `YYYY-MM-DD` in UTC — the form the feed's from/to parameters take. */
function isoDay(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- write layer

interface FixtureUpsert {
  providerFixtureId: string;
  leagueId: number;
  kickoffAt: number;
  /** Resolved from the FULL season's kickoff set by the caller — see applyFixtureChunk. */
  gwNumber: number;
  status: FixtureStatus | null;
  rawStatus: string;
  homeClubId: string;
  awayClubId: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

const fixtureUpsertValidator = v.object({
  providerFixtureId: v.string(),
  leagueId: v.number(),
  kickoffAt: v.number(),
  gwNumber: v.number(),
  status: v.union(
    v.literal("scheduled"),
    v.literal("live"),
    v.literal("finished"),
    v.literal("postponed"),
    v.literal("cancelled"),
    v.literal("abandoned"),
    v.null(),
  ),
  rawStatus: v.string(),
  homeClubId: v.string(),
  awayClubId: v.string(),
  homeGoals: v.union(v.number(), v.null()),
  awayGoals: v.union(v.number(), v.null()),
});

/**
 * Upsert the season's gameweeks. Small by construction — a season is ~40-60
 * windows — so this stays comfortably inside one transaction.
 *
 * Split from the fixture writes because the two have very different sizes and
 * one hard ordering constraint between them: ordinals must be computed from
 * the WHOLE observed kickoff set (otherwise a chunk that happened to contain
 * only October fixtures would number them 1, 2, 3), while the fixtures
 * themselves number in the thousands and cannot be written in one go. So the
 * action constitutes the windows purely, writes them here first, and then
 * streams fixtures in chunks that reference the gameweek by its ordinal.
 */
export const applyGameweeks = internalMutation({
  args: {
    season: v.string(),
    windows: v.array(
      v.object({
        gwNumber: v.number(),
        leagueIds: v.array(v.number()),
        finalityAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, { season, windows }): Promise<ApplyGameweeksResult> => {
    const existing = await ctx.db
      .query("fantasyGameweeks")
      .withIndex("by_season_gwNumber", (q) => q.eq("season", season))
      .collect();
    const byNumber = new Map(existing.map((gw) => [gw.gwNumber, gw]));

    let created = 0;
    let updated = 0;

    for (const window of windows) {
      const current = byNumber.get(window.gwNumber);
      if (current === undefined) {
        await ctx.db.insert("fantasyGameweeks", {
          season,
          gwNumber: window.gwNumber,
          leagueIds: window.leagueIds,
          status: "upcoming",
          finalityAt: window.finalityAt,
        });
        created += 1;
        continue;
      }

      // `status` is deliberately NOT written here. It is a lifecycle field
      // driven by the passage of time and (later) by settlement; an ingestion
      // pass that reset a "settling" gameweek to "upcoming" every quarter hour
      // would be a live bug wearing a refresh's clothes.
      const sameLeagues =
        current.leagueIds.length === window.leagueIds.length &&
        current.leagueIds.every((id, i) => id === window.leagueIds[i]);
      if (current.finalityAt !== window.finalityAt || !sameLeagues) {
        await ctx.db.patch(current._id, {
          finalityAt: window.finalityAt,
          leagueIds: window.leagueIds,
        });
        updated += 1;
      }
    }

    return { created, updated, total: windows.length };
  },
});

/**
 * Upsert one CHUNK of fixtures.
 *
 * Each fixture carries the `gwNumber` its kickoff resolves to, computed purely
 * by the caller from the full season. Re-resolving it here would be both
 * redundant and wrong: a chunk does not know the whole set, and the ordinal is
 * a property of the season, not of the chunk.
 *
 * A fixture MOVED to a different week is re-parented, because `gwNumber` comes
 * from the current kickoff rather than from what the row was first filed under.
 */
export const applyFixtureChunk = internalMutation({
  args: {
    season: v.string(),
    fixtures: v.array(fixtureUpsertValidator),
  },
  handler: async (ctx, { season, fixtures }): Promise<ApplyFixturesResult> => {
    const gameweekIdByNumber = new Map<number, Id<"fantasyGameweeks">>();
    const resolveGameweek = async (
      gwNumber: number,
    ): Promise<Id<"fantasyGameweeks"> | null> => {
      const cached = gameweekIdByNumber.get(gwNumber);
      if (cached !== undefined) return cached;
      const gw = await ctx.db
        .query("fantasyGameweeks")
        .withIndex("by_season_gwNumber", (q) =>
          q.eq("season", season).eq("gwNumber", gwNumber),
        )
        .first();
      if (gw === null) return null;
      gameweekIdByNumber.set(gwNumber, gw._id);
      return gw._id;
    };

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const unmapped: { providerFixtureId: string; rawStatus: string }[] = [];

    for (const fixture of fixtures) {
      const gameweekId = await resolveGameweek(fixture.gwNumber);
      if (gameweekId === null) continue; // gameweek pass has not run for this window

      const existing = await ctx.db
        .query("fantasyFixtures")
        .withIndex("by_providerFixtureId", (q) =>
          q.eq("providerFixtureId", fixture.providerFixtureId),
        )
        .first();

      if (fixture.status === null) {
        unmapped.push({
          providerFixtureId: fixture.providerFixtureId,
          rawStatus: fixture.rawStatus,
        });
      }

      const goals =
        fixture.homeGoals === null || fixture.awayGoals === null
          ? {}
          : { homeGoals: fixture.homeGoals, awayGoals: fixture.awayGoals };

      if (existing === null) {
        // A first sighting we cannot classify is skipped rather than stored
        // under a guessed status. It is reported, and the next sync picks it up
        // once the provider settles on a code we know.
        if (fixture.status === null) continue;
        await ctx.db.insert("fantasyFixtures", {
          gameweekId,
          leagueId: fixture.leagueId,
          providerFixtureId: fixture.providerFixtureId,
          kickoffAt: fixture.kickoffAt,
          status: fixture.status,
          homeClubId: fixture.homeClubId,
          awayClubId: fixture.awayClubId,
          ...goals,
        });
        created += 1;
        continue;
      }

      const next = {
        gameweekId,
        leagueId: fixture.leagueId,
        kickoffAt: fixture.kickoffAt,
        // Unknown code: keep what we had. Never guess.
        status: fixture.status ?? existing.status,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        ...goals,
      };

      const changed =
        existing.gameweekId !== next.gameweekId ||
        existing.kickoffAt !== next.kickoffAt ||
        existing.status !== next.status ||
        existing.homeClubId !== next.homeClubId ||
        existing.awayClubId !== next.awayClubId ||
        existing.homeGoals !== next.homeGoals ||
        existing.awayGoals !== next.awayGoals;

      if (changed) {
        await ctx.db.patch(existing._id, next);
        updated += 1;
      } else {
        unchanged += 1;
      }
    }

    return { created, updated, unchanged, unmapped };
  },
});

const playerUpsertValidator = v.object({
  providerPlayerId: v.string(),
  name: v.string(),
  clubId: v.string(),
  leagueId: v.number(),
  feedPosition: v.union(v.literal("GK"), v.literal("DEF"), v.literal("MID"), v.literal("ATT")),
});

/**
 * Upsert one club's players.
 *
 * `price` is written as null on CREATE and never touched on update: pricing is
 * BUDGET_MODE open item 1 and belongs to the pricing pass. Once that pass has
 * set a price, an ingestion refresh must not wipe it, which is why the update
 * branch below lists its fields explicitly instead of spreading the whole row.
 *
 * A player who has left the club is marked `active: false` rather than
 * deleted — squads from past gameweeks still reference him, and a dangling
 * `playerId` would break the lock engine's slot resolution.
 */
export const applyClubPlayers = internalMutation({
  args: {
    clubId: v.string(),
    leagueId: v.number(),
    players: v.array(playerUpsertValidator),
  },
  handler: async (ctx, { clubId, leagueId, players }): Promise<ApplyPlayersResult> => {
    const existing = await ctx.db
      .query("fantasyPlayers")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();
    const byProviderId = new Map(existing.map((p) => [p.providerPlayerId, p]));

    let created = 0;
    let updated = 0;
    const seen = new Set<string>();

    for (const player of players) {
      seen.add(player.providerPlayerId);
      const current = byProviderId.get(player.providerPlayerId);

      if (current === undefined) {
        // A player can move clubs; the provider id is global, so look him up
        // outside this club before creating a duplicate.
        const elsewhere = await ctx.db
          .query("fantasyPlayers")
          .withIndex("by_providerPlayerId", (q) =>
            q.eq("providerPlayerId", player.providerPlayerId),
          )
          .first();

        if (elsewhere !== null) {
          await ctx.db.patch(elsewhere._id, {
            name: player.name,
            clubId: player.clubId,
            leagueId: player.leagueId,
            feedPosition: player.feedPosition,
            active: true,
          });
          updated += 1;
          continue;
        }

        await ctx.db.insert("fantasyPlayers", {
          providerPlayerId: player.providerPlayerId,
          name: player.name,
          clubId: player.clubId,
          leagueId: player.leagueId,
          feedPosition: player.feedPosition,
          price: null, // pricing pass owns this — see the header
          active: true,
        });
        created += 1;
        continue;
      }

      if (
        current.name !== player.name ||
        current.leagueId !== leagueId ||
        current.feedPosition !== player.feedPosition ||
        !current.active
      ) {
        await ctx.db.patch(current._id, {
          name: player.name,
          leagueId: player.leagueId,
          feedPosition: player.feedPosition,
          active: true,
        });
        updated += 1;
      }
    }

    let deactivated = 0;
    for (const player of existing) {
      if (seen.has(player.providerPlayerId) || !player.active) continue;
      await ctx.db.patch(player._id, { active: false });
      deactivated += 1;
    }

    return { created, updated, deactivated };
  },
});

const priceUpsertValidator = v.object({
  providerPlayerId: v.string(),
  price: v.number(),
});

/**
 * Write editorial prices onto existing player rows (FW-PR2 Phase C).
 *
 * The counterpart to `applyClubPlayers`, which creates players with a null
 * price and never touches the field again: this is the pricing pass that fills
 * it, and it is the ONLY write path that does.
 *
 * Strictly additive. It patches `price` and nothing else — no create, no
 * deactivate, no name/club/position refresh — so a price run can never move a
 * player between clubs or resurrect one ingestion retired. A provider id with
 * no row is REPORTED, not inserted: an id the pricing universe knows and the
 * table does not means the two have drifted, and inventing a row here would
 * bury that.
 *
 * Prices are checked against the 4.0-13.0 half-step scale and the whole chunk
 * is rejected on the first offender. Fail closed and fail whole: a mutation is
 * one transaction, so a rejected chunk writes nothing and can simply be re-run
 * after the input is fixed.
 *
 * Chunked by the caller (scripts/seedFantasyPrices.ts) — 2,895 index lookups
 * plus patches is more than one transaction should carry.
 */
export const applyPrices = internalMutation({
  args: { prices: v.array(priceUpsertValidator) },
  handler: async (ctx, { prices }) => {
    for (const { providerPlayerId, price } of prices) {
      if (!isOnPriceScale(price)) {
        throw new Error(
          `Price ${price} for player ${providerPlayerId} is not on the ${PRICE_MIN}-${PRICE_MAX} half-step scale.`,
        );
      }
    }

    let updated = 0;
    let unchanged = 0;
    const missing: string[] = [];

    for (const { providerPlayerId, price } of prices) {
      const player = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) => q.eq("providerPlayerId", providerPlayerId))
        .first();

      if (player === null) {
        missing.push(providerPlayerId);
        continue;
      }
      if (player.price === price) {
        unchanged += 1;
        continue;
      }
      await ctx.db.patch(player._id, { price });
      updated += 1;
    }

    return { requested: prices.length, updated, unchanged, missing };
  },
});

/**
 * Audit one gameweek: does every fixture filed under it actually kick off
 * inside its window?
 *
 * Counts alone cannot answer that. A bootstrap reporting
 * `created === fixturesFetched` proves every fixture resolved SOME gameweek,
 * not the RIGHT one — an off-by-one in the ordinal mapping would produce
 * exactly the same totals while filing every Friday match under the previous
 * week. This re-derives the window from `fantasyGameweekWindows` and checks
 * containment, which is the property the lock engine depends on.
 *
 * Scoped to one gameweek so it stays well inside a query's budget.
 */
export const gameweekAudit = internalQuery({
  args: { season: v.string(), gwNumber: v.number() },
  handler: async (ctx, { season, gwNumber }) => {
    const gameweek = await ctx.db
      .query("fantasyGameweeks")
      .withIndex("by_season_gwNumber", (q) =>
        q.eq("season", season).eq("gwNumber", gwNumber),
      )
      .first();
    if (gameweek === null) return null;

    const fixtures = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
      .collect();

    const kickoffs = fixtures.map((f) => f.kickoffAt).sort((a, b) => a - b);
    const window = kickoffs.length > 0 ? windowFor(kickoffs[0]) : null;

    const outOfWindow = fixtures.filter((f) => {
      const w = windowFor(f.kickoffAt);
      return window === null || w.key !== window.key;
    });

    return {
      gwNumber,
      finalityAt: gameweek.finalityAt,
      leagueIds: gameweek.leagueIds,
      status: gameweek.status,
      fixtureCount: fixtures.length,
      windowKey: window?.key ?? null,
      windowStartsAt: window?.startsAt ?? null,
      windowEndsAt: window?.endsAt ?? null,
      finalityMatchesWindow: window !== null && window.finalityAt === gameweek.finalityAt,
      earliestKickoff: kickoffs[0] ?? null,
      latestKickoff: kickoffs[kickoffs.length - 1] ?? null,
      outOfWindowCount: outOfWindow.length,
      outOfWindowSample: outOfWindow
        .slice(0, 5)
        .map((f) => ({ providerFixtureId: f.providerFixtureId, kickoffAt: f.kickoffAt })),
      leagueBreakdown: Object.fromEntries(
        [...new Set(fixtures.map((f) => f.leagueId))]
          .sort((a, b) => a - b)
          .map((id) => [id, fixtures.filter((f) => f.leagueId === id).length]),
      ),
    };
  },
});

// --------------------------------------------------------------- fetch layer

/** Feed position strings → our four slot roles. Unknown/absent maps to null.
 *  Exported for FW-T1's transfer pipeline, which creates players off the same
 *  squad feed and must map positions identically or drift from bootstrap. */
export function mapFeedPosition(raw: string | null | undefined): "GK" | "DEF" | "MID" | "ATT" | null {
  switch ((raw ?? "").toLowerCase()) {
    case "goalkeeper":
      return "GK";
    case "defender":
      return "DEF";
    case "midfielder":
      return "MID";
    case "attacker":
      return "ATT";
    default:
      return null;
  }
}

function toUpsert(feed: FeedFixture, gwNumber: number): FixtureUpsert {
  return {
    providerFixtureId: String(feed.fixture.id),
    leagueId: feed.league.id,
    // `timestamp` is seconds since epoch and is the provider's own canonical
    // kickoff instant. Preferred over parsing `date`, which carries a printed
    // offset and one more chance to be wrong.
    kickoffAt: feed.fixture.timestamp * 1000,
    gwNumber,
    status: mapStatus(feed.fixture.status.short),
    rawStatus: feed.fixture.status.short,
    homeClubId: String(feed.teams.home.id),
    awayClubId: String(feed.teams.away.id),
    homeGoals: feed.goals.home,
    awayGoals: feed.goals.away,
  };
}

/**
 * How many fixtures go into one `applyFixtureChunk` transaction.
 *
 * Convex gives a mutation a 1-second execution budget, and each fixture costs
 * one indexed read plus at most one write. The first cut of this ingestion put
 * all ~1,800 season fixtures in a single mutation and was killed by that limit;
 * 150 leaves a wide margin while keeping a full-season bootstrap to ~12 round
 * trips. Lower it before raising it — a chunk that times out fails the whole
 * bootstrap, while a small one only costs latency.
 */
const FIXTURE_CHUNK_SIZE = 150;

/**
 * Constitute gameweeks over the WHOLE fetched set, write them, then stream the
 * fixtures in chunks that reference the gameweek by ordinal.
 *
 * Order matters and is not incidental: every chunk resolves its gameweek by
 * (season, gwNumber), so the gameweek pass must have committed first or the
 * chunk silently skips its rows.
 */
async function applyFixtures(
  ctx: ActionCtx,
  seasonLabelValue: string,
  feeds: readonly { feed: FeedFixture; kickoffAt: number }[],
  /**
   * Which of `feeds` to actually WRITE. Defaults to all of them.
   *
   * The split exists because gameweek ordinals are a property of the SEASON,
   * not of whatever slice happened to be fetched. `syncFixtures` reads the
   * whole season so the numbering is stable, then writes only the handful of
   * fixtures near now — if it constituted gameweeks from its own 13-day window
   * it would renumber the season's 40-odd gameweeks as 1, 2, 3 every quarter
   * hour and re-parent every squad in the process.
   */
  shouldWrite: (entry: { feed: FeedFixture; kickoffAt: number }) => boolean = () => true,
): Promise<IngestTotals> {
  const windows = constituteGameweeks(feeds.map((f) => f.kickoffAt));
  const gwNumberByKey = new Map(windows.map((w) => [w.key, w.gwNumber]));

  const leaguesInWindow = new Map<string, Set<number>>();
  for (const { feed, kickoffAt } of feeds) {
    const key = windowFor(kickoffAt).key;
    const set = leaguesInWindow.get(key) ?? new Set<number>();
    set.add(feed.league.id);
    leaguesInWindow.set(key, set);
  }

  const gameweekResult: ApplyGameweeksResult = await ctx.runMutation(
    internal.fantasyIngest.applyGameweeks,
    {
      season: seasonLabelValue,
      windows: windows.map((w) => ({
        gwNumber: w.gwNumber,
        leagueIds: [...(leaguesInWindow.get(w.key) ?? [])].sort((a, b) => a - b),
        finalityAt: w.finalityAt,
      })),
    },
  );

  const upserts = feeds
    .filter(shouldWrite)
    .map(({ feed, kickoffAt }) =>
      toUpsert(feed, gwNumberByKey.get(windowFor(kickoffAt).key) ?? 0),
    );

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let chunks = 0;
  const unmapped: { providerFixtureId: string; rawStatus: string }[] = [];

  for (let i = 0; i < upserts.length; i += FIXTURE_CHUNK_SIZE) {
    const chunk = upserts.slice(i, i + FIXTURE_CHUNK_SIZE);
    const result: ApplyFixturesResult = await ctx.runMutation(
      internal.fantasyIngest.applyFixtureChunk,
      { season: seasonLabelValue, fixtures: chunk },
    );
    created += result.created;
    updated += result.updated;
    unchanged += result.unchanged;
    unmapped.push(...result.unmapped);
    chunks += 1;
  }

  return {
    created,
    updated,
    unchanged,
    unmapped,
    gameweeksCreated: gameweekResult.created,
    gameweeksUpdated: gameweekResult.updated,
    gameweeksTotal: gameweekResult.total,
    chunks,
  };
}

/**
 * One-shot season bootstrap: every fixture of all five leagues.
 *
 * 5 requests. Safe to re-run — `applySeasonFixtures` upserts.
 */
export const bootstrapSeason = internalAction({
  args: { season: v.optional(v.number()) },
  handler: async (ctx, { season = CURRENT_API_SEASON }): Promise<BootstrapSeasonResult> => {
    const client = new ApiFootballClient(credentialsFromEnv());
    const label = seasonLabel(season);

    const all: { feed: FeedFixture; kickoffAt: number }[] = [];
    const perLeague: Record<number, number> = {};

    for (const leagueId of LEAGUE_IDS) {
      const feed = await fetchLeagueFixtures(client, leagueId, season);
      perLeague[leagueId] = feed.length;
      for (const fixture of feed) {
        all.push({ feed: fixture, kickoffAt: fixture.fixture.timestamp * 1000 });
      }
    }

    const result = await applyFixtures(ctx, label, all);

    return {
      season: label,
      apiSeason: season,
      fixturesFetched: all.length,
      perLeague,
      dailyRemaining: client.dailyRemaining,
      ...result,
    };
  },
});

/**
 * Rolling re-read of the fixtures near now.
 *
 * 5 requests per run — one per league over a lookback/lookahead date range,
 * rather than 5 whole-season reads. That is what makes a quarter-hourly cadence
 * affordable: ~480 requests/day against a measured 7,500/day cap.
 *
 * The lookback exists because results and abandonments land AFTER kickoff; the
 * lookahead because a postponement is announced before it.
 */
export const syncFixtures = internalAction({
  args: { season: v.optional(v.number()) },
  handler: async (ctx, { season = CURRENT_API_SEASON }): Promise<SyncFixturesResult> => {
    const client = new ApiFootballClient(credentialsFromEnv());
    const label = seasonLabel(season);
    const now = Date.now();
    const from = isoDay(now - SYNC_LOOKBACK_DAYS * MS_PER_DAY);
    const to = isoDay(now + SYNC_LOOKAHEAD_DAYS * MS_PER_DAY);

    // The WHOLE season, not the date range — one request per league either way,
    // and the ordinals depend on the whole set. The range only narrows what we
    // write. See applyFixtures' `shouldWrite`.
    const all: { feed: FeedFixture; kickoffAt: number }[] = [];
    for (const leagueId of LEAGUE_IDS) {
      const feed = await fetchLeagueFixtures(client, leagueId, season);
      for (const fixture of feed) {
        all.push({ feed: fixture, kickoffAt: fixture.fixture.timestamp * 1000 });
      }
    }

    if (all.length === 0) {
      // Genuinely empty seasons exist before a fixture list is published. An
      // empty result is NOT treated as "delete everything" — nothing here deletes.
      return { season: label, from, to, fixturesFetched: 0, dailyRemaining: client.dailyRemaining };
    }

    const windowStart = now - SYNC_LOOKBACK_DAYS * MS_PER_DAY;
    const windowEnd = now + SYNC_LOOKAHEAD_DAYS * MS_PER_DAY;
    const result = await applyFixtures(
      ctx,
      label,
      all,
      ({ kickoffAt }) => kickoffAt >= windowStart && kickoffAt <= windowEnd,
    );

    return {
      season: label,
      from,
      to,
      fixturesFetched: all.length,
      dailyRemaining: client.dailyRemaining,
      ...result,
    };
  },
});

/**
 * One-shot player bootstrap: every club in the five leagues.
 *
 * 5 requests (club lists) + one per club (96 in a normal season: 20+20+20+18+18).
 * Prices are left null — BUDGET_MODE open item 1.
 *
 * Players whose feed position is missing or unrecognised are counted and
 * skipped, never defaulted. A guessed position would silently mis-drive the
 * §Position mismatch dampener for that player in every gameweek he appears in.
 */
export const bootstrapPlayers = internalAction({
  args: { season: v.optional(v.number()) },
  handler: async (ctx, { season = CURRENT_API_SEASON }): Promise<BootstrapPlayersResult> => {
    const client = new ApiFootballClient(credentialsFromEnv());

    let clubs = 0;
    let created = 0;
    let updated = 0;
    let deactivated = 0;
    let skippedNoPosition = 0;
    const perLeague: Record<number, { clubs: number; players: number }> = {};

    for (const leagueId of LEAGUE_IDS) {
      const teams = await fetchLeagueTeams(client, leagueId, season);
      perLeague[leagueId] = { clubs: teams.length, players: 0 };

      for (const entry of teams) {
        const squads = await fetchSquad(client, entry.team.id);
        const squad = squads[0];
        clubs += 1;
        if (squad === undefined) continue;

        const players = [];
        for (const player of squad.players ?? []) {
          const feedPosition = mapFeedPosition(player.position);
          if (feedPosition === null) {
            skippedNoPosition += 1;
            continue;
          }
          players.push({
            providerPlayerId: String(player.id),
            name: player.name,
            clubId: String(entry.team.id),
            leagueId,
            feedPosition,
          });
        }

        const result = await ctx.runMutation(internal.fantasyIngest.applyClubPlayers, {
          clubId: String(entry.team.id),
          leagueId,
          players,
        });
        created += result.created;
        updated += result.updated;
        deactivated += result.deactivated;
        perLeague[leagueId].players += players.length;
      }
    }

    return {
      apiSeason: season,
      clubs,
      created,
      updated,
      deactivated,
      skippedNoPosition,
      perLeague,
      dailyRemaining: client.dailyRemaining,
    };
  },
});
