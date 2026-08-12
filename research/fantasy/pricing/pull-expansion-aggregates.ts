/**
 * MISSION FW-EXPAND O2 — 2025-26 season aggregates for the three expansion
 * leagues (Eredivisie 88, Primeira Liga 94, EFL Championship 40).
 *
 * R1 (owner ruling 2026-08-02): each league is its own cohort, proxied from
 * THAT league's own 2025-26 aggregates — no cross-league comparison. So the
 * pull is per-league `/players?league&season=2025` pages (the exact shape of
 * pull-aggregates.ts), plus `/teams/statistics` for every (team, league) pair
 * DISCOVERED in those rows (the 2025-26 membership, not the 2026-27 one —
 * relegated/promoted clubs differ), plus one `/teams?league&season=2026` per
 * league for the CURRENT clubs' display names (fantasyDraftPoolMeta.clubName
 * is per-player and the schema deliberately has no clubs table).
 *
 * Quota discipline identical to pull-aggregates.ts: plan printed before any
 * request, worst case costed at the page cap, re-costed mid-run, STOP at
 * MAX_CALLS before the offending request.
 *
 * Output: pricing/data/expansion-aggregates-2025-26.json,
 *         pricing/data/expansion-team-stats-2025-26.json,
 *         pricing/data/expansion-current-clubs-2026.json.
 *
 * Run: npx tsx pricing/pull-expansion-aggregates.ts [--plan-only]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ApiFootballClient, type ApiEnvelope } from '../fetch/apiFootball.ts';
import { EXPANSION_LEAGUES } from '../fetch/config.ts';
import { describeKey, loadEnv } from '../fetch/env.ts';
import { createFreshState, loadState } from '../fetch/state.ts';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(PRICING_DIR, 'data');
const AGGREGATES_PATH = path.join(DATA_DIR, 'expansion-aggregates-2025-26.json');
const TEAM_STATS_PATH = path.join(DATA_DIR, 'expansion-team-stats-2025-26.json');
const CURRENT_CLUBS_PATH = path.join(DATA_DIR, 'expansion-current-clubs-2026.json');

const SEASON = 2025; // API-Football label for the 2025-26 season
const CURRENT_SEASON = 2026;
const MAX_CALLS = 1_500; // mission STOP threshold per phase
/** Same rationale as pull-aggregates.ts; the Championship's 24 clubs stay under it. */
const PAGE_CAP_PER_LEAGUE = 100;

interface PlayerRow {
  player: { id: number; name: string };
  statistics: Array<Record<string, unknown>>;
}

interface TeamRow {
  team: { id: number; name: string };
}

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

function n(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function main(): Promise<void> {
  const planOnly = process.argv.includes('--plan-only');

  const worstCase =
    EXPANSION_LEAGUES.length * PAGE_CAP_PER_LEAGUE + // player pages
    EXPANSION_LEAGUES.reduce((sum, l) => sum + l.typicalTeams + 4, 0) + // team stats (2025-26 members, small headroom)
    EXPANSION_LEAGUES.length; // current club lists
  log('CALL PLAN (worst case, costed at the per-league page cap):');
  for (const league of EXPANSION_LEAGUES) {
    log(`  /players?league=${league.id}&season=${SEASON}  pages: <= ${PAGE_CAP_PER_LEAGUE}  (${league.name})`);
  }
  log(`  /teams/statistics?league&season&team  x ~${EXPANSION_LEAGUES.reduce((s, l) => s + l.typicalTeams + 4, 0)} (discovered 2025-26 members)`);
  log(`  /teams?league&season=${CURRENT_SEASON}  x ${EXPANSION_LEAGUES.length} (current club names)`);
  log(`  worst case ${worstCase} calls, STOP threshold ${MAX_CALLS}`);
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

  // ---- players pull, per league --------------------------------------------
  const rawRows: Array<PlayerRow & { pulledForLeague: number }> = [];
  const pagesPerLeague: Record<number, number> = {};
  for (const league of EXPANSION_LEAGUES) {
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
    log(`  league ${league.id} (${league.name}): ${totalPages} pages`);
  }

  // ---- discover 2025-26 (team, league) pairs, then team stats --------------
  const pairs = new Map<string, { teamId: number; leagueId: number }>();
  for (const row of rawRows) {
    for (const s of row.statistics ?? []) {
      const leagueId = n((s as Record<string, any>).league?.id);
      const teamId = n((s as Record<string, any>).team?.id);
      if (teamId === 0) continue;
      if (!EXPANSION_LEAGUES.some((l) => l.id === leagueId)) continue;
      pairs.set(`${teamId}|${leagueId}`, { teamId, leagueId });
    }
  }
  log(`  discovered ${pairs.size} (team, league) pairs for 2025-26 team figures`);

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

  // ---- current (2026-27) club names ----------------------------------------
  const currentClubs: Array<{ leagueId: number; teamId: number; name: string }> = [];
  for (const league of EXPANSION_LEAGUES) {
    guard();
    calls += 1;
    const envelope: ApiEnvelope<TeamRow[]> = await client.request('/teams', {
      league: league.id,
      season: CURRENT_SEASON,
    });
    for (const row of envelope.response) {
      currentClubs.push({ leagueId: league.id, teamId: row.team.id, name: row.team.name });
    }
  }

  // ---- artifacts -------------------------------------------------------------
  const manifest = {
    pulledAt: new Date().toISOString(),
    season: SEASON,
    leagues: EXPANSION_LEAGUES.map((l) => l.id),
    calls,
    pagesPerLeague,
    rows: rawRows.length,
    teamStatPairs: pairs.size,
    script: 'pricing/pull-expansion-aggregates.ts',
  };
  fs.writeFileSync(AGGREGATES_PATH, JSON.stringify({ manifest, rows: rawRows }, null, 1));
  fs.writeFileSync(TEAM_STATS_PATH, JSON.stringify({ manifest, teams: teamStats }, null, 1));
  fs.writeFileSync(CURRENT_CLUBS_PATH, JSON.stringify({ manifest, clubs: currentClubs }, null, 1));
  log(`\ncalls spent: ${calls}; rows: ${rawRows.length}; team stats: ${teamStats.length}; current clubs: ${currentClubs.length}`);
  log(`wrote ${path.basename(AGGREGATES_PATH)}, ${path.basename(TEAM_STATS_PATH)}, ${path.basename(CURRENT_CLUBS_PATH)}`);
}

await main();
