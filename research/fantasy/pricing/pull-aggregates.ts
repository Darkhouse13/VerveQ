/**
 * TICKET FW-PR1 Step 2 — 2025-26 season aggregates for the pricing universe.
 *
 * Pulls per-player season aggregates for the five leagues from the paginated
 * `/players` endpoint (season=2025 == the 2025-26 season), plus per-club
 * season figures from `/teams/statistics` (clean sheets / goals against, which
 * player aggregate rows cannot supply for outfielders — same feed limit as
 * scoring G2).
 *
 * Quota discipline (ticket, fail-closed):
 *  - The call plan prints BEFORE any request leaves the machine, costed at the
 *    per-league page cap (the worst case we will permit, not a guess). If the
 *    worst case exceeds MAX_CALLS the run refuses to start.
 *  - As real page counts arrive, the plan re-costs itself; crossing MAX_CALLS
 *    mid-run aborts before the offending request, never after.
 *  - Transport goes through fetch/apiFootball.ts exclusively, so every request
 *    is metered against the same daily ledger the FW-2 pulls use, at the same
 *    ≤240/min pace (250ms spacing < the ticket's 250/min ceiling).
 *
 * Output: pricing/data/player-aggregates-2025-26.json — raw rows exactly as
 * the feed sent them, plus a manifest (date, endpoints, call count, join rate).
 * Club figures land in pricing/data/team-stats-2025-26.json, named by the
 * manifest. Nothing here derives or scores; that is proxy.ts's job.
 *
 * Run: npx tsx pricing/pull-aggregates.ts [--plan-only]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ApiFootballClient, type ApiEnvelope } from '../fetch/apiFootball.ts';
import { LEAGUES } from '../fetch/config.ts';
import { describeKey, loadEnv } from '../fetch/env.ts';
import { createFreshState, loadState, saveState } from '../fetch/state.ts';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(PRICING_DIR, 'data');
const UNIVERSE_PATH = path.join(DATA_DIR, 'players-seed-snapshot.json');
const AGGREGATES_PATH = path.join(DATA_DIR, 'player-aggregates-2025-26.json');
const TEAM_STATS_PATH = path.join(DATA_DIR, 'team-stats-2025-26.json');

const SEASON = 2025; // API-Football season label for 2025-26 (ticket: decided)
const MAX_CALLS = 2_000; // ticket STOP threshold
/**
 * Per-league page ceiling. The /players endpoint serves 20 rows a page; a
 * 20-club league with generous squad churn is ~700-900 stat rows, i.e. under
 * 50 pages. 100 is not a prediction — it is the hard cap the worst-case plan
 * is costed against, and a league that somehow paginates past it aborts the
 * run rather than spending quota on something we do not understand.
 */
const PAGE_CAP_PER_LEAGUE = 100;
const JOIN_GATE = 0.9; // ticket: STOP below 90%

interface UniversePlayer {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubId: number;
  leagueId: number;
  position: 'GK' | 'DEF' | 'MID' | 'ATT';
  active: boolean;
}

/** One raw row from /players — a player plus per-competition statistics. */
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

function loadUniverse(): UniversePlayer[] {
  const parsed = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf-8')) as {
    players: UniversePlayer[];
  };
  return parsed.players;
}

async function main(): Promise<void> {
  const planOnly = process.argv.includes('--plan-only');
  const universe = loadUniverse();
  const clubIds = [...new Set(universe.map((p) => p.clubId))].sort((a, b) => a - b);

  // ---- call plan, before anything touches the network -----------------------
  const worstCase = LEAGUES.length * PAGE_CAP_PER_LEAGUE + clubIds.length;
  log('CALL PLAN (worst case, costed at the per-league page cap):');
  for (const league of LEAGUES) {
    log(`  /players?league=${league.id}&season=${SEASON}  pages: <= ${PAGE_CAP_PER_LEAGUE}  (${league.name})`);
  }
  log(`  /teams/statistics?league&season&team  x ${clubIds.length} clubs`);
  log(`  worst case ${worstCase} calls, STOP threshold ${MAX_CALLS}`);
  if (worstCase > MAX_CALLS) {
    log('STOP: worst-case plan exceeds the ticket call budget. Nothing was requested.');
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
  const endpointsUsed: string[] = [];
  const guard = (): void => {
    if (calls >= MAX_CALLS) {
      throw new Error(`call budget breached: ${calls} >= ${MAX_CALLS} — aborting before the next request`);
    }
  };

  // ---- players pull ---------------------------------------------------------
  const rawRows: PlayerRow[] = [];
  const pagesPerLeague: Record<number, number> = {};
  for (const league of LEAGUES) {
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
      totalPages = envelope.paging.total;
      if (totalPages > PAGE_CAP_PER_LEAGUE) {
        throw new Error(
          `league ${league.id} reports ${totalPages} pages, past the ${PAGE_CAP_PER_LEAGUE}-page cap the plan was costed at — aborting`,
        );
      }
      // Re-cost the plan against reality the moment reality is known.
      const knownRemaining =
        LEAGUES.filter((l) => !(l.id in pagesPerLeague) && l.id !== league.id).length * PAGE_CAP_PER_LEAGUE +
        (totalPages - page) +
        clubIds.length;
      if (calls + knownRemaining > MAX_CALLS) {
        throw new Error(`re-costed plan (${calls} spent + ${knownRemaining} to go) breaches ${MAX_CALLS} — aborting`);
      }
      rawRows.push(...envelope.response);
      if (page === 1) log(`  ${league.name}: ${totalPages} pages`);
      page += 1;
    } while (page <= totalPages);
    pagesPerLeague[league.id] = totalPages;
  }
  log(`players pull complete: ${rawRows.length} rows, ${calls} calls`);
  endpointsUsed.push(`/players?league={39,140,135,78,61}&season=${SEASON}&page=1..N`);

  // ---- team season stats ----------------------------------------------------
  const clubToLeague = new Map<number, number>();
  for (const p of universe) clubToLeague.set(p.clubId, p.leagueId);

  const teamStats: Array<Record<string, unknown>> = [];
  for (const clubId of clubIds) {
    guard();
    calls += 1;
    const envelope = await client.request<Record<string, unknown>>('/teams/statistics', {
      league: clubToLeague.get(clubId) as number,
      season: SEASON,
      team: clubId,
    });
    teamStats.push(envelope.response);
  }
  log(`team stats pull complete: ${teamStats.length} clubs, ${calls} calls total`);
  endpointsUsed.push(`/teams/statistics?league&season=${SEASON}&team={96 club ids}`);

  // ---- join to the universe -------------------------------------------------
  const pulledIds = new Set(rawRows.map((row) => row.player.id));
  const matched = universe.filter((p) => pulledIds.has(p.apiFootballId));
  const unmatched = universe.filter((p) => !pulledIds.has(p.apiFootballId));
  const joinRate = matched.length / universe.length;
  log(
    `join: ${matched.length}/${universe.length} universe players have 2025-26 aggregate rows ` +
      `(${(joinRate * 100).toFixed(1)}%); ${unmatched.length} without`,
  );

  // ---- persist --------------------------------------------------------------
  const manifest = {
    pulledAt: new Date().toISOString(),
    season: SEASON,
    seasonLabel: '2025-26',
    endpoints: endpointsUsed,
    callCount: calls,
    pagesPerLeague,
    playerRowCount: rawRows.length,
    universeCount: universe.length,
    joinedCount: matched.length,
    joinRate,
    teamStatsFile: path.basename(TEAM_STATS_PATH),
    pace: 'fetch/apiFootball.ts shared client, 250ms spacing (240/min)',
  };
  fs.writeFileSync(AGGREGATES_PATH, JSON.stringify({ manifest, rows: rawRows }, null, 1));
  fs.writeFileSync(
    TEAM_STATS_PATH,
    JSON.stringify({ manifest: { pulledAt: manifest.pulledAt, season: SEASON, clubs: teamStats.length }, teams: teamStats }, null, 1),
  );
  saveState(state);
  log(`wrote ${path.basename(AGGREGATES_PATH)} and ${path.basename(TEAM_STATS_PATH)}`);
  log(`server says ${client.serverDailyRemaining ?? '?'} requests remain today (limit ${client.serverDailyLimit ?? '?'})`);

  if (joinRate < JOIN_GATE) {
    const byClub = new Map<number, number>();
    for (const p of unmatched) byClub.set(p.clubId, (byClub.get(p.clubId) ?? 0) + 1);
    log(`STOP: join rate ${(joinRate * 100).toFixed(1)}% is below the ${JOIN_GATE * 100}% gate. Unmatched by club:`);
    for (const [clubId, count] of [...byClub.entries()].sort((a, b) => b[1] - a[1])) {
      log(`  club ${clubId}: ${count}`);
    }
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  log(`FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
