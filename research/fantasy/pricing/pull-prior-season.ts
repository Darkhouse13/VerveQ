/**
 * MISSION FW-REPRICE — 2024-25 season aggregates, for the under-900' rule.
 *
 * FW-REPRICE's season-selection rule needs a SECOND season for any player who
 * played under ~900' in 2025-26: "if the season before shows a real body of
 * work, use the prior season's per-90 at a stated discount". 2,621 players
 * qualify as candidates (1,157 scored under 900' + 1,464 with no usable
 * 2025-26 minutes at all), so the per-player `/players?id&season=2024` shape
 * the promoted backfill used would cost 2,621 calls — past the mission's 1,500
 * STOP before a single useful row arrives.
 *
 * So the pull is per-league pages, the same shape as pull-aggregates.ts and
 * pull-expansion-aggregates.ts: 12 leagues (the five top-five, the five
 * second divisions the promoted cohort is priced in, and the three expansion
 * leagues — 40 is both a second division and an expansion league) plus
 * `/teams/statistics` for every (team, league) pair DISCOVERED in those rows,
 * because rawProxyPer90's expectation terms need the club's 2024-25 figures.
 *
 * This costs MORE rows than the rule strictly triggers on and FAR fewer calls.
 * What it cannot see is a player who spent 2024-25 outside these 12 leagues;
 * he simply has no prior season, which the rule already handles (both seasons
 * thin -> 4.0 floor, flagged). That limit is stated in PROXY_METHOD.md rather
 * than papered over.
 *
 * Quota discipline identical to its two predecessors: plan printed before any
 * request, worst case costed at the page cap, guard re-checked before every
 * request, STOP at MAX_CALLS before the offending one.
 *
 * Output: pricing/data/prior-aggregates-2024-25.json,
 *         pricing/data/prior-team-stats-2024-25.json.
 *
 * Run: npx tsx pricing/pull-prior-season.ts [--plan-only]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ApiFootballClient, type ApiEnvelope } from '../fetch/apiFootball.ts';
import { EXPANSION_LEAGUES, LEAGUES, type LeagueSpec } from '../fetch/config.ts';
import { describeKey, loadEnv } from '../fetch/env.ts';
import { createFreshState, loadState } from '../fetch/state.ts';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(PRICING_DIR, 'data');
const AGGREGATES_PATH = path.join(DATA_DIR, 'prior-aggregates-2024-25.json');
const TEAM_STATS_PATH = path.join(DATA_DIR, 'prior-team-stats-2024-25.json');

const SEASON = 2024; // API-Football label for the 2024-25 season
const MAX_CALLS = 1_500; // mission STOP threshold

/**
 * 80, not the predecessors' 100, and not the 60 this script first tried.
 *
 * MEASURED 2026-08-13: the 2024-25 Championship paginates to 61 pages — more
 * than its own 2025-26 season (48), because a 24-club second division churns
 * squads. The first run aborted on that page cap having spent 246 calls on the
 * five top-five leagues, which the manifest ledgers as `wastedCalls`; the
 * pull scripts hold no page cache, so a retry re-buys them.
 *
 * 80 clears the measured maximum by a third and still keeps the worst-case
 * plan (12 x 80 + team stats = 1,242) under the 1,500 STOP. A league that
 * paginates past it aborts rather than silently truncating.
 */
const PAGE_CAP_PER_LEAGUE = 80;

/** Calls burned by the aborted first run (see PAGE_CAP_PER_LEAGUE). Ledger only. */
const WASTED_CALLS_FIRST_RUN = 246;

/**
 * The second divisions the promoted cohort is priced in (PROXY_METHOD.md
 * "Pools"). Named here rather than imported because fetch/config.ts
 * deliberately scopes LEAGUES/EXPANSION_LEAGUES to their own pulls.
 */
const SECOND_TIER_LEAGUES: readonly LeagueSpec[] = [
  { id: 40, name: 'Championship', country: 'England', typicalTeams: 24 },
  { id: 141, name: 'Segunda División', country: 'Spain', typicalTeams: 22 },
  { id: 136, name: 'Serie B', country: 'Italy', typicalTeams: 20 },
  { id: 79, name: '2. Bundesliga', country: 'Germany', typicalTeams: 18 },
  { id: 62, name: 'Ligue 2', country: 'France', typicalTeams: 18 },
] as const;

/** The 12 distinct pricing leagues, deduplicated (40 is second tier AND expansion). */
const PRICING_LEAGUES: readonly LeagueSpec[] = [
  ...LEAGUES,
  ...SECOND_TIER_LEAGUES,
  ...EXPANSION_LEAGUES,
].filter((league, i, all) => all.findIndex((l) => l.id === league.id) === i);

interface PlayerRow {
  player: { id: number; name: string };
  statistics: Array<Record<string, unknown>>;
}

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

function n(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function main(): Promise<void> {
  const planOnly = process.argv.includes('--plan-only');

  const teamStatsWorstCase = PRICING_LEAGUES.reduce((sum, l) => sum + l.typicalTeams + 4, 0);
  const worstCase = PRICING_LEAGUES.length * PAGE_CAP_PER_LEAGUE + teamStatsWorstCase;

  log(`CALL PLAN — 2024-25 (season=${SEASON}), worst case costed at the per-league page cap:`);
  for (const league of PRICING_LEAGUES) {
    log(`  /players?league=${league.id}&season=${SEASON}  pages: <= ${PAGE_CAP_PER_LEAGUE}  (${league.name})`);
  }
  log(`  /teams/statistics?league&season&team  x <= ${teamStatsWorstCase} (discovered 2024-25 members)`);
  log(`  ${PRICING_LEAGUES.length} leagues -> worst case ${worstCase} calls, STOP threshold ${MAX_CALLS}`);
  log(`  (plus ${WASTED_CALLS_FIRST_RUN} already burned by the aborted 60-page-cap run — ledgered, not re-spendable)`);
  if (worstCase > MAX_CALLS) {
    log('STOP: worst-case plan exceeds the mission call budget. Nothing was requested.');
    process.exitCode = 2;
    return;
  }
  if (planOnly) return;

  const env = loadEnv();
  if (env === null) {
    log('STOP: API_FOOTBALL_KEY not found in process env or fetch/.env. Nothing was requested.');
    process.exitCode = 2;
    return;
  }
  log(`key loaded (${describeKey(env.apiKey)}), auth mode ${env.authMode}`);

  const state = loadState() ?? createFreshState();
  const client = new ApiFootballClient({
    apiKey: env.apiKey,
    authMode: env.authMode,
    state,
    dryRun: false,
    log,
  });

  let calls = 0;
  const guard = (): void => {
    if (calls >= MAX_CALLS) {
      throw new Error(`call budget breached: ${calls} >= ${MAX_CALLS} — aborting before the next request`);
    }
  };

  // ---- players pull, per league ---------------------------------------------
  const rawRows: Array<PlayerRow & { pulledForLeague: number }> = [];
  const pagesPerLeague: Record<number, number> = {};
  for (const league of PRICING_LEAGUES) {
    let page = 1;
    let totalPages = 1;
    do {
      guard();
      calls += 1;
      const envelope: ApiEnvelope<PlayerRow[]> = await client.request('/players', {
        league: league.id,
        season: SEASON,
        page,
      });
      for (const row of envelope.response) rawRows.push({ ...row, pulledForLeague: league.id });
      totalPages = envelope.paging.total;
      if (totalPages > PAGE_CAP_PER_LEAGUE) {
        throw new Error(
          `league ${league.id} paginates to ${totalPages} pages > cap ${PAGE_CAP_PER_LEAGUE} — aborting (we do not understand this)`,
        );
      }
      page += 1;
    } while (page <= totalPages);
    pagesPerLeague[league.id] = totalPages;
    log(`  league ${league.id} (${league.name}): ${totalPages} pages, ${calls} calls so far`);
  }

  // ---- discover (team, league) pairs, then 2024-25 team figures -------------
  const leagueIds = new Set(PRICING_LEAGUES.map((l) => l.id));
  const pairs = new Map<string, { teamId: number; leagueId: number }>();
  for (const row of rawRows) {
    for (const s of row.statistics ?? []) {
      const leagueId = n((s as Record<string, any>).league?.id);
      const teamId = n((s as Record<string, any>).team?.id);
      if (teamId === 0 || !leagueIds.has(leagueId)) continue;
      pairs.set(`${teamId}|${leagueId}`, { teamId, leagueId });
    }
  }
  log(`  discovered ${pairs.size} (team, league) pairs for 2024-25 team figures`);
  if (calls + pairs.size > MAX_CALLS) {
    throw new Error(
      `STOP: ${calls} calls spent + ${pairs.size} team-stat calls would breach ${MAX_CALLS}. Player rows are unwritten; nothing further requested.`,
    );
  }

  const teamStats: Array<Record<string, unknown>> = [];
  for (const { teamId, leagueId } of pairs.values()) {
    guard();
    calls += 1;
    const envelope: ApiEnvelope<Record<string, unknown>> = await client.request('/teams/statistics', {
      league: leagueId,
      season: SEASON,
      team: teamId,
    });
    teamStats.push(envelope.response);
  }

  // ---- artifacts --------------------------------------------------------------
  const manifest = {
    pulledAt: new Date().toISOString(),
    season: SEASON,
    seasonLabel: '2024-25',
    mission: 'FW-REPRICE — prior-season aggregates for the under-900\' season-selection rule',
    leagues: PRICING_LEAGUES.map((l) => l.id),
    calls,
    wastedCalls: WASTED_CALLS_FIRST_RUN,
    callsIncludingWasted: calls + WASTED_CALLS_FIRST_RUN,
    pagesPerLeague,
    rows: rawRows.length,
    teamStatPairs: pairs.size,
    script: 'pricing/pull-prior-season.ts',
  };
  fs.writeFileSync(AGGREGATES_PATH, JSON.stringify({ manifest, rows: rawRows }, null, 1));
  fs.writeFileSync(TEAM_STATS_PATH, JSON.stringify({ manifest, teams: teamStats }, null, 1));
  log(`\ncalls spent: ${calls} of ${MAX_CALLS}; rows: ${rawRows.length}; team stats: ${teamStats.length}`);
  log(`wrote ${path.basename(AGGREGATES_PATH)}, ${path.basename(TEAM_STATS_PATH)}`);
}

await main();
