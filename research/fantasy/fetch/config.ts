/**
 * FS-1 Phase 1 — what the sample is.
 *
 * Data, not behaviour. The plan printed by `--dry-run` is a pure function of
 * this file plus whatever the discovery calls return, so a reviewer can audit
 * the request budget without running anything.
 */

export const API_BASE_URL = 'https://v3.football.api-sports.io';
export const RAPIDAPI_HOST = 'api-football-v1.p.rapidapi.com';
export const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}/v3`;

export interface LeagueSpec {
  readonly id: number;
  readonly name: string;
  readonly country: string;
  /**
   * Teams in a typical recent season. Used ONLY to estimate the request budget
   * before discovery has run. The real fixture count comes from the fixture
   * listing and overrides this everywhere it actually matters.
   */
  readonly typicalTeams: number;
}

/** Top-5 leagues, API-Football v3 league ids. */
export const LEAGUES: readonly LeagueSpec[] = [
  { id: 39, name: 'Premier League', country: 'England', typicalTeams: 20 },
  { id: 140, name: 'La Liga', country: 'Spain', typicalTeams: 20 },
  { id: 135, name: 'Serie A', country: 'Italy', typicalTeams: 20 },
  { id: 78, name: 'Bundesliga', country: 'Germany', typicalTeams: 18 },
  { id: 61, name: 'Ligue 1', country: 'France', typicalTeams: 18 },
] as const;

/**
 * FW-EXPAND (2026-08-02 ruling) — the three expansion leagues, each priced as
 * its own cohort. Ids resolved from the feed 2026-08-12 by
 * fetch/resolveExpansionLeagues.ts (artifact: data/expansion-leagues-2026.json).
 * Deliberately NOT merged into LEAGUES above: the FS-1 sample and the top-five
 * pricing pull are scoped to that list, and widening it would silently change
 * their request budgets.
 */
export const EXPANSION_LEAGUES: readonly LeagueSpec[] = [
  { id: 88, name: 'Eredivisie', country: 'Netherlands', typicalTeams: 18 },
  { id: 94, name: 'Primeira Liga', country: 'Portugal', typicalTeams: 18 },
  { id: 40, name: 'Championship', country: 'England', typicalTeams: 24 },
] as const;

/**
 * Where in the season the four sampled gameweeks sit, as fractions of the
 * league's own round count. Fractions rather than fixed round numbers because
 * Bundesliga plays 34 rounds and the rest play 38 — fixed numbers would bunch
 * the German sample toward the end of its season.
 *
 * 38 rounds -> 5, 15, 25, 35.   34 rounds -> 4, 13, 22, 31.
 */
export const GAMEWEEK_FRACTIONS = [0.13, 0.39, 0.66, 0.92] as const;
export const GAMEWEEK_LABELS = ['early', 'mid', 'late', 'final stretch'] as const;

/**
 * Assumed daily cap until the provider tells us otherwise. Quota resets at
 * 00:00 UTC. The real value arrives in the `x-ratelimit-requests-limit` header
 * on the first response and is persisted to state, so the plan re-costs itself
 * against the actual plan tier rather than against this guess.
 */
export const FREE_TIER_DAILY_CAP = 100;
export const PRO_TIER_DAILY_CAP = 7_500;

/**
 * Burst spacing. The free tier allows 10 requests/minute, so 6.5s keeps us
 * under it with margin. Pro is faster; `paceFor` drops the spacing accordingly
 * rather than making a one-day pull take eleven hours.
 *
 * MEASURED 2026-07-29 on the Pro key: `x-ratelimit-limit` is **300/minute**,
 * not the 450 this comment previously assumed. 200ms is exactly 300/minute —
 * i.e. precisely at the limit, where any clock jitter earns a 429. 250ms is
 * 240/minute, which keeps a 20% cushion and costs nothing at this volume
 * (the whole remaining sample is ~600 requests, under three minutes either way).
 */
export const FREE_TIER_RATE_LIMIT_MS = 6_500;
export const PRO_TIER_RATE_LIMIT_MS = 250;

export function paceFor(dailyCap: number): number {
  return dailyCap > FREE_TIER_DAILY_CAP ? PRO_TIER_RATE_LIMIT_MS : FREE_TIER_RATE_LIMIT_MS;
}

/** Retries on 429 / 5xx only. Never on a populated `errors` body. */
export const MAX_RETRIES = 3;
export const RETRY_BACKOFF_MS = 15_000;

/**
 * Every stat SCORING_SPEC.md §Design principles item 3 promises the feed
 * provides, mapped to its path inside a `fixtures/players` player statistics
 * object. `path: null` means the endpoint does not carry it at all — those are
 * reported as coverage gaps, never proxied or estimated (ticket HARD RULES).
 *
 * This table is the checklist the Phase 1 coverage pass runs against. It is
 * deliberately declared before the pull so the >10%-missing STOP condition is
 * evaluated against a fixed list rather than whatever the data happened to
 * contain.
 */
export interface RequiredStat {
  /** The name as written in the spec. */
  readonly specName: string;
  /** Dot path within a player's `statistics[0]` object, or null if absent. */
  readonly path: string | null;
  /** Populated when the endpoint cannot supply the stat as specified. */
  readonly note?: string;
}

export const REQUIRED_STATS: readonly RequiredStat[] = [
  { specName: 'minutes', path: 'games.minutes' },
  { specName: 'goals', path: 'goals.total' },
  { specName: 'assists', path: 'goals.assists' },
  { specName: 'shots (total)', path: 'shots.total' },
  { specName: 'shots on target', path: 'shots.on' },
  { specName: 'key passes', path: 'passes.key' },
  {
    specName: 'pass accuracy',
    path: 'passes.accuracy',
    note: 'MEASURED (probe, fixture 1208070): this is a COUNT of accurate passes, not a percentage — accuracy <= passes.total in 40/40 rows and accuracy/total lands in 76-95%. The MID ">=88% with >=40 passes" threshold therefore needs accuracy/total normalisation, which is a scoring/ concern for v0.3, not a fetch/ one.',
  },
  { specName: 'dribbles completed', path: 'dribbles.success' },
  {
    specName: 'tackles won',
    path: 'tackles.total',
    note: 'CONFIRMED GAP (probe): the tackles object is {total, blocks, interceptions}. There is no won/lost split at any tier. The spec prices "tackle won"; the feed can only supply tackles attempted. Never proxied — awaiting SCORING_SPEC v0.3.',
  },
  { specName: 'interceptions', path: 'tackles.interceptions' },
  {
    specName: 'clearances/blocks',
    path: 'tackles.blocks',
    note: 'CONFIRMED GAP (probe): blocks only. There is no clearances field anywhere in the player statistics object. The spec prices "clearance/block" as one bucket; the feed supplies half of it. Never proxied — awaiting SCORING_SPEC v0.3.',
  },
  { specName: 'duels won', path: 'duels.won' },
  { specName: 'duels contested', path: 'duels.total' },
  { specName: 'fouls committed', path: 'fouls.committed' },
  { specName: 'fouls drawn', path: 'fouls.drawn' },
  { specName: 'yellow cards', path: 'cards.yellow' },
  {
    specName: 'red cards',
    path: 'cards.red',
    note: 'No second-yellow vs straight-red split. Harmless: the spec prices both at -4.',
  },
  { specName: 'saves', path: 'goals.saves' },
  { specName: 'goals conceded', path: 'goals.conceded' },
  { specName: 'penalties saved', path: 'penalty.saved' },
  { specName: 'penalties missed', path: 'penalty.missed' },
  { specName: 'penalties won', path: 'penalty.won' },
  { specName: 'penalties conceded', path: 'penalty.commited' },
  {
    specName: 'own goals',
    path: null,
    note: 'Not carried by fixtures/players; sourced from fixtures/events (type "Goal", detail "Own Goal"). Stage E covers it.',
  },
  {
    specName: 'substitute entry minute',
    path: null,
    note: 'Not carried by fixtures/players (games.substitute is a boolean, games.minutes a total). Sourced from fixtures/events (type "subst"). Required by SCORING_SPEC §Finishers and the post-75′ x1.25 multiplier. Stage E covers it.',
  },
];

/**
 * Event fields Stage E must supply, for the same reason REQUIRED_STATS exists:
 * the checklist is fixed before the pull so coverage is measured against a
 * declared list rather than against whatever happened to arrive.
 */
export const REQUIRED_EVENT_FIELDS: readonly RequiredStat[] = [
  { specName: 'event minute', path: 'time.elapsed' },
  { specName: 'event stoppage minute', path: 'time.extra' },
  { specName: 'event type', path: 'type' },
  { specName: 'event detail', path: 'detail' },
  {
    specName: 'event player',
    path: 'player.id',
    note: 'On a subst event this is the player going OFF, NOT the one coming on. Measured: in 10/10 substitutions the `player` row had substitute=false and minutes exactly equal to time.elapsed.',
  },
  {
    specName: 'event assist / sub-in player',
    path: 'assist.id',
    note: 'On a subst event this is the player coming ON, and time.elapsed is their entry minute. Measured: in 10/10 substitutions the `assist` row had substitute=true and minutes = (90 - time.elapsed) + stoppage. This is the field SCORING_SPEC §Finishers depends on; reading it as the outgoing player would silently invert every finisher score.',
  },
];
