/**
 * The request plan — pure. No network, no filesystem.
 *
 * Given the league table in config.ts (and, once discovery has run, the real
 * round and fixture counts), this produces the exact list of calls the pull
 * will make and how they divide across the 100/day free-tier cap. `--dry-run`
 * prints this and stops, so the budget is auditable before any quota is spent.
 */

import {
  FREE_TIER_DAILY_CAP,
  GAMEWEEK_FRACTIONS,
  GAMEWEEK_LABELS,
  LEAGUES,
  REQUIRED_STATS,
  type LeagueSpec,
} from './config.ts';

export type Stage = 'A-season' | 'B-rounds' | 'C-fixtures' | 'D-playerstats' | 'E-events';

export interface PlannedRequest {
  readonly stage: Stage;
  readonly endpoint: string;
  readonly params: Record<string, string | number>;
  readonly purpose: string;
}

export interface LeaguePlan {
  readonly league: LeagueSpec;
  /** Fixtures per round: teams / 2. Estimated until the listing confirms it. */
  readonly fixturesPerRound: number;
  readonly gameweeks: number;
  readonly playerStatRequests: number;
}

export interface PlanEstimate {
  readonly leagues: readonly LeaguePlan[];
  readonly seasonRequests: number;
  readonly roundRequests: number;
  readonly fixtureListRequests: number;
  readonly playerStatRequests: number;
  readonly eventRequests: number;
  readonly total: number;
  readonly dailyCap: number;
  readonly capIsMeasured: boolean;
  readonly days: readonly DayBudget[];
  readonly estimated: boolean;
}

export interface DayBudget {
  readonly day: number;
  readonly requests: number;
  readonly cumulative: number;
  readonly covers: string;
}

export const GAMEWEEKS_PER_LEAGUE = GAMEWEEK_FRACTIONS.length;

/**
 * Which rounds to sample, as 1-based round numbers, given how many rounds the
 * league actually plays. Deterministic: same round count in, same rounds out.
 *
 * Guarantees distinctness by pushing collisions forward — matters only for
 * hypothetical short competitions, but a silent duplicate would quietly halve
 * a league's sample.
 */
export function selectRoundNumbers(totalRounds: number): number[] {
  const chosen: number[] = [];
  for (const fraction of GAMEWEEK_FRACTIONS) {
    let candidate = Math.min(Math.max(Math.round(fraction * totalRounds), 1), totalRounds);
    while (chosen.includes(candidate) && candidate < totalRounds) candidate += 1;
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }
  return chosen;
}

export function roundLabel(index: number): string {
  return GAMEWEEK_LABELS[index] ?? `gw${index + 1}`;
}

/**
 * Drops non-gameweek rounds from a league's round list.
 *
 * Measured 2026-07-27: Bundesliga and Ligue 1 2024 both report 35 rounds —
 * "Regular Season - 1".."Regular Season - 34" plus a trailing "Relegation
 * Round", which is a two-leg playoff, not a gameweek. Sampling it would hand
 * the harness a 2-fixture "gameweek", and Stage C's completeness check would
 * not catch it because those fixtures are legitimately FT.
 *
 * Falls back to the full list if no round matches, so a league that names its
 * rounds differently degrades to the old behaviour rather than to an empty set.
 */
export function regularSeasonRounds(rounds: readonly string[]): string[] {
  const regular = rounds.filter((r) => /^regular season/i.test(r));
  return regular.length > 0 ? regular : [...rounds];
}

function splitAcrossDays(
  total: number,
  cap: number,
  stageBoundaries: { label: string; upTo: number }[],
): DayBudget[] {
  const days: DayBudget[] = [];
  let done = 0;
  let day = 1;
  while (done < total) {
    const requests = Math.min(cap, total - done);
    const from = done + 1;
    const to = done + requests;
    const covers = stageBoundaries
      .filter((b, i) => {
        const start = i === 0 ? 1 : stageBoundaries[i - 1].upTo + 1;
        return start <= to && b.upTo >= from;
      })
      .map((b) => b.label)
      .join(', ');
    days.push({ day, requests, cumulative: to, covers });
    done = to;
    day += 1;
  }
  return days;
}

/**
 * The pre-discovery estimate. Fixture counts come from `typicalTeams`, so the
 * only way this is wrong is if a league changed size in the sampled season —
 * which shifts the total by a handful of requests, not by a day.
 */
export interface EstimateOptions {
  readonly leagues?: readonly LeagueSpec[];
  /** Real fixtures-per-round, once Stage C has measured it. */
  readonly fixturesPerRound?: Record<number, number>;
  /** The account's measured daily cap. Omit to assume free tier. */
  readonly dailyCap?: number;
}

export function estimatePlan(options: EstimateOptions = {}): PlanEstimate {
  const leagues = options.leagues ?? LEAGUES;
  const fixturesPerRoundOverride = options.fixturesPerRound;
  const dailyCap = options.dailyCap ?? FREE_TIER_DAILY_CAP;

  const leaguePlans: LeaguePlan[] = leagues.map((league) => {
    const fixturesPerRound =
      fixturesPerRoundOverride?.[league.id] ?? Math.floor(league.typicalTeams / 2);
    return {
      league,
      fixturesPerRound,
      gameweeks: GAMEWEEKS_PER_LEAGUE,
      playerStatRequests: fixturesPerRound * GAMEWEEKS_PER_LEAGUE,
    };
  });

  const seasonRequests = leagues.length;
  const roundRequests = leagues.length;
  const fixtureListRequests = leagues.length * GAMEWEEKS_PER_LEAGUE;
  const playerStatRequests = leaguePlans.reduce((sum, p) => sum + p.playerStatRequests, 0);
  // One events call per fixture, same denominator as player stats.
  const eventRequests = playerStatRequests;
  const total =
    seasonRequests + roundRequests + fixtureListRequests + playerStatRequests + eventRequests;

  const afterC = seasonRequests + roundRequests + fixtureListRequests;
  const boundaries = [
    { label: 'A season/coverage', upTo: seasonRequests },
    { label: 'B rounds', upTo: seasonRequests + roundRequests },
    { label: 'C fixture lists', upTo: afterC },
    { label: 'D player stats', upTo: afterC + playerStatRequests },
    { label: 'E events', upTo: total },
  ];

  return {
    leagues: leaguePlans,
    seasonRequests,
    roundRequests,
    fixtureListRequests,
    playerStatRequests,
    eventRequests,
    total,
    dailyCap,
    capIsMeasured: options.dailyCap !== undefined,
    days: splitAcrossDays(total, dailyCap, boundaries),
    estimated: fixturesPerRoundOverride === undefined,
  };
}

/** The concrete Stage-A calls. The rest cannot be named until A and B return. */
export function seasonDiscoveryRequests(leagues: readonly LeagueSpec[] = LEAGUES): PlannedRequest[] {
  return leagues.map((league) => ({
    stage: 'A-season' as const,
    endpoint: '/leagues',
    params: { id: league.id },
    purpose: `${league.name}: list seasons + per-season coverage flags (need fixtures.statistics_players = true on a completed season)`,
  }));
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );
  const line = (cells: string[]): string =>
    `| ${cells.map((c, i) => (c ?? '').padEnd(widths[i])).join(' | ')} |`;
  return [
    line(headers),
    `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`,
    ...rows.map(line),
  ].join('\n');
}

export function renderPlan(estimate: PlanEstimate): string {
  const out: string[] = [];

  out.push('## Sample');
  out.push('');
  out.push(
    table(
      ['league', 'id', 'teams', 'fixtures/GW', 'GWs', 'player-stat reqs'],
      estimate.leagues.map((p) => [
        p.league.name,
        String(p.league.id),
        String(p.league.typicalTeams),
        String(p.fixturesPerRound),
        String(p.gameweeks),
        String(p.playerStatRequests),
      ]),
    ),
  );
  out.push('');
  out.push(
    estimate.estimated
      ? '_Fixture counts are estimates from typical squad counts; Stage C replaces them with the real listing._'
      : '_Fixture counts are the real values returned by Stage C._',
  );
  out.push('');

  out.push('## Request budget');
  out.push('');
  out.push(
    table(
      ['stage', 'endpoint', 'calls', 'what it buys'],
      [
        ['A', 'GET /leagues', String(estimate.seasonRequests), 'seasons + coverage flags, 1 per league — decides the season and gates the STOP'],
        ['B', 'GET /fixtures/rounds', String(estimate.roundRequests), 'round names in order, 1 per league — decides which 4 GWs'],
        ['C', 'GET /fixtures', String(estimate.fixtureListRequests), 'fixture ids + status, 1 per league-round'],
        ['D', 'GET /fixtures/players', String(estimate.playerStatRequests), 'per-player match stats, 1 per fixture (both teams in one response)'],
        ['E', 'GET /fixtures/events', String(estimate.eventRequests), 'timed events, 1 per fixture — sub entry minutes (§Finishers) and own goals'],
        ['', '**total**', `**${estimate.total}**`, ''],
      ],
    ),
  );
  out.push('');

  const capSource = estimate.capIsMeasured
    ? 'measured from x-ratelimit-requests-limit'
    : 'free-tier assumption, not yet measured';
  out.push(`## Per-day schedule (cap ${estimate.dailyCap}/day — ${capSource}; resets 00:00 UTC)`);
  out.push('');
  out.push(
    table(
      ['day', 'requests', 'cumulative', 'covers'],
      estimate.days.map((d) => [String(d.day), String(d.requests), String(d.cumulative), d.covers]),
    ),
  );
  out.push('');
  out.push(
    `Total ${estimate.total} requests over ${estimate.days.length} days. Every response is written to \`data/\` before the next call, and the pull skips any fixture already on disk, so re-running \`--resume\` on day 2 and day 3 costs nothing for work already done.`,
  );
  out.push('');

  out.push('## Gameweek selection');
  out.push('');
  out.push(
    `Rounds are chosen at fractions ${GAMEWEEK_FRACTIONS.map((f) => f.toFixed(2)).join(' / ')} of each league's own round count, labelled ${GAMEWEEK_LABELS.join(' / ')}:`,
  );
  out.push('');
  out.push(
    table(
      ['league round count', 'selected rounds'],
      [
        ['38 (EPL, La Liga, Serie A, Ligue 1)', selectRoundNumbers(38).join(', ')],
        ['34 (Bundesliga)', selectRoundNumbers(34).join(', ')],
      ],
    ),
  );
  out.push('');

  const gaps = REQUIRED_STATS.filter((s) => s.note !== undefined);
  out.push('## Declared stat gaps to confirm empirically in Phase 1');
  out.push('');
  out.push(
    'These are read off the endpoint schema before the pull, not measured. Phase 1 measures the actual coverage rate for every stat in `REQUIRED_STATS` and reports it; nothing here is proxied or backfilled.',
  );
  out.push('');
  out.push(
    table(
      ['spec stat', 'endpoint field', 'issue'],
      gaps.map((s) => [s.specName, s.path ?? '— absent —', s.note ?? '']),
    ),
  );

  return out.join('\n');
}
