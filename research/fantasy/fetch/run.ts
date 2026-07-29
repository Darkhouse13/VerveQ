/**
 * FS-1 Phase 1 CLI.
 *
 *   npx tsx fetch/run.ts --dry-run            # print the plan, spend nothing (DEFAULT)
 *   npx tsx fetch/run.ts --live               # start the pull (fresh state)
 *   npx tsx fetch/run.ts --live --resume      # continue an interrupted pull
 *   npx tsx fetch/run.ts --live --resume --max-requests 40
 *
 * Dry-run is the default and `--live` is mandatory to reach the network: on a
 * 100/day cap, a mistyped flag that spends quota costs a calendar day, so the
 * safe mode is the one you get for free.
 *
 * Every STOP condition in the ticket exits non-zero with the reason on stdout
 * and the reason appended to the state file's notes. None of them is worked
 * around, and no missing stat is ever estimated.
 */

import {
  API_BASE_URL,
  LEAGUES,
  RAPIDAPI_BASE_URL,
  RAPIDAPI_HOST,
  REQUIRED_EVENT_FIELDS,
  REQUIRED_STATS,
  type LeagueSpec,
} from './config.ts';
import { describeKey, ENV_PATH, loadEnv } from './env.ts';
import {
  ApiFootballClient,
  BudgetExhaustedError,
  PlanRestrictionError,
  type ApiEnvelope,
} from './apiFootball.ts';
import {
  estimatePlan,
  regularSeasonRounds,
  renderPlan,
  roundLabel,
  seasonDiscoveryRequests,
  selectRoundNumbers,
} from './plan.ts';
import * as cache from './cache.ts';
import {
  addNote,
  createFreshState,
  effectiveCap,
  loadState,
  remainingToday,
  saveState,
  spentToday,
  STATE_PATH,
  utcDay,
  type FetchState,
} from './state.ts';

// ---------------------------------------------------------------- API shapes

interface SeasonCoverage {
  fixtures: {
    events: boolean;
    lineups: boolean;
    statistics_fixtures: boolean;
    statistics_players: boolean;
  };
}

interface LeagueSeason {
  year: number;
  start: string;
  end: string;
  current: boolean;
  coverage: SeasonCoverage;
}

interface LeagueEntry {
  league: { id: number; name: string };
  seasons: LeagueSeason[];
}

interface FixtureEntry {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: { name: string }; away: { name: string } };
}

interface PlayerEntry {
  player: { id: number; name: string };
  statistics: Record<string, unknown>[];
}

interface TeamPlayers {
  team: { id: number; name: string };
  players: PlayerEntry[];
}

interface EventEntry {
  time: { elapsed: number | null; extra: number | null };
  type: string;
  detail: string;
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
}

// ------------------------------------------------------------------- helpers

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

class StopCondition extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StopCondition';
  }
}

function stop(state: FetchState | null, reason: string): never {
  if (state !== null) {
    addNote(state, `STOP: ${reason}`);
    saveState(state);
  }
  throw new StopCondition(reason);
}

// ------------------------------------------------------------------- stage A

/**
 * A season qualifies if it is over and the free tier exposes per-player match
 * stats for it. `current: false` alone is not enough — a season can be flagged
 * non-current while its final rounds are unplayed — so the end date is checked
 * against today as well.
 */
function qualifyingSeasons(entry: LeagueEntry, today: Date, state: FetchState): number[] {
  const window = state.planSeasonWindow;
  return entry.seasons
    .filter((s) => {
      if (s.coverage?.fixtures?.statistics_players !== true) return false;
      // The coverage flag is necessary but not sufficient: the free tier
      // advertises statistics_players on seasons it will refuse to serve. Once
      // a refusal has told us the real window, it binds.
      if (window !== null && (s.year < window.min || s.year > window.max)) return false;
      const end = new Date(s.end);
      if (!Number.isFinite(end.getTime())) return false;
      return !s.current && end.getTime() < today.getTime();
    })
    .map((s) => s.year)
    .sort((a, b) => b - a);
}

/**
 * Runs `attempt` against successively older seasons, learning the plan's real
 * window from the first refusal. Costs one wasted request per refusal, which is
 * the cheapest way to discover a limit the metadata misreports.
 */
async function withPlanWindow<T>(
  state: FetchState,
  seasons: number[],
  attempt: (season: number) => Promise<T>,
): Promise<{ season: number; value: T }> {
  let candidates = [...seasons];
  const refused: number[] = [];

  while (candidates.length > 0) {
    const season = candidates[0];
    try {
      return { season, value: await attempt(season) };
    } catch (error) {
      if (!(error instanceof PlanRestrictionError)) throw error;

      refused.push(season);
      if (error.minSeason !== null && error.maxSeason !== null) {
        state.planSeasonWindow = { min: error.minSeason, max: error.maxSeason };
        addNote(
          state,
          `Plan tier serves seasons ${error.minSeason}-${error.maxSeason} only; /leagues coverage flags advertised more.`,
        );
        saveState(state);
        log(`    plan refuses season ${season}; provider states the window is ${error.minSeason}-${error.maxSeason}`);
        candidates = candidates.filter((y) => y >= error.minSeason! && y <= error.maxSeason!);
      } else {
        log(`    plan refuses season ${season} (no window given); trying the next-oldest`);
        candidates = candidates.slice(1);
      }
    }
  }

  stop(
    state,
    `TICKET STOP — the plan refused every completed season with per-player coverage (tried ${refused.join(', ')}). ${
      state.planSeasonWindow !== null
        ? `Provider window is ${state.planSeasonWindow.min}-${state.planSeasonWindow.max}.`
        : ''
    }`,
  );
}

async function stageA(
  client: ApiFootballClient,
  state: FetchState,
  today: Date,
): Promise<number[]> {
  log('\n== Stage A — season + coverage discovery ==');

  const perLeague = new Map<number, number[]>();

  for (const league of LEAGUES) {
    const file = cache.discoveryPath(`leagues-${league.id}`);
    let body: ApiEnvelope<LeagueEntry[]>;
    if (cache.has(file)) {
      body = cache.readJson<ApiEnvelope<LeagueEntry[]>>(file);
      log(`  ${league.name}: cached`);
    } else {
      body = await client.request<LeagueEntry[]>('/leagues', { id: league.id });
      cache.writeJson(file, body);
      log(`  ${league.name}: fetched`);
    }

    const entry = body.response?.[0];
    if (entry === undefined) {
      stop(state, `/leagues?id=${league.id} returned no league. Cannot determine a season for ${league.name}.`);
    }

    const qualifying = qualifyingSeasons(entry, today, state);
    perLeague.set(league.id, qualifying);
    log(
      qualifying.length === 0
        ? `    no completed season exposes per-player match stats on this key`
        : `    completed seasons with statistics_players: ${qualifying.join(', ')}`,
    );
  }

  // The sample must be one season across all five leagues, so intersect.
  let shared: number[] | null = null;
  for (const league of LEAGUES) {
    const years = perLeague.get(league.id) ?? [];
    shared = shared === null ? years : shared.filter((y) => years.includes(y));
  }
  const candidates = (shared ?? []).sort((a, b) => b - a);

  if (candidates.length === 0) {
    const detail = LEAGUES.map((l) => `${l.name}: [${(perLeague.get(l.id) ?? []).join(', ') || 'none'}]`).join('; ');
    stop(
      state,
      `TICKET STOP — the free tier exposes no single completed season with per-player match statistics across all five leagues. Per-league availability: ${detail}`,
    );
  }

  log(`\n  -> candidate seasons (newest first): ${candidates.join(', ')}`);
  log('     The plan tier, not these flags, decides which is actually readable; Stage B settles it.');
  return candidates;
}

// ------------------------------------------------------------------- stage B

async function fetchRounds(
  client: ApiFootballClient,
  leagueId: number,
  season: number,
): Promise<string[]> {
  const file = cache.discoveryPath(`rounds-${leagueId}-${season}`);
  if (cache.has(file)) {
    return cache.readJson<ApiEnvelope<string[]>>(file).response ?? [];
  }
  const body = await client.request<string[]>('/fixtures/rounds', { league: leagueId, season });
  cache.writeJson(file, body);
  return body.response ?? [];
}

async function stageB(
  client: ApiFootballClient,
  state: FetchState,
  candidates: number[],
): Promise<number> {
  log('\n== Stage B — season resolution + round discovery ==');
  state.selectedRounds = [];

  // The first real read of match data settles the season: whichever newest
  // candidate the plan actually serves.
  const resolved = await withPlanWindow(state, candidates, (season) =>
    fetchRounds(client, LEAGUES[0].id, season),
  );
  const season = resolved.season;
  for (const league of LEAGUES) state.season[String(league.id)] = season;
  saveState(state);
  log(`\n  -> season resolved: ${season} (newest completed season this plan will serve)`);

  for (const league of LEAGUES) {
    const raw =
      league.id === LEAGUES[0].id ? resolved.value : await fetchRounds(client, league.id, season);
    if (raw.length === 0) {
      stop(state, `/fixtures/rounds returned nothing for ${league.name} ${season}.`);
    }
    // Playoff/relegation rounds are not gameweeks; see regularSeasonRounds.
    const rounds = regularSeasonRounds(raw);
    if (rounds.length !== raw.length) {
      log(`  ${league.name}: dropped ${raw.length - rounds.length} non-gameweek round(s): ${raw.filter((r) => !rounds.includes(r)).join(', ')}`);
    }
    state.allRounds[String(league.id)] = rounds;

    const picked = selectRoundNumbers(rounds.length);
    picked.forEach((roundNumber, i) => {
      const name = rounds[roundNumber - 1];
      state.selectedRounds.push({ leagueId: league.id, round: name, label: roundLabel(i) });
    });
    log(`  ${league.name}: ${rounds.length} rounds; sampling ${picked.join(', ')} -> ${picked.map((n) => rounds[n - 1]).join(' | ')}`);
  }

  saveState(state);
  return season;
}

// ------------------------------------------------------------------- stage C

async function stageC(client: ApiFootballClient, state: FetchState, season: number): Promise<void> {
  log('\n== Stage C — fixture listings ==');

  for (const selection of state.selectedRounds) {
    const key = `${selection.leagueId}|${selection.round}`;
    if (state.fixturesByRound[key] !== undefined) continue;

    const safe = selection.round.replace(/[^a-z0-9]+/gi, '_');
    const file = cache.discoveryPath(`fixtures-${selection.leagueId}-${season}-${safe}`);
    let body: ApiEnvelope<FixtureEntry[]>;
    if (cache.has(file)) {
      body = cache.readJson<ApiEnvelope<FixtureEntry[]>>(file);
    } else {
      body = await client.request<FixtureEntry[]>('/fixtures', {
        league: selection.leagueId,
        season,
        round: selection.round,
      });
      cache.writeJson(file, body);
    }

    const fixtures = body.response ?? [];
    const unfinished = fixtures.filter((f) => !FINISHED_STATUSES.has(f.fixture.status.short));
    if (fixtures.length === 0) {
      stop(state, `No fixtures returned for league ${selection.leagueId} ${season} ${selection.round}.`);
    }
    if (unfinished.length > 0) {
      // The ticket asks for COMPLETE gameweeks. An incomplete one is reported,
      // not silently sampled around.
      stop(
        state,
        `TICKET STOP — round "${selection.round}" (league ${selection.leagueId}, ${season}) is not a complete gameweek: ${unfinished.length}/${fixtures.length} fixtures are not finished (statuses: ${[...new Set(unfinished.map((f) => f.fixture.status.short))].join(', ')}).`,
      );
    }

    state.fixturesByRound[key] = fixtures.map((f) => f.fixture.id);
    saveState(state);
    log(`  league ${selection.leagueId} ${selection.round} (${selection.label}): ${fixtures.length} fixtures`);
  }
}

// ------------------------------------------------------------------- stage D

async function stageD(client: ApiFootballClient, state: FetchState, maxRequests: number | null): Promise<boolean> {
  log('\n== Stage D — per-player match statistics ==');

  const leagueById = new Map<number, LeagueSpec>(LEAGUES.map((l) => [l.id, l]));
  const queue: { leagueId: number; fixtureId: number }[] = [];
  for (const selection of state.selectedRounds) {
    const ids = state.fixturesByRound[`${selection.leagueId}|${selection.round}`] ?? [];
    for (const fixtureId of ids) queue.push({ leagueId: selection.leagueId, fixtureId });
  }

  const fetched = new Set(state.fetchedFixtures);
  let done = 0;
  let spentHere = 0;

  for (const item of queue) {
    const file = cache.fixturePath(item.leagueId, item.fixtureId);
    if (cache.has(file)) {
      if (!fetched.has(item.fixtureId)) {
        fetched.add(item.fixtureId);
        state.fetchedFixtures = [...fetched].sort((a, b) => a - b);
      }
      done += 1;
      continue;
    }

    if (maxRequests !== null && spentHere >= maxRequests) {
      log(`\n  --max-requests ${maxRequests} reached; stopping cleanly.`);
      saveState(state);
      return false;
    }

    const body = await client.request<unknown>('/fixtures/players', { fixture: item.fixtureId });
    cache.writeJson(file, body);
    fetched.add(item.fixtureId);
    state.fetchedFixtures = [...fetched].sort((a, b) => a - b);
    saveState(state);
    spentHere += 1;
    done += 1;

    const name = leagueById.get(item.leagueId)?.name ?? String(item.leagueId);
    if (done % 10 === 0 || done === queue.length) {
      log(`  ${done}/${queue.length} fixtures on disk (last: ${name} #${item.fixtureId})`);
    }
  }

  log(`\n  Stage D complete: ${done}/${queue.length} fixtures on disk.`);
  return done === queue.length;
}

// ------------------------------------------------------------------- stage E

async function stageE(client: ApiFootballClient, state: FetchState, maxRequests: number | null): Promise<boolean> {
  log('\n== Stage E — timed match events (sub entry minutes, own goals) ==');

  const queue: { leagueId: number; fixtureId: number }[] = [];
  for (const selection of state.selectedRounds) {
    const ids = state.fixturesByRound[`${selection.leagueId}|${selection.round}`] ?? [];
    for (const fixtureId of ids) queue.push({ leagueId: selection.leagueId, fixtureId });
  }

  const fetched = new Set(state.fetchedEvents);
  let done = 0;
  let spentHere = 0;

  for (const item of queue) {
    const file = cache.eventsPath(item.leagueId, item.fixtureId);
    if (cache.has(file)) {
      if (!fetched.has(item.fixtureId)) {
        fetched.add(item.fixtureId);
        state.fetchedEvents = [...fetched].sort((a, b) => a - b);
      }
      done += 1;
      continue;
    }

    if (maxRequests !== null && spentHere >= maxRequests) {
      log(`\n  --max-requests ${maxRequests} reached; stopping cleanly.`);
      saveState(state);
      return false;
    }

    const body = await client.request<EventEntry[]>('/fixtures/events', { fixture: item.fixtureId });
    cache.writeJson(file, body);
    fetched.add(item.fixtureId);
    state.fetchedEvents = [...fetched].sort((a, b) => a - b);
    saveState(state);
    spentHere += 1;
    done += 1;

    if (done % 20 === 0 || done === queue.length) {
      log(`  ${done}/${queue.length} event feeds on disk`);
    }
  }

  log(`\n  Stage E complete: ${done}/${queue.length} event feeds on disk.`);
  return done === queue.length;
}

// ------------------------------------------------------------------- status

interface StatusResponse {
  account?: { firstname?: string; email?: string };
  subscription?: { plan?: string; end?: string; active?: boolean };
  requests?: { current?: number; limit_day?: number };
}

/**
 * Asks the provider what IT thinks we have spent today.
 *
 * `/status` is not metered on API-Sports, so this is the one diagnostic that
 * costs nothing. It exists because our local ledger and the provider's can
 * disagree — a refusal after a single request is otherwise indistinguishable
 * from a misclassified error — and when they disagree the provider is right.
 *
 * Deliberately bypasses the client's ledger for the same reason: metering an
 * unmetered call would introduce exactly the drift it is here to detect.
 */
async function fetchStatus(
  apiKey: string,
  authMode: 'apisports' | 'rapidapi',
): Promise<{ body: ApiEnvelope<StatusResponse>; headers: Record<string, string> }> {
  const base = authMode === 'rapidapi' ? RAPIDAPI_BASE_URL : API_BASE_URL;
  const headers: Record<string, string> =
    authMode === 'rapidapi'
      ? { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': RAPIDAPI_HOST }
      : { 'x-apisports-key': apiKey };

  const response = await fetch(`${base}/status`, { headers });
  const interesting: Record<string, string> = {};
  for (const name of [
    'x-ratelimit-requests-limit',
    'x-ratelimit-requests-remaining',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
  ]) {
    const value = response.headers.get(name);
    if (value !== null) interesting[name] = value;
  }
  return { body: (await response.json()) as ApiEnvelope<StatusResponse>, headers: interesting };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The refusal text from a /status body, or null if the account is healthy. */
function statusRefusal(body: ApiEnvelope<StatusResponse>): string | null {
  const errors = body.errors;
  if (errors === null || errors === undefined) return null;
  if (Array.isArray(errors)) return errors.length === 0 ? null : JSON.stringify(errors);
  if (typeof errors === 'string') return errors === '' ? null : errors;
  if (typeof errors === 'object') {
    const values = Object.values(errors as Record<string, unknown>);
    return values.length === 0 ? null : values.map(String).join('; ');
  }
  return null;
}

/**
 * Reconciles our ledger to the provider's own count. Returns what the provider
 * says is left today, or null if it did not say.
 *
 * The provider is authoritative and `/status` is unmetered, so there is no
 * reason to run a multi-day pull on a guess. This exists because day 2 fired 30
 * seconds after 00:00 UTC, raced the provider's daily rollover, and had its
 * first request refused against the previous day's counter — one refusal that
 * our code read as a spent day and a lost day of pulling.
 */
async function reconcileWithProvider(
  state: FetchState,
  apiKey: string,
  authMode: 'apisports' | 'rapidapi',
  now: Date,
): Promise<number | null> {
  const { body } = await fetchStatus(apiKey, authMode);

  // When the quota is spent, /status returns HTTP 200 with an empty response and
  // the refusal in `errors` — while `x-ratelimit-requests-remaining` still reads
  // 99. The header is not trustworthy in this state; the body is.
  const refusal = statusRefusal(body);
  if (refusal !== null) {
    log(`  provider: ${refusal}`);
    state.requestsByDay[utcDay(now)] = effectiveCap(state);
    saveState(state, now);
    return 0;
  }

  const current = body.response?.requests?.current;
  const limit = body.response?.requests?.limit_day;

  if (typeof limit === 'number' && limit > 0 && state.detectedDailyCap !== limit) {
    state.detectedDailyCap = limit;
  }
  if (typeof current !== 'number') return null;

  const ours = spentToday(state, now);
  if (current !== ours) {
    log(`  ledger reconciled: provider says ${current} spent today, ours said ${ours}`);
    state.requestsByDay[utcDay(now)] = current;
  }
  saveState(state, now);
  return Math.max(0, (limit ?? effectiveCap(state)) - current);
}

async function reportStatus(state: FetchState | null, apiKey: string, authMode: 'apisports' | 'rapidapi'): Promise<number> {
  log('\n== Provider account status (unmetered) ==');
  const { body, headers } = await fetchStatus(apiKey, authMode);

  const refusal = statusRefusal(body);
  if (refusal !== null) {
    log(`  REFUSED: ${refusal}`);
    log('  (the x-ratelimit-requests-remaining header is stale in this state — the body is authoritative)');
  }

  const sub = body.response?.subscription;
  const req = body.response?.requests;
  log(`  plan            : ${sub?.plan ?? 'unknown'}${sub?.active === false ? ' (INACTIVE)' : ''}`);
  log(`  subscription end: ${sub?.end ?? 'unknown'}`);
  log(`  requests today  : ${req?.current ?? '?'} / ${req?.limit_day ?? '?'}  <- the provider's own count`);
  for (const [name, value] of Object.entries(headers)) log(`  ${name}: ${value}`);

  if (state !== null) {
    const ours = spentToday(state, new Date());
    log(`\n  our ledger says : ${ours} spent today (UTC day ${utcDay()})`);
    if (typeof req?.current === 'number' && req.current !== ours) {
      log(`  DISAGREEMENT: provider ${req.current} vs ours ${ours}. The provider is authoritative.`);
    }
  }
  return 0;
}

// -------------------------------------------------------------------- probe

function leafPaths(value: unknown, prefix = ''): { path: string; value: unknown }[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [{ path: prefix, value }];
  }
  const out: { path: string; value: unknown }[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out.push(...leafPaths(child, prefix === '' ? key : `${prefix}.${key}`));
  }
  return out;
}

function getPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'ABSENT';
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

/**
 * The schema probe. Costs 5 requests, every one of them cached Stage A–C work
 * the full pull needs anyway, plus one fixture's players and events.
 *
 * It exists because the gaps reported in Phase 0 were read off the endpoint
 * schema from knowledge, and a STOP that expensive should rest on measurement.
 */
async function probe(client: ApiFootballClient, state: FetchState, today: Date): Promise<void> {
  const league = LEAGUES[0];
  log(`\n== SCHEMA PROBE — ${league.name} ==`);

  // A: season for this one league (the full Stage A intersects all five).
  const leaguesFile = cache.discoveryPath(`leagues-${league.id}`);
  let leaguesBody: ApiEnvelope<LeagueEntry[]>;
  if (cache.has(leaguesFile)) {
    leaguesBody = cache.readJson<ApiEnvelope<LeagueEntry[]>>(leaguesFile);
  } else {
    leaguesBody = await client.request<LeagueEntry[]>('/leagues', { id: league.id });
    cache.writeJson(leaguesFile, leaguesBody);
  }
  const entry = leaguesBody.response?.[0];
  if (entry === undefined) stop(state, `/leagues?id=${league.id} returned no league.`);

  const qualifying = qualifyingSeasons(entry, today, state);
  log(`  completed seasons whose coverage flags claim statistics_players: ${qualifying.join(', ') || 'NONE'}`);
  if (qualifying.length === 0) {
    stop(
      state,
      `TICKET STOP — no completed season of ${league.name} exposes per-player match statistics on this key.`,
    );
  }

  // B: rounds — and, in the process, the newest season the plan will serve.
  const resolved = await withPlanWindow(state, qualifying, (candidate) =>
    fetchRounds(client, league.id, candidate),
  );
  const season = resolved.season;
  const rounds = resolved.value;
  log(`  season resolved: ${season}`);
  if (rounds.length === 0) stop(state, `No rounds for ${league.name} ${season}.`);
  const roundNumber = selectRoundNumbers(rounds.length)[0];
  const round = rounds[roundNumber - 1];
  log(`  ${rounds.length} rounds; probing round ${roundNumber} ("${round}")`);

  // C: fixtures in that round.
  const safe = round.replace(/[^a-z0-9]+/gi, '_');
  const fixturesFile = cache.discoveryPath(`fixtures-${league.id}-${season}-${safe}`);
  let fixturesBody: ApiEnvelope<FixtureEntry[]>;
  if (cache.has(fixturesFile)) {
    fixturesBody = cache.readJson<ApiEnvelope<FixtureEntry[]>>(fixturesFile);
  } else {
    fixturesBody = await client.request<FixtureEntry[]>('/fixtures', {
      league: league.id,
      season,
      round,
    });
    cache.writeJson(fixturesFile, fixturesBody);
  }
  const fixtures = fixturesBody.response ?? [];
  if (fixtures.length === 0) stop(state, `No fixtures for ${league.name} ${season} "${round}".`);
  const sample = fixtures[0];
  log(`  ${fixtures.length} fixtures; probing #${sample.fixture.id} — ${sample.teams.home.name} v ${sample.teams.away.name} (${sample.fixture.status.short})`);

  // D + E on that one fixture.
  const playersFile = cache.fixturePath(league.id, sample.fixture.id);
  let playersBody: ApiEnvelope<TeamPlayers[]>;
  if (cache.has(playersFile)) {
    playersBody = cache.readJson<ApiEnvelope<TeamPlayers[]>>(playersFile);
  } else {
    playersBody = await client.request<TeamPlayers[]>('/fixtures/players', { fixture: sample.fixture.id });
    cache.writeJson(playersFile, playersBody);
  }

  const eventsFile = cache.eventsPath(league.id, sample.fixture.id);
  let eventsBody: ApiEnvelope<EventEntry[]>;
  if (cache.has(eventsFile)) {
    eventsBody = cache.readJson<ApiEnvelope<EventEntry[]>>(eventsFile);
  } else {
    eventsBody = await client.request<EventEntry[]>('/fixtures/events', { fixture: sample.fixture.id });
    cache.writeJson(eventsFile, eventsBody);
  }

  // ---- measured field set
  const allPlayers = (playersBody.response ?? []).flatMap((t) => t.players ?? []);
  log(`\n  ${playersBody.response?.length ?? 0} teams, ${allPlayers.length} player rows.`);

  const first = allPlayers[0];
  if (first === undefined) stop(state, `fixtures/players returned no player rows for #${sample.fixture.id}.`);

  log('\n### Measured field set — statistics[0], first player row');
  log('');
  for (const { path, value } of leafPaths(first.statistics?.[0] ?? {})) {
    log(`  ${path.padEnd(28)} = ${describeValue(value)}`);
  }

  log('\n### REQUIRED_STATS coverage across this ONE fixture');
  log(`  (n = ${allPlayers.length} player rows — indicative only; the real coverage pass runs over the full sample)`);
  log('');
  for (const stat of REQUIRED_STATS) {
    if (stat.path === null) {
      log(`  ${stat.specName.padEnd(26)} not on this endpoint (Stage E supplies it)`);
      continue;
    }
    let present = 0;
    let absent = 0;
    for (const player of allPlayers) {
      const value = getPath(player.statistics?.[0] ?? {}, stat.path);
      if (value === undefined || value === null) absent += 1;
      else present += 1;
    }
    const rate = allPlayers.length === 0 ? 0 : (present / allPlayers.length) * 100;
    const flag = rate < 90 ? '  <-- >10% missing' : '';
    log(`  ${stat.specName.padEnd(26)} ${stat.path.padEnd(24)} ${rate.toFixed(1)}% present (${absent} null/absent)${flag}`);
  }

  const accuracies = allPlayers
    .map((p) => getPath(p.statistics?.[0] ?? {}, 'passes.accuracy'))
    .filter((v): v is number | string => v !== null && v !== undefined);
  log('\n### passes.accuracy units');
  log(`  observed values: ${accuracies.slice(0, 12).map(describeValue).join(', ')}${accuracies.length > 12 ? ' ...' : ''}`);
  const numeric = accuracies.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (numeric.length > 0) {
    log(`  min ${Math.min(...numeric)}, max ${Math.max(...numeric)} — >100 anywhere means it is an accurate-pass COUNT, not a percentage.`);
  }

  const events = eventsBody.response ?? [];
  log(`\n### fixtures/events — ${events.length} events`);
  const firstEvent = events[0];
  if (firstEvent !== undefined) {
    log('');
    for (const { path, value } of leafPaths(firstEvent)) {
      log(`  ${path.padEnd(28)} = ${describeValue(value)}`);
    }
  }
  log('');
  for (const field of REQUIRED_EVENT_FIELDS) {
    if (field.path === null) continue;
    const present = events.filter((e) => getPath(e, field.path!) !== undefined).length;
    log(`  ${field.specName.padEnd(30)} present on ${present}/${events.length} events`);
  }
  const types = [...new Set(events.map((e) => `${e.type}/${e.detail}`))].sort();
  log(`\n  distinct type/detail seen: ${types.join(', ')}`);
  const subs = events.filter((e) => e.type?.toLowerCase() === 'subst');
  log(`  substitutions: ${subs.length}${subs.length > 0 ? ` (first at minute ${describeValue(subs[0].time?.elapsed)})` : ''}`);
  const owns = events.filter((e) => e.detail?.toLowerCase().includes('own goal'));
  log(`  own goals in this fixture: ${owns.length}`);

  addNote(state, `Schema probe run on ${league.name} ${season} fixture ${sample.fixture.id}.`);
  saveState(state);
}

// ---------------------------------------------------------------------- main

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const probeOnly = argv.includes('--probe');
  const statusOnly = argv.includes('--status');
  const live = argv.includes('--live') || probeOnly;
  const dryRun = !live && !statusOnly;
  const resume = argv.includes('--resume');
  const maxIdx = argv.indexOf('--max-requests');
  const maxRequests = maxIdx === -1 ? null : Number.parseInt(argv[maxIdx + 1] ?? '', 10);
  if (maxIdx !== -1 && !Number.isFinite(maxRequests)) {
    log('--max-requests needs an integer.');
    return 2;
  }

  const today = new Date();

  log('# FS-1 Phase 1 — API-Football sample pull');
  log('');
  log(`Mode: ${dryRun ? 'DRY RUN (no network; pass --live to pull)' : probeOnly ? 'LIVE — SCHEMA PROBE ONLY (5 requests max)' : 'LIVE'}`);
  log(`Resume: ${resume}`);
  log(`State file: ${STATE_PATH}`);

  const env = loadEnv();
  if (env === null) {
    log('');
    log(`TICKET STOP — API_FOOTBALL_KEY is not set in the environment and not present in ${ENV_PATH}.`);
    return 1;
  }
  log(`Key: loaded (${describeKey(env.apiKey)}), auth mode "${env.authMode}"`);

  if (statusOnly) {
    return reportStatus(loadState(), env.apiKey, env.authMode);
  }

  if (dryRun) {
    const known = loadState();
    const estimate = estimatePlan(
      known?.detectedDailyCap != null ? { dailyCap: known.detectedDailyCap } : {},
    );
    log('');
    log(renderPlan(estimate));
    log('');
    log('## Stage A calls (the only ones nameable before discovery runs)');
    log('');
    for (const req of seasonDiscoveryRequests()) {
      const qs = new URLSearchParams(
        Object.entries(req.params).map(([k, v]): [string, string] => [k, String(v)]),
      ).toString();
      log(`  GET ${req.endpoint}?${qs}`);
      log(`      ${req.purpose}`);
    }
    log('');
    log('Stages B/C/D depend on what A and B return: the season, each league\'s round');
    log('count, and the fixture ids in the sampled rounds. Their call counts are the');
    log('estimates in the table above and are re-derived from real values as they land.');
    log('');
    log('No network calls were made. Re-run with --live to start the pull.');
    return 0;
  }

  let state = resume ? loadState() : null;
  if (state === null) {
    if (resume) log('\nNo resumable state found; starting fresh.');
    state = createFreshState(today);

    // Carry the spend ledger and everything else we have MEASURED across a
    // fresh start. Progress can be safely discarded — the cache makes redoing
    // it free — but the day's quota cannot: zeroing it would let a second run
    // spend a second 100 requests against a cap that has not reset.
    const previous = loadState();
    if (previous !== null) {
      state.requestsByDay = previous.requestsByDay;
      state.detectedDailyCap = previous.detectedDailyCap;
      state.planSeasonWindow = previous.planSeasonWindow;
      state.notes = previous.notes;
      log(`Carried forward spend ledger: ${spentToday(state, today)} requests already spent today.`);
    }
    saveState(state, today);
  } else {
    log(`Resumed (started ${state.startedAt}, ${state.fetchedFixtures.length} fixtures already on disk)`);
  }

  log(
    `Budget today: ${spentToday(state, today)}/${effectiveCap(state)} spent, ${remainingToday(state, today)} remaining` +
      `${state.detectedDailyCap === null ? ' (cap assumed free-tier until the first response header)' : ' (cap measured)'}.`,
  );

  const client = new ApiFootballClient({
    apiKey: env.apiKey,
    authMode: env.authMode,
    state,
    dryRun: false,
    log,
  });

  try {
    if (probeOnly) {
      await probe(client, state, today);
      log('');
      log(`Requests spent today: ${spentToday(state, today)}/${effectiveCap(state)}.`);
      if (client.serverDailyLimit !== null) {
        log(`Provider plan cap: ${client.serverDailyLimit}/day (measured from response headers).`);
      }
      if (client.serverDailyRemaining !== null) {
        log(`Provider reports ${client.serverDailyRemaining} remaining on the key today.`);
      }
      log('Probe only — no full pull was started. Everything fetched is cached and counts toward it.');
      return 0;
    }

    log('\n== Reconciling ledger with provider (unmetered) ==');
    await reconcileWithProvider(state, env.apiKey, env.authMode, today);
    log(`  ${remainingToday(state, today)} requests available today.`);

    const runStages = async (): Promise<boolean> => {
      const known = state.season[String(LEAGUES[0].id)];
      const season =
        known ?? (await stageB(client, state, await stageA(client, state, today)));
      if (state.selectedRounds.length === 0) await stageB(client, state, [season]);
      await stageC(client, state, season);
      const statsComplete = await stageD(client, state, maxRequests);
      return statsComplete ? await stageE(client, state, maxRequests) : false;
    };

    // A refusal from the provider is not automatically a spent day: it can also
    // be a rollover race. Ask the unmetered endpoint who is right, and only give
    // up when the provider itself says there is nothing left.
    let complete = false;
    for (let attempt = 1; ; attempt += 1) {
      try {
        complete = await runStages();
        break;
      } catch (error) {
        if (!(error instanceof BudgetExhaustedError) || error.providerMessage === undefined) throw error;
        log(`\n  provider refused: ${error.providerMessage}`);
        const remaining = await reconcileWithProvider(state, env.apiKey, env.authMode, new Date());
        if (remaining === null || remaining <= 0) {
          log('  provider confirms the daily quota is spent.');
          throw error;
        }
        if (attempt >= 3) {
          log(`  provider still reports ${remaining} remaining after ${attempt} attempts; stopping to avoid a hot loop.`);
          throw error;
        }
        log(`  provider reports ${remaining} remaining — treating this as a rollover race; retrying in 60s.`);
        await sleep(60_000);
      }
    }

    log('');
    log(`Requests spent today: ${spentToday(state, today)}/${effectiveCap(state)}.`);
    if (client.serverDailyRemaining !== null) {
      log(`Provider reports ${client.serverDailyRemaining} remaining on the key today.`);
    }
    log(
      complete
        ? 'Sample complete. Next: Phase 1 coverage pass over data/fixtures/ and data/events/.'
        : 'Sample incomplete. Re-run `--live --resume` (tomorrow if the cap is spent); cached fixtures are never re-requested.',
    );
    return 0;
  } catch (error) {
    if (error instanceof BudgetExhaustedError) {
      log('');
      log(`Daily cap reached: ${spentToday(state, today)}/${effectiveCap(state)} requests spent.`);
      log('Everything fetched so far is on disk. Re-run `--live --resume` after 00:00 UTC.');
      return 0;
    }
    if (error instanceof StopCondition) {
      log('');
      log(`STOP: ${error.message}`);
      log('Reported, not worked around. No data was estimated or backfilled.');
      return 3;
    }
    throw error;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    log(`\nFATAL: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exitCode = 1;
  },
);
