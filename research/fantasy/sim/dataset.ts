/**
 * FS-1 Phase 3 — the sample, normalised.
 *
 * PURE. Reads `data/` and nothing else: no network, no `fetch/` import, no
 * clock. Identical input produces identical output, which is what lets a
 * 2000-iteration sweep be re-run and reconciled (README §The network rule).
 *
 * Three feeds are joined here, and each is used for exactly what it is
 * authoritative for:
 *
 *   discovery/fixtures-*.json  the fixture SCORE and which club was home.
 *                              MatchContext comes from here and never from a
 *                              player row — `goals.conceded` is keeper-only, so
 *                              reading it off an outfield line would award every
 *                              defender in a 0-3 defeat a clean sheet
 *                              (see MatchContext in the engine, measured in the
 *                              probe).
 *   fixtures/<league>/<id>     per-player aggregate counts.
 *   events/<league>/<id>       own goals and the clock. The stat line carries
 *                              neither.
 *
 * Where the two disagree on a countable, THE STAT LINE WINS and the discrepancy
 * is reported by `integrity.ts` rather than reconciled away. Nothing here
 * invents, estimates or backfills a value (ticket HARD RULES): a null becomes 0
 * only because the probe measured that null *means* "did not record this", and
 * that single conversion is the only interpretation this module performs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  MatchContext,
  PlayerMatchStats,
  Slot,
  TimedPlayerEvent,
} from '../../../app/convex/lib/fantasyScoring.ts';
import type { FeedStatBlock, MatchEvent } from '../../../app/convex/lib/fantasyFeedStats.ts';
import {
  entryMinute,
  feedNumber,
  incomingPlayerId,
  isSubstitution,
  matchContextFor,
  slotFromFeedPosition,
  statsFromFeed,
  timedEventsByPlayer,
} from '../../../app/convex/lib/fantasyFeedStats.ts';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(PACKAGE_ROOT, 'data');

// ------------------------------------------------------------------- feed shapes

interface FeedFixtureListing {
  response: {
    fixture: { id: number; date: string; status: { short: string } };
    league: { id: number; season: number; round: string };
    teams: { home: { id: number; name: string }; away: { id: number; name: string } };
    goals: { home: number | null; away: number | null };
  }[];
}

interface FeedPlayerRow {
  player: { id: number; name: string };
  statistics: FeedStatBlock[];
}

interface FeedPlayersFile {
  response: { team: { id: number; name: string }; players: FeedPlayerRow[] }[];
}

interface FeedEventsFile {
  response: MatchEvent[];
}

// ------------------------------------------------------------------- public shapes

export interface FixtureMeta {
  readonly fixtureId: number;
  readonly leagueId: number;
  readonly season: number;
  readonly round: string;
  readonly date: string;
  readonly statusShort: string;
  readonly homeClubId: number;
  readonly awayClubId: number;
  readonly homeName: string;
  readonly awayName: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
}

/**
 * One player's complete, scoreable line for one fixture.
 *
 * `feedPosition` is the feed's nominal position — the verdict position
 * SCORING_SPEC §Position mismatch compares the fielded slot against. It is NOT
 * the slot to score through; the sim decides that when it fields a squad.
 */
export interface PlayerFixtureRow {
  readonly fixtureId: number;
  readonly leagueId: number;
  readonly round: string;
  readonly playerId: number;
  readonly playerName: string;
  readonly clubId: number;
  readonly clubName: string;
  readonly feedPosition: Slot | null;
  readonly stats: PlayerMatchStats;
  readonly context: MatchContext;
  /** Every timed event attributable to this player, entry-filtered by the caller. */
  readonly events: readonly TimedPlayerEvent[];
  /** Null for a starter. From the events feed, never from `games.substitute`. */
  readonly entryMinute: number | null;
}

export interface Gameweek {
  readonly key: string; // `${leagueId}|${round}`
  readonly leagueId: number;
  readonly round: string;
  readonly fixtures: readonly FixtureMeta[];
  readonly rows: readonly PlayerFixtureRow[];
}

export interface Dataset {
  readonly season: number;
  readonly gameweeks: readonly Gameweek[];
  readonly rows: readonly PlayerFixtureRow[];
  readonly fixtures: readonly FixtureMeta[];
  /** Raw events keyed by fixture id — integrity.ts reconciles against these. */
  readonly eventsByFixture: ReadonlyMap<number, readonly MatchEvent[]>;
}

// ------------------------------------------------------------------- normalisation
//
// The normalisers themselves are NOT here any more: `statsFromFeed`,
// `slotFromFeedPosition`, `timedEventsByPlayer`, `matchContextFor` and the
// null→0 primitive live in `app/convex/lib/fantasyFeedStats.ts` alongside the
// engine (FW-4 R1 — one engine, and one translation into it, driven by both this
// harness and the live pipeline). This module keeps the file I/O and the round
// grouping, which are the harness's alone.
//
// The single interpretation applied to any raw feed value is still that null
// means "did not record this" and becomes 0 — measured in the phase-1 probe by
// reconciling goal events against summed non-null totals. Nothing here invents,
// estimates or backfills.

// ------------------------------------------------------------------- loading

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

function listDiscoveryFixtureFiles(): string[] {
  const dir = path.join(DATA_DIR, 'discovery');
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('fixtures-') && f.endsWith('.json'))
    .map((f) => path.join(dir, f))
    .sort();
}

export function loadDataset(): Dataset {
  const fixtures: FixtureMeta[] = [];
  const roundOf = new Map<number, { leagueId: number; round: string }>();
  let season = 0;

  for (const file of listDiscoveryFixtureFiles()) {
    const listing = readJson<FeedFixtureListing>(file);
    for (const entry of listing.response ?? []) {
      season = entry.league.season;
      const meta: FixtureMeta = {
        fixtureId: entry.fixture.id,
        leagueId: entry.league.id,
        season: entry.league.season,
        round: entry.league.round,
        date: entry.fixture.date,
        statusShort: entry.fixture.status.short,
        homeClubId: entry.teams.home.id,
        awayClubId: entry.teams.away.id,
        homeName: entry.teams.home.name,
        awayName: entry.teams.away.name,
        homeGoals: feedNumber(entry.goals.home),
        awayGoals: feedNumber(entry.goals.away),
      };
      fixtures.push(meta);
      roundOf.set(meta.fixtureId, { leagueId: meta.leagueId, round: meta.round });
    }
  }

  const rows: PlayerFixtureRow[] = [];
  const eventsByFixture = new Map<number, readonly MatchEvent[]>();

  for (const meta of fixtures) {
    const playersFile = path.join(DATA_DIR, 'fixtures', String(meta.leagueId), `${meta.fixtureId}.json`);
    const eventsFile = path.join(DATA_DIR, 'events', String(meta.leagueId), `${meta.fixtureId}.json`);
    if (!fs.existsSync(playersFile) || !fs.existsSync(eventsFile)) continue;

    const events = readJson<FeedEventsFile>(eventsFile).response ?? [];
    eventsByFixture.set(meta.fixtureId, events);
    const timed = timedEventsByPlayer(events);

    for (const teamBlock of readJson<FeedPlayersFile>(playersFile).response ?? []) {
      const isHome = teamBlock.team.id === meta.homeClubId;
      const goalsFor = isHome ? meta.homeGoals : meta.awayGoals;
      const goalsAgainst = isHome ? meta.awayGoals : meta.homeGoals;
      const context: MatchContext = matchContextFor(goalsFor, goalsAgainst);

      for (const row of teamBlock.players ?? []) {
        const statistics = row.statistics?.[0];
        const base = statsFromFeed(statistics);
        const playerEvents = timed.get(row.player.id) ?? [];
        const ownGoals = playerEvents.filter((e) => e.kind === 'ownGoal').length;

        rows.push({
          fixtureId: meta.fixtureId,
          leagueId: meta.leagueId,
          round: meta.round,
          playerId: row.player.id,
          playerName: row.player.name,
          clubId: teamBlock.team.id,
          clubName: teamBlock.team.name,
          feedPosition: slotFromFeedPosition(statistics?.games?.position),
          stats: { ...base, ownGoals },
          context,
          events: playerEvents,
          entryMinute: entryMinute(events, row.player.id),
        });
      }
    }
  }

  // A gameweek in FS-1 is one league's sampled round. (The FW-2 calendar-window
  // gameweek is a different, product-side construct; the sample was pulled by
  // round, so the sim's unit is the round.)
  const byKey = new Map<string, { leagueId: number; round: string; fixtures: FixtureMeta[]; rows: PlayerFixtureRow[] }>();
  for (const meta of fixtures) {
    const key = `${meta.leagueId}|${meta.round}`;
    const bucket = byKey.get(key) ?? { leagueId: meta.leagueId, round: meta.round, fixtures: [], rows: [] };
    bucket.fixtures.push(meta);
    byKey.set(key, bucket);
  }
  for (const row of rows) {
    byKey.get(`${row.leagueId}|${row.round}`)?.rows.push(row);
  }

  const gameweeks: Gameweek[] = [...byKey.entries()]
    .map(([key, b]) => ({ key, leagueId: b.leagueId, round: b.round, fixtures: b.fixtures, rows: b.rows }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  return { season, gameweeks, rows, fixtures, eventsByFixture };
}

/** Events at or after a finisher's entry minute — entry-inclusive (v0.4.1 §Finishers). */
export function eventsFromEntry(
  row: PlayerFixtureRow,
): readonly TimedPlayerEvent[] {
  if (row.entryMinute === null) return row.events;
  const entry = row.entryMinute;
  return row.events.filter((e) => e.minute >= entry);
}

export { isSubstitution, incomingPlayerId };
