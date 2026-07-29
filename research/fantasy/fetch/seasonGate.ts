/**
 * FW-2-RUN objective 1 — the season gate.
 *
 * Asks the provider two questions and reports exactly what it said:
 *   1. `/status` (unmetered) — what plan is this key on, and what is the real
 *      daily cap? The free-tier 100/day in `data/.fetch-state.json` was measured
 *      on 2026-07-27; if the account has been upgraded this is where it shows.
 *   2. `/fixtures?league=39&season=2026` — does the plan serve the season the
 *      whole ticket depends on?
 *
 * Question 2 is the hard stop. A refusal is captured verbatim, not paraphrased
 * and not worked around, because every other objective is downstream of it.
 *
 * Lives in fetch/ because fetch/ is the only directory permitted to touch the
 * network (README §The network rule). Metered against the same ledger as the
 * pull so the day's spend stays honest.
 */

import { loadEnv, describeKey } from './env.ts';
import { API_BASE_URL, RAPIDAPI_BASE_URL, RAPIDAPI_HOST } from './config.ts';
import {
  createFreshState,
  loadState,
  recordRequest,
  saveState,
  spentToday,
  utcDay,
} from './state.ts';

const env = loadEnv();
if (env === null) {
  console.error('No API_FOOTBALL_KEY. Nothing to probe.');
  process.exit(2);
}

const state = loadState() ?? createFreshState();

const baseUrl = env.authMode === 'rapidapi' ? RAPIDAPI_BASE_URL : API_BASE_URL;
const headers: Record<string, string> =
  env.authMode === 'rapidapi'
    ? { 'x-rapidapi-key': env.apiKey, 'x-rapidapi-host': RAPIDAPI_HOST }
    : { 'x-apisports-key': env.apiKey };

/** Every rate-limit header the provider sends, so the real window is measured rather than assumed. */
function rateLimitHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    if (key.toLowerCase().includes('ratelimit') || key.toLowerCase() === 'date') out[key] = value;
  });
  return out;
}

async function get(endpoint: string, params: Record<string, string | number>, metered: boolean) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) search.set(k, String(v));
  const qs = search.toString();
  const url = `${baseUrl}${endpoint}${qs === '' ? '' : `?${qs}`}`;

  if (metered) {
    recordRequest(state);
    saveState(state);
  }

  const res = await fetch(url, { headers });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, headers: rateLimitHeaders(res), body };
}

console.log('# FW-2-RUN objective 1 — season gate');
console.log('');
console.log(`Key: ${describeKey(env.apiKey)}, auth mode "${env.authMode}"`);
console.log(`Local ledger: ${spentToday(state)} spent in window ${utcDay()}.`);
console.log(`Local detectedDailyCap: ${state.detectedDailyCap ?? '(none yet)'}`);
console.log(`Local planSeasonWindow: ${JSON.stringify(state.planSeasonWindow)}`);
console.log('');

console.log('== /status (unmetered) ==');
const status = await get('/status', {}, false);
console.log(`HTTP ${status.status}`);
console.log(`headers: ${JSON.stringify(status.headers, null, 2)}`);
console.log(`body: ${JSON.stringify(status.body, null, 2)}`);
console.log('');

console.log('== /fixtures?league=39&season=2026 (metered) — THE GATE ==');
const gate = await get('/fixtures', { league: 39, season: 2026 }, true);
console.log(`HTTP ${gate.status}`);
console.log(`headers: ${JSON.stringify(gate.headers, null, 2)}`);

const envelope = gate.body as {
  errors?: unknown;
  results?: number;
  paging?: { current: number; total: number };
  response?: unknown[];
};

const errors = envelope?.errors;
const hasErrors =
  errors !== null &&
  errors !== undefined &&
  (Array.isArray(errors) ? errors.length > 0 : Object.keys(errors as object).length > 0);

if (hasErrors) {
  console.log('');
  console.log('REFUSED. Verbatim errors body:');
  console.log(JSON.stringify(errors, null, 2));
  console.log('');
  console.log('Full envelope (minus response):');
  console.log(JSON.stringify({ ...envelope, response: '(omitted)' }, null, 2));
  process.exit(1);
}

console.log(`results: ${envelope?.results}`);
console.log(`paging: ${JSON.stringify(envelope?.paging)}`);
const rows = (envelope?.response ?? []) as Array<Record<string, any>>;
console.log(`response rows: ${rows.length}`);
if (rows.length > 0) {
  const first = rows[0];
  console.log('');
  console.log('First fixture (shape check):');
  console.log(
    JSON.stringify(
      {
        fixtureId: first.fixture?.id,
        date: first.fixture?.date,
        timestamp: first.fixture?.timestamp,
        timezone: first.fixture?.timezone,
        statusShort: first.fixture?.status?.short,
        statusLong: first.fixture?.status?.long,
        league: { id: first.league?.id, season: first.league?.season, round: first.league?.round },
        home: { id: first.teams?.home?.id, name: first.teams?.home?.name },
        away: { id: first.teams?.away?.id, name: first.teams?.away?.name },
      },
      null,
      2,
    ),
  );

  const rounds = new Set(rows.map((r) => r.league?.round).filter(Boolean));
  const statuses = new Map<string, number>();
  for (const r of rows) {
    const s = String(r.fixture?.status?.short ?? '?');
    statuses.set(s, (statuses.get(s) ?? 0) + 1);
  }
  const dates = rows.map((r) => r.fixture?.date).filter(Boolean).sort();
  console.log('');
  console.log(`distinct rounds: ${rounds.size}`);
  console.log(`status histogram: ${JSON.stringify(Object.fromEntries(statuses))}`);
  console.log(`date range: ${dates[0]} .. ${dates[dates.length - 1]}`);
}

console.log('');
console.log('GATE OPEN: season 2026 serves league 39.');
