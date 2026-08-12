/**
 * MISSION FW-EXPAND O1 — resolve the three expansion leagues' API-Football ids
 * from the feed itself (owner rule: do NOT trust memory for league ids).
 *
 * One `/leagues?country` call per league (3 total; the feed refuses search
 * combined with country, so filtering is local). Candidates are
 * filtered fail-closed: type "League", exact country, name matching the
 * accepted aliases below, and 2026 listed among the seasons. Anything other
 * than exactly one survivor per league STOPs with the full candidate list
 * printed — nothing is guessed.
 *
 * Output: research/fantasy/data/expansion-leagues-2026.json (gitignored
 * artifact; the resolved ids are then pinned in code constants with this
 * script cited as provenance).
 *
 * Run: npx tsx fetch/resolveExpansionLeagues.ts [--plan-only]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ApiFootballClient, type ApiEnvelope } from './apiFootball.ts';
import { describeKey, loadEnv } from './env.ts';
import { createFreshState, loadState } from './state.ts';

const FETCH_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(FETCH_DIR, '..', 'data', 'expansion-leagues-2026.json');

const TARGET_SEASON = 2026; // the 2026-27 season, as API-Football names it

interface Target {
  /** What we call it (mission wording). */
  label: string;
  search: string;
  country: string;
  /** Feed names accepted as THE league, lowercased. */
  aliases: string[];
}

const TARGETS: readonly Target[] = [
  { label: 'Eredivisie', search: 'Eredivisie', country: 'Netherlands', aliases: ['eredivisie'] },
  {
    label: 'Liga Portugal (Primeira Liga)',
    search: 'Primeira',
    country: 'Portugal',
    aliases: ['primeira liga', 'liga portugal', 'liga portugal betclic'],
  },
  {
    label: 'EFL Championship',
    search: 'Championship',
    country: 'England',
    aliases: ['championship', 'efl championship'],
  },
];

interface LeagueRow {
  league: { id: number; name: string; type: string };
  country: { name: string };
  seasons: Array<{ year: number; current: boolean }>;
}

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const planOnly = process.argv.includes('--plan-only');

  log('CALL PLAN:');
  for (const t of TARGETS) {
    log(`  /leagues?country=${t.country}  (${t.label})`);
  }
  log(`  total 3 calls (STOP threshold n/a — fixed plan)`);
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

  const resolved: Array<{
    label: string;
    leagueId: number;
    feedName: string;
    country: string;
    season2026Current: boolean;
  }> = [];

  for (const t of TARGETS) {
    const envelope: ApiEnvelope<LeagueRow[]> = await client.request('/leagues', {
      country: t.country,
    });
    const rows = envelope.response;
    log(`\n${t.label} — ${rows.length} leagues in ${t.country}; type=League candidates:`);
    for (const row of rows) {
      if (row.league.type !== 'League') continue;
      const has2026 = row.seasons.some((s) => s.year === TARGET_SEASON);
      log(
        `  id=${row.league.id}  "${row.league.name}"  country=${row.country.name}  2026=${has2026 ? 'yes' : 'no'}`,
      );
    }

    const survivors = rows.filter(
      (row) =>
        row.league.type === 'League' &&
        row.country.name === t.country &&
        t.aliases.includes(row.league.name.toLowerCase()) &&
        row.seasons.some((s) => s.year === TARGET_SEASON),
    );

    if (survivors.length !== 1) {
      log(
        `STOP: expected exactly one survivor for ${t.label}, got ${survivors.length}. ` +
          'Refusing to guess — widen or narrow the aliases after reading the candidates above.',
      );
      process.exitCode = 2;
      return;
    }

    const it = survivors[0];
    const season = it.seasons.find((s) => s.year === TARGET_SEASON);
    resolved.push({
      label: t.label,
      leagueId: it.league.id,
      feedName: it.league.name,
      country: it.country.name,
      season2026Current: season?.current ?? false,
    });
  }

  const artifact = {
    manifest: {
      pulledAt: new Date().toISOString(),
      endpoint: '/leagues?search&country',
      calls: TARGETS.length,
      targetSeason: TARGET_SEASON,
      script: 'fetch/resolveExpansionLeagues.ts',
    },
    resolved,
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);

  log('\nRESOLVED:');
  for (const r of resolved) {
    log(`  ${r.label}: id=${r.leagueId} feedName="${r.feedName}" 2026 current=${r.season2026Current}`);
  }
  log(`artifact written: ${OUT_PATH}`);
}

await main();
