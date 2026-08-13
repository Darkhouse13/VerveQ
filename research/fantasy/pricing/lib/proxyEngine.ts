/**
 * The per-90 proxy engine, extracted so there is exactly one of it.
 *
 * proxy.ts (FW-PR1) and proxy-expansion.ts (FW-EXPAND) grew field-for-field
 * identical copies of this code, and FW-REPRICE needs a third caller that runs
 * it over TWO seasons. Three copies of "how a season line becomes points per
 * 90" is three places for the method to drift, so it lives here and all three
 * import it. The extraction is provably faithful: both predecessors regenerate
 * their artifacts byte-for-byte (modulo `generatedAt`) against this module.
 *
 * The method itself is unchanged and documented in PROXY_METHOD.md — every
 * scoring constant is sourced from the engine BY CONSTRUCTION rather than
 * copied: a synthetic 90-minute stat line is scored by the exported v0.5.1
 * `scorePlayer`, and the context-dependent values are recovered per position
 * by probing the engine with controlled context diffs.
 */

import {
  scorePlayer,
  emptyStats,
  type MatchContext,
  type PlayerMatchStats,
  type Slot,
} from '../../../../app/convex/lib/fantasyScoring.ts';

export type { Slot };
export type Raw = Record<string, any>;

/** null-safe numeric read. The feed encodes "not recorded" as null. */
export function n(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// ------------------------------------------------------- season line assembly

/** One player's summed line across the entries of one league set, one season. */
export interface SeasonLine {
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

export interface TeamRates {
  csRate: number;
  gaPerMatch: number;
  winRate: number;
  drawRate: number;
}

export function teamRatesFrom(stats: Raw): TeamRates | null {
  const played = n(stats?.fixtures?.played?.total);
  if (played === 0) return null;
  return {
    csRate: n(stats?.clean_sheet?.total) / played,
    gaPerMatch: n(stats?.goals?.against?.total?.total) / played,
    winRate: n(stats?.fixtures?.wins?.total) / played,
    drawRate: n(stats?.fixtures?.draws?.total) / played,
  };
}

export function sumLine(entries: Raw[], teamRates: Map<string, TeamRates>): SeasonLine {
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

/**
 * Position-dependent context values, recovered from the engine by controlled
 * diffs rather than copied constants (scoring/ is read-only for this ticket):
 * a bare 90-minute line is scored under contexts differing in exactly one
 * fact, and the diff IS the engine's value for that fact.
 *   loss/GA=1 is the neutral base: no result points, no clean sheet, and a
 *   concession penalty of floor(1/2) = 0.
 */
export interface PositionProbes {
  cleanSheet: number;
  win: number;
  draw: number;
  /** points per 2 team goals conceded (0 for MID/ATT by template) */
  concessionPer2: number;
}

export function probe(position: Slot): PositionProbes {
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

export function allProbes(): Record<Slot, PositionProbes> {
  return { GK: probe('GK'), DEF: probe('DEF'), MID: probe('MID'), ATT: probe('ATT') };
}

/**
 * Raw proxy per 90: the engine's score for a synthetic average 90 minutes,
 * plus the expectation terms the synthetic context deliberately zeroed.
 */
export function rawProxyPer90(line: SeasonLine, position: Slot, probes: PositionProbes): number {
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

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
