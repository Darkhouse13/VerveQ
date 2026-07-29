/**
 * TICKET FW-PR1 Phase A resume — owner-ruled backfill (modified option C).
 *
 * Three bounded pulls, one script, same fail-closed discipline as
 * pull-aggregates.ts (plan printed before any request; re-costed as reality
 * arrives; shared FW-2 client + daily ledger; ≤240/min):
 *
 *  1. Per-id 2025-26 stats for the promoted cohort — the 317 universe players
 *     at the 13 promoted clubs with no top-five rows. `/players?id&season`
 *     returns every competition; proxy.ts later filters to second-division
 *     league rows. COHORT-INTERNAL signal only, per the ruling.
 *  2. Top-five team season stats for the 17 (team,league) pairs that appear in
 *     matched players' 2025-26 rows but were not among the 96 current clubs —
 *     relegated sides whose ex-players now play elsewhere. Without these, the
 *     clean-sheet/concession expectation would silently zero for those players.
 *  3. Second-division team season stats for every (team,league) pair the
 *     cohort's rows actually reference (their promoted clubs plus loan clubs),
 *     discovered from pull 1 and capped.
 *
 * Output: pricing/data/promoted-backfill-2025-26.json and
 * pricing/data/team-stats-extra-2025-26.json, manifests included.
 *
 * Run: npx tsx pricing/backfill-promoted.ts [--plan-only]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ApiFootballClient } from '../fetch/apiFootball.ts';
import { describeKey, loadEnv } from '../fetch/env.ts';
import { createFreshState, loadState, saveState, spentToday } from '../fetch/state.ts';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(PRICING_DIR, 'data');
const UNIVERSE_PATH = path.join(DATA_DIR, 'players-seed-snapshot.json');
const AGGREGATES_PATH = path.join(DATA_DIR, 'player-aggregates-2025-26.json');
const TEAM_STATS_PATH = path.join(DATA_DIR, 'team-stats-2025-26.json');
const BACKFILL_PATH = path.join(DATA_DIR, 'promoted-backfill-2025-26.json');
const TEAM_EXTRA_PATH = path.join(DATA_DIR, 'team-stats-extra-2025-26.json');

const SEASON = 2025;
const MAX_CALLS = 2_000;
const TOP5 = new Set([39, 140, 135, 78, 61]);
/** Country's second tier, keyed by its top league. */
const SECOND_TIER: Record<number, number> = { 39: 40, 140: 141, 135: 136, 78: 79, 61: 62 };
const SECOND_TIER_IDS = new Set(Object.values(SECOND_TIER));
/**
 * Promoted club = >= 20 universe players with no top-five 2025-26 rows. On the
 * 2026-07-29 pull this yields exactly the 13 clubs the owner ruled on
 * (Paderborn, at 11, is deliberately outside it). Asserted, not assumed.
 */
const PROMOTED_MIN_UNMATCHED = 20;
const EXPECTED_PROMOTED_CLUBS = 13;
/** Cap on discovered second-division team-stat calls (13 clubs + loan clubs). */
const SECOND_TIER_TEAM_CAP = 80;

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

interface UniversePlayer {
  apiFootballId: number;
  name: string;
  clubId: number;
  leagueId: number;
  position: string;
}

function main(): Promise<void> | void {
  const planOnly = process.argv.includes('--plan-only');

  const universe = (JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf-8')) as { players: UniversePlayer[] }).players;
  const aggregates = JSON.parse(fs.readFileSync(AGGREGATES_PATH, 'utf-8')) as {
    rows: Array<{ player: { id: number }; statistics: Array<Record<string, any>> }>;
  };
  const teamStats = JSON.parse(fs.readFileSync(TEAM_STATS_PATH, 'utf-8')) as {
    teams: Array<Record<string, any>>;
  };

  // ---- cohort ---------------------------------------------------------------
  const pulledIds = new Set(aggregates.rows.map((r) => r.player.id));
  const unmatched = universe.filter((p) => !pulledIds.has(p.apiFootballId));
  const unmatchedByClub = new Map<number, number>();
  for (const p of unmatched) unmatchedByClub.set(p.clubId, (unmatchedByClub.get(p.clubId) ?? 0) + 1);
  const promotedClubs = [...unmatchedByClub.entries()]
    .filter(([, count]) => count >= PROMOTED_MIN_UNMATCHED)
    .map(([clubId]) => clubId);
  if (promotedClubs.length !== EXPECTED_PROMOTED_CLUBS) {
    log(`STOP: expected ${EXPECTED_PROMOTED_CLUBS} promoted clubs, derived ${promotedClubs.length}. Nothing was requested.`);
    process.exitCode = 2;
    return;
  }
  const promotedSet = new Set(promotedClubs);
  const cohort = unmatched.filter((p) => promotedSet.has(p.clubId));

  // ---- missing top-five (team,league) pairs ---------------------------------
  const haveTeamStats = new Set(
    teamStats.teams.map((t) => `${t.team?.id}|${t.league?.id}`),
  );
  const missingTopFive: Array<{ team: number; league: number }> = [];
  const seenPairs = new Set<string>();
  for (const row of aggregates.rows) {
    for (const s of row.statistics) {
      const league = s.league?.id as number | undefined;
      const team = s.team?.id as number | undefined;
      if (league === undefined || team === undefined || !TOP5.has(league)) continue;
      const key = `${team}|${league}`;
      if (haveTeamStats.has(key) || seenPairs.has(key)) continue;
      seenPairs.add(key);
      missingTopFive.push({ team, league });
    }
  }

  // ---- call plan ------------------------------------------------------------
  const worstCase = cohort.length + missingTopFive.length + SECOND_TIER_TEAM_CAP;
  log('CALL PLAN (worst case; second-division team calls costed at the cap):');
  log(`  /players?id={pid}&season=${SEASON}  x ${cohort.length} promoted-cohort players (13 clubs)`);
  log(`  /teams/statistics (top-five, relegated sides)  x ${missingTopFive.length}`);
  log(`  /teams/statistics (second division, discovered)  x <= ${SECOND_TIER_TEAM_CAP}`);
  log(`  worst case ${worstCase} calls, STOP threshold ${MAX_CALLS}`);
  if (worstCase > MAX_CALLS) {
    log('STOP: worst-case plan exceeds the ticket call budget. Nothing was requested.');
    process.exitCode = 2;
    return;
  }
  if (planOnly) return;
  return run(cohort, promotedClubs, missingTopFive, worstCase);
}

async function run(
  cohort: UniversePlayer[],
  promotedClubs: number[],
  missingTopFive: Array<{ team: number; league: number }>,
  worstCase: number,
): Promise<void> {
  const env = loadEnv();
  if (env === null) {
    log('STOP: API_FOOTBALL_KEY not found in process env or fetch/.env. Nothing was requested.');
    process.exitCode = 2;
    return;
  }
  const state = loadState() ?? createFreshState();
  log(`key loaded (${describeKey(env.apiKey)}); ledger says ${spentToday(state)} requests already spent today`);

  const client = new ApiFootballClient({ apiKey: env.apiKey, authMode: env.authMode, state, dryRun: false, log });
  let calls = 0;
  const guard = (): void => {
    if (calls >= Math.min(MAX_CALLS, worstCase)) {
      throw new Error(`call budget breached: ${calls} — aborting before the next request`);
    }
  };

  // ---- 1. per-id cohort pulls ----------------------------------------------
  const rows: Array<Record<string, any>> = [];
  let emptyResponses = 0;
  for (const p of cohort) {
    guard();
    calls += 1;
    const envelope = await client.request<Array<Record<string, any>>>('/players', {
      id: p.apiFootballId,
      season: SEASON,
    });
    if (envelope.response.length === 0) {
      emptyResponses += 1;
      continue;
    }
    rows.push(...envelope.response);
  }
  log(`cohort pull complete: ${rows.length} rows, ${emptyResponses} players with no 2025-26 data at all, ${calls} calls`);

  // ---- 2. relegated-side top-five team stats -------------------------------
  const topFiveExtra: Array<Record<string, any>> = [];
  for (const pair of missingTopFive) {
    guard();
    calls += 1;
    const envelope = await client.request<Record<string, any>>('/teams/statistics', {
      league: pair.league,
      season: SEASON,
      team: pair.team,
    });
    topFiveExtra.push(envelope.response);
  }
  log(`relegated-side team stats complete: ${topFiveExtra.length}, ${calls} calls total`);

  // ---- 3. second-division team stats, discovered from the cohort rows ------
  const pairs = new Map<string, { team: number; league: number }>();
  for (const row of rows) {
    for (const s of row.statistics ?? []) {
      const league = s.league?.id as number | undefined;
      const team = s.team?.id as number | undefined;
      if (league === undefined || team === undefined || !SECOND_TIER_IDS.has(league)) continue;
      pairs.set(`${team}|${league}`, { team, league });
    }
  }
  if (pairs.size > SECOND_TIER_TEAM_CAP) {
    throw new Error(`discovered ${pairs.size} second-division (team,league) pairs, past the ${SECOND_TIER_TEAM_CAP} cap the plan was costed at — aborting`);
  }
  const secondTierStats: Array<Record<string, any>> = [];
  for (const pair of pairs.values()) {
    guard();
    calls += 1;
    const envelope = await client.request<Record<string, any>>('/teams/statistics', {
      league: pair.league,
      season: SEASON,
      team: pair.team,
    });
    secondTierStats.push(envelope.response);
  }
  log(`second-division team stats complete: ${secondTierStats.length}, ${calls} calls total`);

  // ---- persist --------------------------------------------------------------
  const manifest = {
    pulledAt: new Date().toISOString(),
    season: SEASON,
    ruling: 'FW-PR1 modified option C — promoted-cohort backfill, cohort-internal signal only',
    promotedClubIds: promotedClubs,
    cohortSize: cohort.length,
    emptyResponses,
    endpoints: [
      `/players?id&season=${SEASON} x ${cohort.length}`,
      `/teams/statistics top-five relegated x ${missingTopFive.length}`,
      `/teams/statistics second-division x ${secondTierStats.length}`,
    ],
    callCount: calls,
  };
  fs.writeFileSync(BACKFILL_PATH, JSON.stringify({ manifest, rows }, null, 1));
  fs.writeFileSync(
    TEAM_EXTRA_PATH,
    JSON.stringify(
      { manifest: { pulledAt: manifest.pulledAt, season: SEASON }, topFive: topFiveExtra, secondTier: secondTierStats },
      null,
      1,
    ),
  );
  saveState(state);
  log(`wrote ${path.basename(BACKFILL_PATH)} and ${path.basename(TEAM_EXTRA_PATH)}`);
  log(`server says ${client.serverDailyRemaining ?? '?'} requests remain today (limit ${client.serverDailyLimit ?? '?'})`);
}

Promise.resolve(main()).catch((error: unknown) => {
  log(`FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
