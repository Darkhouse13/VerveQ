/**
 * TICKET FW-PR1 Step 3 — proxy expected points per 90, from season aggregates.
 *
 * A RANKING signal, not a score. Method (full write-up in PROXY_METHOD.md):
 *
 *  - Every scoring constant is sourced from scoring/scoring.ts BY CONSTRUCTION,
 *    not by copy: the exported v0.5.1 `scorePlayer` engine is driven with a
 *    synthetic 90-minute stat line built from the player's per-90 season rates
 *    (so caps apply to per-90 rates, ramps evaluate at season-average rates),
 *    and the context-dependent values (clean sheet, win, draw, concession
 *    unit) are recovered per position by probing the engine with controlled
 *    context diffs. scoring/ stays read-only; the constants cannot drift.
 *
 *  - Clean sheets / concessions / team result cannot come from the player's
 *    aggregate row (keeper-only `conceded`, no result split), so they enter as
 *    expectations from CLUB season figures, weighted by where the player's
 *    minutes were actually played in 2025-26 (per-entry minutes weighting; in
 *    per-90 space minutes-share attribution reduces exactly to the club's
 *    per-match rates).
 *
 *  - Pools are disjoint BY DATA (owner ruling, modified option C):
 *      topfive   — 2025-26 minutes in leagues 39/140/135/78/61
 *      promoted  — no top-five minutes, at one of the 13 promoted clubs, with
 *                  2025-26 second-division minutes (40/141/136/79/62).
 *                  COHORT-INTERNAL signal: ranked only against each other.
 *      flagged   — everyone else: no usable 2025-26 league minutes. No proxy,
 *                  default floor 4.0 (ruling item 3).
 *    Amended gate: the three pools partition the 2,895 exactly; asserted here.
 *
 *  - Shrinkage: weight = min(minutes/900, 1); proxy = w*raw + (1-w) * position
 *    median OF THE PLAYER'S OWN POOL. No exclusion for low minutes.
 *
 * Run: npx tsx pricing/proxy.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scorePlayer } from '../scoring/scoring.ts';
import { emptyStats, type MatchContext, type PlayerMatchStats, type Slot } from '../scoring/types.ts';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(PRICING_DIR, 'data');
const OUT_PATH = path.join(PRICING_DIR, 'proxy-scores.json');

const TOP5 = new Set([39, 140, 135, 78, 61]);
const SECOND_TIER = new Set([40, 141, 136, 79, 62]);
const SHRINKAGE_FULL_MINUTES = 900;
const GRID_MIN_DISTINCT = 7; // ticket STOP: any position with < 7 distinct proxies

// ---------------------------------------------------------------- data loading

interface UniversePlayer {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubId: number;
  leagueId: number;
  position: Slot;
}

type Raw = Record<string, any>;

function read(name: string): Raw {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8'));
}

/** null-safe numeric read. The feed encodes "not recorded" as null. */
function n(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// ------------------------------------------------------- season line assembly

/** One player's summed 2025-26 line across the entries of one league set. */
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
  passesAccurate: number; // Σ per-entry total × accuracy%/100 — see PROXY_METHOD.md
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
  red: number; // straight red + second yellow, both -4 in spec
  penWon: number;
  penConceded: number;
  penMissed: number;
  penSaved: number;
  /** minutes-weighted club rates for the expectation terms */
  csRate: number;
  gaPerMatch: number;
  winRate: number;
  drawRate: number;
  teamStatGapMinutes: number; // minutes at clubs we hold no season figures for
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
    // Season aggregates ship `passes.accuracy` as a PERCENTAGE (measured:
    // values 76-91 against totals in the thousands), unlike the per-fixture
    // endpoint where it is a count. Reconstruct the accurate-pass count.
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

    const rates = teamRatesFrom
      ? teamRates.get(`${s.team?.id}|${s.league?.id}`)
      : undefined;
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

/**
 * Position-dependent context values, recovered from the engine by controlled
 * diffs rather than copied constants (scoring/ is read-only for this ticket):
 * a bare 90-minute line is scored under contexts differing in exactly one
 * fact, and the diff IS the engine's value for that fact.
 *   loss/GA=1 is the neutral base: no result points, no clean sheet, and a
 *   concession penalty of floor(1/2) = 0.
 */
interface PositionProbes {
  cleanSheet: number;
  win: number;
  draw: number;
  /** points per 2 team goals conceded (0 for MID/ATT by template) */
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

/**
 * Raw proxy per 90: the engine's score for a synthetic average 90 minutes,
 * plus the expectation terms the synthetic context deliberately zeroed.
 */
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
    // own goals: not carried by season aggregates at any tier; omitted
    // (documented approximation, affects nobody's rank materially at -3/rare)
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
  const universe = (read('players-seed-snapshot.json') as { players: UniversePlayer[] }).players;
  const aggregates = read('player-aggregates-2025-26.json') as { rows: Raw[] };
  const backfill = read('promoted-backfill-2025-26.json') as { manifest: Raw; rows: Raw[] };
  const teamStatsMain = read('team-stats-2025-26.json') as { teams: Raw[] };
  const teamStatsExtra = read('team-stats-extra-2025-26.json') as { topFive: Raw[]; secondTier: Raw[] };

  const promotedClubs = new Set<number>(backfill.manifest.promotedClubIds as number[]);

  // club rates, keyed team|league
  const teamRates = new Map<string, TeamRates>();
  const clubNames = new Map<number, string>();
  for (const t of [...teamStatsMain.teams, ...teamStatsExtra.topFive, ...teamStatsExtra.secondTier]) {
    const rates = teamRatesFrom(t);
    if (t?.team?.id !== undefined) clubNames.set(t.team.id, t.team.name);
    if (rates !== null) teamRates.set(`${t.team?.id}|${t.league?.id}`, rates);
  }

  // per-player entry collection
  const topFiveEntries = new Map<number, Raw[]>();
  for (const row of aggregates.rows) {
    const list = topFiveEntries.get(row.player.id) ?? [];
    for (const s of row.statistics ?? []) if (TOP5.has(n(s.league?.id))) list.push(s);
    topFiveEntries.set(row.player.id, list);
  }
  const secondTierEntries = new Map<number, Raw[]>();
  for (const row of backfill.rows) {
    const list = secondTierEntries.get(row.player.id) ?? [];
    for (const s of row.statistics ?? []) if (SECOND_TIER.has(n(s.league?.id))) list.push(s);
    secondTierEntries.set(row.player.id, list);
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
    seededLeagueId: number;
    position: Slot;
    pool: 'topfive' | 'promoted';
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
    seededLeagueId: number;
    position: Slot;
    reason: string;
    partialMinutes: number; // any 2025-26 minutes seen outside the pool scopes
    partialApps: number;
  }

  const scored: Scored[] = [];
  const flagged: Flagged[] = [];

  for (const p of universe) {
    const clubName = clubNames.get(p.clubId) ?? String(p.clubId);
    const t5 = (topFiveEntries.get(p.apiFootballId) ?? []).filter((s) => n(s.games?.minutes) > 0);
    const st = (secondTierEntries.get(p.apiFootballId) ?? []).filter((s) => n(s.games?.minutes) > 0);

    let pool: 'topfive' | 'promoted' | null = null;
    let entries: Raw[] = [];
    if (t5.length > 0) {
      pool = 'topfive';
      entries = t5;
    } else if (promotedClubs.has(p.clubId) && st.length > 0) {
      pool = 'promoted';
      entries = st;
    }

    if (pool === null) {
      // Partial data, if any, for FLAGS.md prominence ordering: whatever
      // 2025-26 rows exist in ANY competition we pulled for this player.
      const anyRows = [
        ...(topFiveEntries.get(p.apiFootballId) ?? []),
        ...(backfill.rows.filter((r) => r.player.id === p.apiFootballId).flatMap((r) => r.statistics ?? [])),
      ];
      const partialMinutes = anyRows.reduce((sum, s) => sum + n(s.games?.minutes), 0);
      const partialApps = anyRows.reduce((sum, s) => sum + n(s.games?.appearences), 0);
      const reason =
        anyRows.length === 0
          ? 'no 2025-26 rows in any pulled competition'
          : partialMinutes === 0
            ? '2025-26 rows exist but zero league minutes'
            : 'minutes only outside pool scope (cups / other leagues)';
      flagged.push({
        convexId: p.convexId, apiFootballId: p.apiFootballId, name: p.name,
        clubId: p.clubId, clubName, seededLeagueId: p.leagueId, position: p.position,
        reason, partialMinutes, partialApps,
      });
      continue;
    }

    const line = sumLine(entries, teamRates);
    const raw = rawProxyPer90(line, p.position, probes[p.position]);
    scored.push({
      convexId: p.convexId, apiFootballId: p.apiFootballId, name: p.name,
      clubId: p.clubId, clubName, seededLeagueId: p.leagueId, position: p.position,
      pool, minutes: line.minutes, apps: line.apps, rawPer90: raw,
      shrinkWeight: Math.min(line.minutes / SHRINKAGE_FULL_MINUTES, 1),
      proxy: 0, // filled after pool medians are known
      teamStatGapMinutes: line.teamStatGapMinutes,
    });
  }

  // shrinkage toward the position median OF THE PLAYER'S OWN POOL
  const medians: Record<string, number> = {};
  for (const pool of ['topfive', 'promoted'] as const) {
    for (const position of ['GK', 'DEF', 'MID', 'ATT'] as const) {
      const raws = scored.filter((s) => s.pool === pool && s.position === position).map((s) => s.rawPer90);
      if (raws.length > 0) medians[`${pool}|${position}`] = median(raws);
    }
  }
  for (const s of scored) {
    const m = medians[`${s.pool}|${s.position}`];
    s.proxy = s.shrinkWeight * s.rawPer90 + (1 - s.shrinkWeight) * m;
  }

  // ---- amended gate: exact three-way partition ------------------------------
  const topfive = scored.filter((s) => s.pool === 'topfive');
  const promoted = scored.filter((s) => s.pool === 'promoted');
  const total = topfive.length + promoted.length + flagged.length;
  const distinctIds = new Set([...scored, ...flagged].map((x) => x.apiFootballId)).size;
  console.log(`partition: topfive ${topfive.length} + promoted ${promoted.length} + flagged ${flagged.length} = ${total} (universe ${universe.length}, distinct ${distinctIds})`);
  if (total !== universe.length || distinctIds !== universe.length) {
    throw new Error('PARTITION ASSERTION FAILED — a universe player is missing or double-counted');
  }

  // ---- original ticket gate: grid buildability ------------------------------
  for (const position of ['GK', 'DEF', 'MID', 'ATT'] as const) {
    const distinct = new Set(topfive.filter((s) => s.position === position).map((s) => s.proxy.toFixed(6))).size;
    console.log(`  ${position}: ${topfive.filter((s) => s.position === position).length} proxied (topfive), ${distinct} distinct proxy values`);
    if (distinct < GRID_MIN_DISTINCT) {
      throw new Error(`STOP: position ${position} has ${distinct} < ${GRID_MIN_DISTINCT} distinct proxy scores — grid unbuildable`);
    }
  }

  const gapMinutes = scored.reduce((sum, s) => sum + s.teamStatGapMinutes, 0);
  console.log(`team-figure coverage gap across all scored players: ${gapMinutes} minutes (should be 0)`);

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        manifest: {
          generatedAt: new Date().toISOString(),
          method: 'PROXY_METHOD.md',
          engine: 'scoring/scoring.ts (SCORING_SPEC v0.5.1), driven, not copied',
          probes,
          medians,
          counts: { topfive: topfive.length, promoted: promoted.length, flagged: flagged.length },
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
