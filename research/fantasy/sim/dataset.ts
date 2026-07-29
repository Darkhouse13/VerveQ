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
 *                              (types.ts MatchContext, measured in the probe).
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
  TimedEventKind,
  TimedPlayerEvent,
} from '../scoring/types.ts';
import { emptyStats } from '../scoring/types.ts';
import type { MatchEvent } from '../scoring/events.ts';
import { entryMinute, eventMinute, incomingPlayerId, isSubstitution } from '../scoring/events.ts';

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
  statistics: Record<string, any>[];
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

/**
 * The feed's null means "did not record this", measured in the phase-1 probe by
 * reconciling goal events against summed non-null totals. This is the ONLY
 * interpretation applied to a raw value anywhere in the harness.
 */
function n(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `games.position` is a single letter. Anything else is left null and reported. */
function slotFromFeedPosition(raw: unknown): Slot | null {
  switch (String(raw ?? '').toUpperCase()) {
    case 'G':
      return 'GK';
    case 'D':
      return 'DEF';
    case 'M':
      return 'MID';
    case 'F':
      return 'ATT';
    default:
      return null;
  }
}

export function statsFromFeed(statistics: Record<string, any> | undefined): PlayerMatchStats {
  const s = statistics ?? {};
  return emptyStats({
    minutes: n(s.games?.minutes),
    goals: n(s.goals?.total),
    assists: n(s.goals?.assists),
    shotsTotal: n(s.shots?.total),
    shotsOn: n(s.shots?.on),
    keyPasses: n(s.passes?.key),
    passesTotal: n(s.passes?.total),
    // Named "accuracy", shipped as an accurate-pass COUNT, and shipped as a
    // string. Measured in the probe; see fetch/config.ts REQUIRED_STATS.
    passesAccurate: n(s.passes?.accuracy),
    dribblesAttempted: n(s.dribbles?.attempts),
    dribblesCompleted: n(s.dribbles?.success),
    tackles: n(s.tackles?.total),
    interceptions: n(s.tackles?.interceptions),
    blocks: n(s.tackles?.blocks),
    duelsTotal: n(s.duels?.total),
    duelsWon: n(s.duels?.won),
    foulsCommitted: n(s.fouls?.committed),
    foulsDrawn: n(s.fouls?.drawn),
    yellowCards: n(s.cards?.yellow),
    redCards: n(s.cards?.red),
    saves: n(s.goals?.saves),
    penaltiesWon: n(s.penalty?.won),
    // The feed's own spelling. Not a typo here.
    penaltiesConceded: n(s.penalty?.commited),
    penaltiesScored: n(s.penalty?.scored),
    penaltiesMissed: n(s.penalty?.missed),
    penaltiesSaved: n(s.penalty?.saved),
    ownGoals: 0, // filled from events below — the stat line does not carry it
    wasSubstitute: s.games?.substitute === true,
  });
}

/**
 * Timed events per player id.
 *
 * Only the categories `TimedEventKind` admits are emitted, because only those
 * can be placed on the clock — which is the whole reason SCORING_SPEC §Finishers
 * needs this feed. Deliberately NOT emitted:
 *
 *  - `Var | *` rows. They annotate a decision, they are not the event. Counting
 *    "Goal cancelled" as a goal would be an outright fabrication; integrity.ts
 *    checks separately whether the cancelled goal was already excluded from the
 *    Goal rows (it reconciles event goals against the fixture score).
 *  - `subst`. Not a scoring event; consumed for entry minutes only.
 *  - Penalty SAVED. There is no event detail for it anywhere in the 3,209-event
 *    sample — the stat line carries `penalty.saved` untimed. A GK finisher's
 *    penalty save therefore cannot be clock-placed, which is a measured feed
 *    limit reported in the calibration report, not a modelling choice.
 */
function timedEventsByPlayer(
  events: readonly MatchEvent[],
): Map<number, TimedPlayerEvent[]> {
  const byPlayer = new Map<number, TimedPlayerEvent[]>();
  const push = (playerId: number | null, minute: number | null, kind: TimedEventKind): void => {
    if (playerId === null || minute === null) return;
    const list = byPlayer.get(playerId) ?? [];
    list.push({ minute, kind });
    byPlayer.set(playerId, list);
  };

  for (const event of events) {
    const minute = eventMinute(event);
    const type = event.type?.toLowerCase() ?? '';
    const detail = event.detail?.toLowerCase() ?? '';

    if (type === 'goal') {
      if (detail.includes('own goal')) {
        push(event.player.id, minute, 'ownGoal');
        continue;
      }
      if (detail.includes('missed penalty')) {
        push(event.player.id, minute, 'penaltyMissed');
        continue;
      }
      // "Normal Goal" and "Penalty" both score as a goal; the penalty-scored
      // count itself lives on the stat line and is not separately priced.
      push(event.player.id, minute, 'goal');
      push(event.assist.id, minute, 'assist');
      continue;
    }

    if (type === 'card') {
      // No second-yellow detail exists anywhere in the sample (measured:
      // 780 "Yellow Card", 38 "Red Card", zero "Second Yellow"). v0.4.1 prices
      // both reds at -4, so the missing split costs nothing.
      if (detail.includes('red')) push(event.player.id, minute, 'redCard');
      else if (detail.includes('yellow')) push(event.player.id, minute, 'yellowCard');
      continue;
    }
  }

  return byPlayer;
}

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
        homeGoals: n(entry.goals.home),
        awayGoals: n(entry.goals.away),
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
      const context: MatchContext = {
        teamGoalsFor: goalsFor,
        teamGoalsAgainst: goalsAgainst,
        result: goalsFor > goalsAgainst ? 'win' : goalsFor === goalsAgainst ? 'draw' : 'loss',
      };

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
