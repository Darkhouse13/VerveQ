/**
 * MISSION FW-EXPAND O2 — proxy scores for the three expansion cohorts.
 *
 * R1 (owner ruling 2026-08-02): each new league is its own cohort, exactly the
 * promoted-cohort precedent — cohort-internal proxy ordering from THAT
 * league's own 2025-26 aggregates, NO cross-league comparison (standing ban on
 * invented discount factors).
 *
 * Method identical to proxy.ts (FW-PR1 step 3), by construction not by copy:
 * the season line is per-90 scaled and driven through the real v0.5.1
 * `scorePlayer` engine; context expectations enter via engine probes and the
 * player's clubs' 2025-26 figures, minutes-weighted; shrinkage pulls low-
 * minute players toward the position median OF THEIR OWN LEAGUE POOL
 * (900-minute full weight, the precedent's constant).
 *
 * Pools are disjoint BY DATA:
 *   eredivisie / ligaportugal / championship — the player's CURRENT club's
 *   league, entered only with >0 minutes in that league's 2025-26 season.
 *   flagged — everyone else (no usable 2025-26 minutes in his league): floor
 *   4.0. This includes players relegated in from the Premier League — their
 *   2025-26 minutes are top-five, not Championship, and R1's cross-league ban
 *   is explicit. The owner overrides names via overrides.json after ship
 *   (EXPANSION_REVIEW.md is the review surface).
 *
 * Partition gate: the four buckets partition the 1,780-player expansion
 * universe exactly; asserted here (extends FW-PR1's assertion to the expanded
 * universe — the top-five/promoted/flagged partition of the old 2,895 is
 * untouched).
 *
 * Run: npx tsx pricing/proxy-expansion.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  scorePlayer,
  emptyStats,
  type MatchContext,
  type PlayerMatchStats,
  type Slot,
} from '../../../app/convex/lib/fantasyScoring.ts';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(PRICING_DIR, 'data');
const OUT_PATH = path.join(PRICING_DIR, 'expansion-proxy-scores.json');

const SHRINKAGE_FULL_MINUTES = 900;

export type ExpansionPool = 'eredivisie' | 'ligaportugal' | 'championship';
const POOL_OF_LEAGUE: Record<number, ExpansionPool> = {
  88: 'eredivisie',
  94: 'ligaportugal',
  40: 'championship',
};

// ---------------------------------------------------------------- data loading

interface UniversePlayer {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubId: number;
  leagueId: number;
  position: Slot;
  active: boolean;
}

type Raw = Record<string, any>;

function read(name: string): Raw {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8'));
}

function n(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// ------------------------------------------------------- season line assembly
// (identical shape to proxy.ts — see PROXY_METHOD.md for field-by-field notes)

interface SeasonLine {
  minutes: number;
  apps: number;
  goals: number;
  assists: number;
  saves: number;
  shotsTotal: number;
  shotsOn: number;
  keyPasses: number;
  passesTotal: number;
  passesAccurate: number;
  dribblesAttempted: number;
  dribblesCompleted: number;
  tackles: number;
  interceptions: number;
  blocks: number;
  duelsTotal: number;
  duelsWon: number;
  foulsCommitted: number;
  foulsDrawn: number;
  yellow: number;
  red: number;
  penWon: number;
  penConceded: number;
  penMissed: number;
  penSaved: number;
  csRate: number;
  gaPerMatch: number;
  winRate: number;
  drawRate: number;
  teamStatGapMinutes: number;
}

interface TeamRates {
  csRate: number;
  gaPerMatch: number;
  winRate: number;
  drawRate: number;
}

function teamRatesFrom(stats: Raw): TeamRates | null {
  const played = n(stats?.fixtures?.played?.total);
  if (played === 0) return null;
  return {
    csRate: n(stats?.clean_sheet?.total) / played,
    gaPerMatch: n(stats?.goals?.against?.total?.total) / played,
    winRate: n(stats?.fixtures?.wins?.total) / played,
    drawRate: n(stats?.fixtures?.draws?.total) / played,
  };
}

function sumLine(entries: Raw[], teamRates: Map<string, TeamRates>): SeasonLine {
  const line: SeasonLine = {
    minutes: 0, apps: 0, goals: 0, assists: 0, saves: 0, shotsTotal: 0, shotsOn: 0,
    keyPasses: 0, passesTotal: 0, passesAccurate: 0, dribblesAttempted: 0,
    dribblesCompleted: 0, tackles: 0, interceptions: 0, blocks: 0, duelsTotal: 0,
    duelsWon: 0, foulsCommitted: 0, foulsDrawn: 0, yellow: 0, red: 0, penWon: 0,
    penConceded: 0, penMissed: 0, penSaved: 0,
    csRate: 0, gaPerMatch: 0, winRate: 0, drawRate: 0, teamStatGapMinutes: 0,
  };
  let ratedMinutes = 0;
  for (const s of entries) {
    const minutes = n(s.games?.minutes);
    line.minutes += minutes;
    line.apps += n(s.games?.appearences);
    line.goals += n(s.goals?.total);
    line.assists += n(s.goals?.assists);
    line.saves += n(s.goals?.saves);
    line.shotsTotal += n(s.shots?.total);
    line.shotsOn += n(s.shots?.on);
    line.keyPasses += n(s.passes?.key);
    const passes = n(s.passes?.total);
    line.passesTotal += passes;
    // Season aggregates ship `passes.accuracy` as a PERCENTAGE — reconstruct
    // the accurate-pass count (same measurement as proxy.ts).
    line.passesAccurate += passes * (n(s.passes?.accuracy) / 100);
    line.dribblesAttempted += n(s.dribbles?.attempts);
    line.dribblesCompleted += n(s.dribbles?.success);
    line.tackles += n(s.tackles?.total);
    line.interceptions += n(s.tackles?.interceptions);
    line.blocks += n(s.tackles?.blocks);
    line.duelsTotal += n(s.duels?.total);
    line.duelsWon += n(s.duels?.won);
    line.foulsCommitted += n(s.fouls?.committed);
    line.foulsDrawn += n(s.fouls?.drawn);
    line.yellow += n(s.cards?.yellow);
    line.red += n(s.cards?.red) + n(s.cards?.yellowred);
    line.penWon += n(s.penalty?.won);
    line.penConceded += n(s.penalty?.commited);
    line.penMissed += n(s.penalty?.missed);
    line.penSaved += n(s.penalty?.saved);

    const rates = teamRates.get(`${s.team?.id}|${s.league?.id}`);
    if (rates === undefined) {
      line.teamStatGapMinutes += minutes;
    } else {
      ratedMinutes += minutes;
      line.csRate += minutes * rates.csRate;
      line.gaPerMatch += minutes * rates.gaPerMatch;
      line.winRate += minutes * rates.winRate;
      line.drawRate += minutes * rates.drawRate;
    }
  }
  if (ratedMinutes > 0) {
    line.csRate /= ratedMinutes;
    line.gaPerMatch /= ratedMinutes;
    line.winRate /= ratedMinutes;
    line.drawRate /= ratedMinutes;
  }
  return line;
}

// ------------------------------------------------------------- engine driving

interface PositionProbes {
  cleanSheet: number;
  win: number;
  draw: number;
  concessionPer2: number;
}

function probe(position: Slot): PositionProbes {
  const bare = emptyStats({ minutes: 90 });
  const at = (context: MatchContext): number =>
    scorePlayer({ stats: bare, context, events: [] }, { position, role: 'starter' }, position, null, 0).points;
  const base = at({ teamGoalsFor: 0, teamGoalsAgainst: 1, result: 'loss' });
  return {
    cleanSheet: at({ teamGoalsFor: 0, teamGoalsAgainst: 0, result: 'loss' }) - base,
    win: at({ teamGoalsFor: 0, teamGoalsAgainst: 1, result: 'win' }) - base,
    draw: at({ teamGoalsFor: 0, teamGoalsAgainst: 1, result: 'draw' }) - base,
    concessionPer2: at({ teamGoalsFor: 0, teamGoalsAgainst: 2, result: 'loss' }) - base,
  };
}

function rawProxyPer90(line: SeasonLine, position: Slot, probes: PositionProbes): number {
  const k = 90 / line.minutes;
  const stats: PlayerMatchStats = emptyStats({
    minutes: 90,
    goals: line.goals * k,
    assists: line.assists * k,
    shotsTotal: line.shotsTotal * k,
    shotsOn: line.shotsOn * k,
    keyPasses: line.keyPasses * k,
    passesTotal: line.passesTotal * k,
    passesAccurate: line.passesAccurate * k,
    dribblesAttempted: line.dribblesAttempted * k,
    dribblesCompleted: line.dribblesCompleted * k,
    tackles: line.tackles * k,
    interceptions: line.interceptions * k,
    blocks: line.blocks * k,
    duelsTotal: line.duelsTotal * k,
    duelsWon: line.duelsWon * k,
    foulsCommitted: line.foulsCommitted * k,
    foulsDrawn: line.foulsDrawn * k,
    yellowCards: line.yellow * k,
    redCards: line.red * k,
    saves: line.saves * k,
    penaltiesWon: line.penWon * k,
    penaltiesConceded: line.penConceded * k,
    penaltiesMissed: line.penMissed * k,
    penaltiesSaved: line.penSaved * k,
    // own goals: not carried by season aggregates; omitted (same as proxy.ts)
  });
  const neutral: MatchContext = { teamGoalsFor: 0, teamGoalsAgainst: 1, result: 'loss' };
  const engine = scorePlayer({ stats, context: neutral, events: [] }, { position, role: 'starter' }, position, null, 0).points;
  const expectation =
    line.winRate * probes.win +
    line.drawRate * probes.draw +
    line.csRate * probes.cleanSheet +
    (line.gaPerMatch / 2) * probes.concessionPer2;
  return engine + expectation;
}

// ----------------------------------------------------------------------- main

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function main(): void {
  const universe = (read('expansion-players-snapshot.json') as { players: UniversePlayer[] }).players;
  const aggregates = read('expansion-aggregates-2025-26.json') as { rows: Raw[] };
  const teamStats = read('expansion-team-stats-2025-26.json') as { teams: Raw[] };
  const currentClubs = read('expansion-current-clubs-2026.json') as {
    clubs: Array<{ leagueId: number; teamId: number; name: string }>;
  };

  const addendum = read('expansion-team-stats-addendum-2025-26.json') as { teams: Raw[] };

  const teamRates = new Map<string, TeamRates>();
  for (const t of [...teamStats.teams, ...addendum.teams]) {
    const rates = teamRatesFrom(t);
    if (rates !== null) teamRates.set(`${t.team?.id}|${t.league?.id}`, rates);
  }
  // Provider id-duplication, verified 2026-08-12 (addendum manifest): the
  // /players rows tag Estrela's full 2025-26 Primeira season as team 28053
  // ("Estrela Calheta") while the league's membership list and team figures
  // live under 15130 ("Estrela") — 28053's figures are empty, 15130 played 34,
  // and the rows hold exactly 18 full club-seasons with 28053 filling the
  // membership slot. Same club, two feed ids; alias the rates.
  const TEAM_STAT_ALIASES: Record<string, string> = { '28053|94': '15130|94' };
  for (const [from, to] of Object.entries(TEAM_STAT_ALIASES)) {
    const rates = teamRates.get(to);
    if (rates === undefined) throw new Error(`alias target ${to} has no team figures`);
    teamRates.set(from, rates);
  }
  const clubNames = new Map<number, string>();
  for (const c of currentClubs.clubs) clubNames.set(c.teamId, c.name);

  // per-player 2025-26 entries, keyed player id, split per expansion league
  const entriesByPlayer = new Map<number, Raw[]>();
  for (const row of aggregates.rows) {
    const list = entriesByPlayer.get(row.player.id) ?? [];
    for (const s of row.statistics ?? []) {
      if (POOL_OF_LEAGUE[n(s.league?.id)] !== undefined) list.push(s);
    }
    entriesByPlayer.set(row.player.id, list);
  }

  const probes: Record<Slot, PositionProbes> = {
    GK: probe('GK'), DEF: probe('DEF'), MID: probe('MID'), ATT: probe('ATT'),
  };

  interface Scored {
    convexId: string;
    apiFootballId: number;
    name: string;
    clubId: number;
    clubName: string;
    leagueId: number;
    position: Slot;
    pool: ExpansionPool;
    minutes: number;
    apps: number;
    rawPer90: number;
    shrinkWeight: number;
    proxy: number;
    teamStatGapMinutes: number;
  }
  interface Flagged {
    convexId: string;
    apiFootballId: number;
    name: string;
    clubId: number;
    clubName: string;
    leagueId: number;
    position: Slot;
    reason: string;
    partialMinutes: number;
    partialApps: number;
  }

  const scored: Scored[] = [];
  const flagged: Flagged[] = [];

  for (const p of universe) {
    const pool = POOL_OF_LEAGUE[p.leagueId];
    if (pool === undefined) {
      throw new Error(`player ${p.apiFootballId} has non-expansion league ${p.leagueId} in the expansion snapshot`);
    }
    const clubName = clubNames.get(p.clubId) ?? String(p.clubId);
    // R1: only THAT league's own 2025-26 minutes admit a player to his cohort.
    const tagged = (entriesByPlayer.get(p.apiFootballId) ?? []).filter(
      (s) => n(s.league?.id) === p.leagueId && n(s.games?.minutes) > 0,
    );
    // Regular-season scope: the feed tags promotion/relegation PLAYOFF
    // appearances with the destination league's id, on clubs that were never
    // season members and hold no season figures (measured: Roda/Waalwijk/
    // Almere City/Den Bosch under league 88, Torreense under 94 — 2-3 playoff
    // matches each, team figures empty). "That league's own 2025-26 season
    // aggregates" (R1) means the season proper: entries at clubs with no
    // season figures are out of cohort scope, counted below, never guessed at.
    const own = tagged.filter((s) => teamRates.has(`${s.team?.id}|${s.league?.id}`));
    const scopeExcludedMinutes = tagged
      .filter((s) => !teamRates.has(`${s.team?.id}|${s.league?.id}`))
      .reduce((sum, s) => sum + n(s.games?.minutes), 0);

    if (own.length === 0) {
      const anyRows = entriesByPlayer.get(p.apiFootballId) ?? [];
      const partialMinutes = anyRows.reduce((sum, s) => sum + n(s.games?.minutes), 0);
      const partialApps = anyRows.reduce((sum, s) => sum + n(s.games?.appearences), 0);
      const reason =
        anyRows.length === 0
          ? 'no 2025-26 rows in any pulled competition'
          : partialMinutes === 0
            ? '2025-26 rows exist but zero league minutes'
            : scopeExcludedMinutes > 0
              ? 'league-tagged minutes are playoff-only (no season-member club)'
              : 'minutes only outside pool scope (another expansion league)';
      flagged.push({
        convexId: p.convexId, apiFootballId: p.apiFootballId, name: p.name,
        clubId: p.clubId, clubName, leagueId: p.leagueId, position: p.position,
        reason, partialMinutes, partialApps,
      });
      continue;
    }

    const line = sumLine(own, teamRates);
    const raw = rawProxyPer90(line, p.position, probes[p.position]);
    scored.push({
      convexId: p.convexId, apiFootballId: p.apiFootballId, name: p.name,
      clubId: p.clubId, clubName, leagueId: p.leagueId, position: p.position,
      pool, minutes: line.minutes, apps: line.apps, rawPer90: raw,
      shrinkWeight: Math.min(line.minutes / SHRINKAGE_FULL_MINUTES, 1),
      proxy: 0,
      teamStatGapMinutes: line.teamStatGapMinutes,
    });
  }

  // shrinkage toward the position median OF THE PLAYER'S OWN LEAGUE POOL
  const medians: Record<string, number> = {};
  for (const pool of ['eredivisie', 'ligaportugal', 'championship'] as const) {
    for (const position of ['GK', 'DEF', 'MID', 'ATT'] as const) {
      const raws = scored.filter((s) => s.pool === pool && s.position === position).map((s) => s.rawPer90);
      if (raws.length > 0) medians[`${pool}|${position}`] = median(raws);
    }
  }
  for (const s of scored) {
    const m = medians[`${s.pool}|${s.position}`];
    s.proxy = s.shrinkWeight * s.rawPer90 + (1 - s.shrinkWeight) * m;
  }

  // ---- partition gate: exact per-league and overall -------------------------
  const counts: Record<string, number> = {};
  for (const pool of ['eredivisie', 'ligaportugal', 'championship'] as const) {
    counts[pool] = scored.filter((s) => s.pool === pool).length;
  }
  counts.flagged = flagged.length;
  const total = scored.length + flagged.length;
  const distinctIds = new Set([...scored, ...flagged].map((x) => x.apiFootballId)).size;
  console.log(
    `partition: eredivisie ${counts.eredivisie} + ligaportugal ${counts.ligaportugal} + championship ${counts.championship} + flagged ${counts.flagged} = ${total} (universe ${universe.length}, distinct ${distinctIds})`,
  );
  if (total !== universe.length || distinctIds !== universe.length) {
    throw new Error('PARTITION ASSERTION FAILED — an expansion player is missing or double-counted');
  }
  // per-league: cohort + flagged of that league = league total
  for (const [leagueId, pool] of Object.entries(POOL_OF_LEAGUE)) {
    const inLeague = universe.filter((p) => p.leagueId === Number(leagueId)).length;
    const inPool = scored.filter((s) => s.pool === pool).length;
    const inFlagged = flagged.filter((f) => f.leagueId === Number(leagueId)).length;
    console.log(`  league ${leagueId}: ${inPool} ${pool} + ${inFlagged} flagged = ${inPool + inFlagged} (${inLeague} seeded)`);
    if (inPool + inFlagged !== inLeague) {
      throw new Error(`PARTITION ASSERTION FAILED for league ${leagueId}`);
    }
  }

  const gapMinutes = scored.reduce((sum, s) => sum + s.teamStatGapMinutes, 0);
  console.log(`team-figure coverage gap across all scored players: ${gapMinutes} minutes (should be 0)`);
  if (gapMinutes !== 0) {
    throw new Error('STOP: minutes exist at clubs we hold no 2025-26 season figures for');
  }

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        manifest: {
          generatedAt: new Date().toISOString(),
          method: 'PROXY_METHOD.md, applied per-league per R1 (FW-EXPAND owner ruling 2026-08-02)',
          engine: 'app/convex/lib/fantasyScoring.ts (SCORING_SPEC v0.5.1), driven, not copied',
          probes,
          medians,
          counts,
        },
        players: scored,
        flagged,
      },
      null,
      1,
    ),
  );
  console.log(`wrote ${path.basename(OUT_PATH)}`);
}

main();
