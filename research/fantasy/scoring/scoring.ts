/**
 * SCORING_SPEC.md v0.4 — the scoring engine.
 *
 * Pure and deterministic: same input, same output, no I/O, no clock, no RNG.
 * Implements v0.4 exactly as written.
 *
 * v0.4 settled the six gaps Phase 2 found in v0.3. The rulings, and where each
 * one lives in this file:
 *
 *  G1  Clean sheet requires 60+ minutes played, all positions. `cleanSheet`.
 *
 *  G2  The concession penalty requires 60+ minutes played, and team goals
 *      against come from MatchContext rather than player rows — `goals.conceded`
 *      is keeper-only in the feed, so an outfielder's own row reads 0 in a 0-3
 *      defeat. `concededAgainst`.
 *
 *  G3  The decisive-moment multiplier (formerly "closer") applies to
 *      timestamped events only — goals, assists, penalty events. A feed-data
 *      limit, now stated in the spec: tackles, saves, key passes, dribbles,
 *      blocks and duels arrive as match totals with no clock. The multiplier is
 *      consequently weaker for defensive and goalkeeping finishers.
 *
 *  G4  Entry-minute events are INCLUSIVE: minute >= entryMinute. A goal in the
 *      same minute as the substitution counts.
 *
 *  G5  The mismatch x0.75 applies only when the templated base is positive;
 *      a negative base passes through undamped, so mis-slotting can never
 *      outscore correct slotting. `applyMismatch`.
 *
 *  G6  The engine returns unrounded totals; display rounds to 1 dp. See
 *      `formatPoints`. IEEE-754 representation noise is suppressed at the 1e-9
 *      level, which is not the same thing as rounding to a display precision.
 *
 * v0.4.1 settled the one consequence of G5 that Phase 2 flagged and did not fix:
 * the crowd factor now MIRRORS against a negative base —
 * `base >= 0 ? base x (1 + f) : base x (1 - f)` — so a positive crowd verdict
 * shrinks a negative score toward zero instead of deepening it. See the crowd
 * block in `scorePlayer`.
 */

import type {
  FieldedSlot,
  LedgerEntry,
  PlayerMatchStats,
  ScoreResult,
  ScoringInput,
  Slot,
  TimedEventKind,
  TimedPlayerEvent,
} from './types.ts';

// ------------------------------------------------------------------ constants

/** v0.3 §Position templates. Goals and assists invert by position. */
const GOAL_POINTS: Record<Slot, number> = { GK: 8, DEF: 7, MID: 6, ATT: 5 };
const ASSIST_POINTS: Record<Slot, number> = { GK: 6, DEF: 5, MID: 4, ATT: 3 };
const CLEAN_SHEET_POINTS: Record<Slot, number> = { GK: 5, DEF: 4, MID: 1, ATT: 0 };

/** v0.3 §Universal events. */
const MINUTES_UNDER_60 = 1;
const MINUTES_60_PLUS = 2;
const SUB_APPEARANCE = 1;
const WIN_POINTS = 2;
const DRAW_POINTS = 1;
const YELLOW_CARD = -1;
const RED_CARD = -4;
const OWN_GOAL = -3;
const PENALTY_MISSED = -3;
const PENALTY_WON = 2;
const PENALTY_CONCEDED = -2;

/** GK template. */
const GK_SAVE = 0.5;
const GK_SAVE_CAP = 4;
const GK_PENALTY_SAVED = 6;

/** DEF template. */
const DEF_TACKLE = 0.4;
const DEF_TACKLE_CAP = 3;
const DEF_INTERCEPTION = 0.6;
const DEF_INTERCEPTION_CAP = 3;
const DEF_BLOCK = 0.5;
const DEF_BLOCK_CAP = 2;
const DEF_DUEL_BONUS = 2;
const DEF_DUEL_RATE = 0.6;
const DEF_DUEL_MIN_CONTESTED = 6;

/** MID template. */
const MID_DEFENSIVE = 0.5;
const MID_DEFENSIVE_CAP = 4;
const MID_KEY_PASS = 0.8;
const MID_KEY_PASS_CAP = 4;
const MID_DRIBBLE = 0.5;
const MID_DRIBBLE_CAP = 2;
const MID_PASS_BONUS = 2;
const MID_PASS_COMPLETION = 0.88;
const MID_PASS_MIN_TOTAL = 40;

/** ATT template. */
const ATT_SHOT_ON = 0.5;
const ATT_SHOT_ON_CAP = 2;
const ATT_KEY_PASS = 0.8;
const ATT_KEY_PASS_CAP = 4;
const ATT_DRIBBLE = 0.5;
const ATT_DRIBBLE_CAP = 3;

/**
 * ── Cap overrides, for Phase 3 sensitivity sweeps only ──
 *
 * Every value defaults to the spec's. `scorePlayer` called without a `caps`
 * argument implements SCORING_SPEC v0.4.1 exactly as written, which is what
 * the 33 Phase 2 tests assert and what this engine is for.
 *
 * The sweep exists because "are the caps the right size?" is unanswerable by
 * reading the spec: a cap that never binds is decoration, and one that binds on
 * every row has flattened the stat it was meant to temper. TICKET FS-1 asks for
 * 0.5x and 2x. Overriding a constant is strictly a HARNESS capability — the
 * report proposes, it never sets.
 */
export interface CapConfig {
  readonly gkSave: number;
  readonly defTackle: number;
  readonly defInterception: number;
  readonly defBlock: number;
  readonly midDefensive: number;
  readonly midKeyPass: number;
  readonly midDribble: number;
  readonly attShotOn: number;
  readonly attKeyPass: number;
  readonly attDribble: number;
}

export const DEFAULT_CAPS: CapConfig = {
  gkSave: GK_SAVE_CAP,
  defTackle: DEF_TACKLE_CAP,
  defInterception: DEF_INTERCEPTION_CAP,
  defBlock: DEF_BLOCK_CAP,
  midDefensive: MID_DEFENSIVE_CAP,
  midKeyPass: MID_KEY_PASS_CAP,
  midDribble: MID_DRIBBLE_CAP,
  attShotOn: ATT_SHOT_ON_CAP,
  attKeyPass: ATT_KEY_PASS_CAP,
  attDribble: ATT_DRIBBLE_CAP,
};

/** Every cap scaled by `k`. k=1 is the spec. */
export function scaledCaps(k: number): CapConfig {
  return {
    gkSave: DEFAULT_CAPS.gkSave * k,
    defTackle: DEFAULT_CAPS.defTackle * k,
    defInterception: DEFAULT_CAPS.defInterception * k,
    defBlock: DEFAULT_CAPS.defBlock * k,
    midDefensive: DEFAULT_CAPS.midDefensive * k,
    midKeyPass: DEFAULT_CAPS.midKeyPass * k,
    midDribble: DEFAULT_CAPS.midDribble * k,
    attShotOn: DEFAULT_CAPS.attShotOn * k,
    attKeyPass: DEFAULT_CAPS.attKeyPass * k,
    attDribble: DEFAULT_CAPS.attDribble * k,
  };
}

/** v0.4 §Finishers and §Position mismatch. */
const DECISIVE_MOMENT_MULTIPLIER = 1.25;
const DECISIVE_MOMENT_AFTER_MINUTE = 75;
const MISMATCH_DAMPENER = 0.75;

/** Clean sheets and the concession penalty both require this (G1, G2). */
const QUALIFYING_MINUTES = 60;

/** Timed events that can earn the decisive-moment multiplier: positive only (G3). */
const POSITIVE_TIMED_KINDS: readonly TimedEventKind[] = [
  'goal',
  'assist',
  'penaltyWon',
  'penaltySaved',
];

// -------------------------------------------------------------------- helpers

/**
 * Strips IEEE-754 representation noise without rounding to a display precision
 * (G6). 0.4 x 3 is 1.2000000000000002 in binary floating point; that is an
 * artefact of the representation, not a scoring decision.
 */
function clean(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

function capped(count: number, unit: number, cap: number): { raw: number; points: number } {
  const raw = clean(count * unit);
  return { raw, points: Math.min(raw, cap) };
}

/** Event counts, resolved differently for starters and finishers. */
interface EventCounts {
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  penaltiesWon: number;
  penaltiesConceded: number;
  penaltiesMissed: number;
  penaltiesSaved: number;
}

function countsFromStats(stats: PlayerMatchStats): EventCounts {
  return {
    goals: stats.goals,
    assists: stats.assists,
    yellowCards: stats.yellowCards,
    redCards: stats.redCards,
    ownGoals: stats.ownGoals,
    penaltiesWon: stats.penaltiesWon,
    penaltiesConceded: stats.penaltiesConceded,
    penaltiesMissed: stats.penaltiesMissed,
    penaltiesSaved: stats.penaltiesSaved,
  };
}

const KIND_TO_COUNT: Record<TimedEventKind, keyof EventCounts> = {
  goal: 'goals',
  assist: 'assists',
  yellowCard: 'yellowCards',
  redCard: 'redCards',
  ownGoal: 'ownGoals',
  penaltyWon: 'penaltiesWon',
  penaltyConceded: 'penaltiesConceded',
  penaltyMissed: 'penaltiesMissed',
  penaltySaved: 'penaltiesSaved',
};

function countsFromEvents(events: readonly TimedPlayerEvent[], fromMinute: number): EventCounts {
  const counts: EventCounts = {
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    ownGoals: 0,
    penaltiesWon: 0,
    penaltiesConceded: 0,
    penaltiesMissed: 0,
    penaltiesSaved: 0,
  };
  for (const event of events) {
    if (event.minute < fromMinute) continue; // entry minute inclusive (G4)
    counts[KIND_TO_COUNT[event.kind]] += 1;
  }
  return counts;
}

// ------------------------------------------------------------------- templates

function goalkeeperEntries(stats: PlayerMatchStats, cleanSheet: boolean, conceded: number, caps: CapConfig): LedgerEntry[] {
  const out: LedgerEntry[] = [];

  if (stats.saves > 0) {
    const { raw, points } = capped(stats.saves, GK_SAVE, caps.gkSave);
    out.push({ code: 'gk.saves', label: 'Saves', count: stats.saves, unit: GK_SAVE, raw, cap: caps.gkSave, points });
  }
  if (cleanSheet) {
    out.push({ code: 'gk.cleanSheet', label: 'Clean sheet', points: CLEAN_SHEET_POINTS.GK });
  }
  const penalty = Math.floor(conceded / 2);
  if (penalty > 0) {
    out.push({
      code: 'gk.conceded',
      label: 'Goals conceded',
      count: conceded,
      points: -penalty,
      note: '-1 per 2 conceded, team total for the match (G2)',
    });
  }
  return out;
}

function defenderEntries(stats: PlayerMatchStats, cleanSheet: boolean, conceded: number, caps: CapConfig): LedgerEntry[] {
  const out: LedgerEntry[] = [];

  if (cleanSheet) {
    out.push({ code: 'def.cleanSheet', label: 'Clean sheet', points: CLEAN_SHEET_POINTS.DEF });
  }
  if (stats.tackles > 0) {
    const { raw, points } = capped(stats.tackles, DEF_TACKLE, caps.defTackle);
    out.push({ code: 'def.tackles', label: 'Tackles (attempted)', count: stats.tackles, unit: DEF_TACKLE, raw, cap: caps.defTackle, points });
  }
  if (stats.interceptions > 0) {
    const { raw, points } = capped(stats.interceptions, DEF_INTERCEPTION, caps.defInterception);
    out.push({ code: 'def.interceptions', label: 'Interceptions', count: stats.interceptions, unit: DEF_INTERCEPTION, raw, cap: caps.defInterception, points });
  }
  if (stats.blocks > 0) {
    const { raw, points } = capped(stats.blocks, DEF_BLOCK, caps.defBlock);
    out.push({ code: 'def.blocks', label: 'Blocks', count: stats.blocks, unit: DEF_BLOCK, raw, cap: caps.defBlock, points });
  }
  // Step function. v0.3 §Known tensions item 1 asks the sims to measure how
  // often a score hinges on this cliff, so the rate is recorded even when the
  // bonus does not pay.
  if (stats.duelsTotal >= DEF_DUEL_MIN_CONTESTED) {
    const rate = stats.duelsWon / stats.duelsTotal;
    if (rate >= DEF_DUEL_RATE) {
      out.push({
        code: 'def.duels',
        label: 'Duel dominance',
        count: stats.duelsWon,
        points: DEF_DUEL_BONUS,
        note: `${stats.duelsWon}/${stats.duelsTotal} = ${(rate * 100).toFixed(1)}% >= 60% on >= 6 contested`,
      });
    }
  }
  const penalty = Math.floor(conceded / 2);
  if (penalty > 0) {
    out.push({
      code: 'def.conceded',
      label: 'Goals conceded',
      count: conceded,
      points: -penalty,
      note: '-1 per 2 conceded, team total for the match (G2)',
    });
  }
  return out;
}

function midfielderEntries(stats: PlayerMatchStats, cleanSheet: boolean, caps: CapConfig): LedgerEntry[] {
  const out: LedgerEntry[] = [];

  const defensiveActions = stats.tackles + stats.interceptions;
  if (defensiveActions > 0) {
    const { raw, points } = capped(defensiveActions, MID_DEFENSIVE, caps.midDefensive);
    out.push({
      code: 'mid.defensive',
      label: 'Tackles (attempted) + interceptions',
      count: defensiveActions,
      unit: MID_DEFENSIVE,
      raw,
      cap: caps.midDefensive,
      points,
      note: `${stats.tackles} tackles + ${stats.interceptions} interceptions, combined cap`,
    });
  }
  if (stats.keyPasses > 0) {
    const { raw, points } = capped(stats.keyPasses, MID_KEY_PASS, caps.midKeyPass);
    out.push({ code: 'mid.keyPasses', label: 'Key passes', count: stats.keyPasses, unit: MID_KEY_PASS, raw, cap: caps.midKeyPass, points });
  }
  if (stats.dribblesCompleted > 0) {
    const { raw, points } = capped(stats.dribblesCompleted, MID_DRIBBLE, caps.midDribble);
    out.push({ code: 'mid.dribbles', label: 'Dribbles completed', count: stats.dribblesCompleted, unit: MID_DRIBBLE, raw, cap: caps.midDribble, points });
  }
  // completion = accurate passes / total passes, both counts (v0.3 MID).
  if (stats.passesTotal >= MID_PASS_MIN_TOTAL) {
    const completion = stats.passesAccurate / stats.passesTotal;
    if (completion >= MID_PASS_COMPLETION) {
      out.push({
        code: 'mid.passCompletion',
        label: 'Pass completion',
        points: MID_PASS_BONUS,
        note: `${stats.passesAccurate}/${stats.passesTotal} = ${(completion * 100).toFixed(1)}% >= 88% on >= 40 passes`,
      });
    }
  }
  if (cleanSheet) {
    out.push({ code: 'mid.cleanSheet', label: 'Clean sheet', points: CLEAN_SHEET_POINTS.MID });
  }
  return out;
}

function attackerEntries(stats: PlayerMatchStats, caps: CapConfig): LedgerEntry[] {
  const out: LedgerEntry[] = [];

  if (stats.shotsOn > 0) {
    const { raw, points } = capped(stats.shotsOn, ATT_SHOT_ON, caps.attShotOn);
    out.push({ code: 'att.shotsOn', label: 'Shots on target', count: stats.shotsOn, unit: ATT_SHOT_ON, raw, cap: caps.attShotOn, points });
  }
  if (stats.keyPasses > 0) {
    const { raw, points } = capped(stats.keyPasses, ATT_KEY_PASS, caps.attKeyPass);
    out.push({ code: 'att.keyPasses', label: 'Key passes', count: stats.keyPasses, unit: ATT_KEY_PASS, raw, cap: caps.attKeyPass, points });
  }
  if (stats.dribblesCompleted > 0) {
    const { raw, points } = capped(stats.dribblesCompleted, ATT_DRIBBLE, caps.attDribble);
    out.push({ code: 'att.dribbles', label: 'Dribbles completed', count: stats.dribblesCompleted, unit: ATT_DRIBBLE, raw, cap: caps.attDribble, points });
  }
  // v0.3 ATT: "No negative for goals conceded", and no clean sheet term.
  return out;
}

// ----------------------------------------------------------------------- main

/**
 * Score one player's match through one fielded slot.
 *
 * @param entryMinute Minute the player came on, or null for a starter and for
 *   an unused finisher. Never 0 for a substitute — see `entryMinute` in
 *   events.ts, where null is deliberately distinct from 0.
 * @param crowdFactor Signed fraction, e.g. +0.15 for the launch clamp ceiling.
 *   v0.3 §Crowd multiplier: final = base x (1 + crowd_factor).
 */
export function scorePlayer(
  input: ScoringInput,
  fieldedSlot: FieldedSlot,
  verdictPosition: Slot,
  entryMinute: number | null,
  crowdFactor: number,
  caps: CapConfig = DEFAULT_CAPS,
): ScoreResult {
  const { stats, context, events } = input;
  const isFinisher = fieldedSlot.role === 'finisher';
  const ledger: LedgerEntry[] = [];

  // --- unused finisher: v0.3 §Finishers, "no participation floor".
  if (isFinisher && (stats.minutes <= 0 || entryMinute === null)) {
    const inconsistent = stats.minutes > 0 && entryMinute === null;
    ledger.push({
      code: 'finisher.unused',
      label: 'Unused finisher',
      points: 0,
      note: inconsistent
        ? `DATA INCONSISTENCY: ${stats.minutes} minutes played but no entry minute in the events feed; scored as unused`
        : 'Did not appear',
    });
    return { points: 0, ledger };
  }

  // A starter who never played scores nothing at all.
  if (!isFinisher && stats.minutes <= 0) {
    ledger.push({ code: 'unused', label: 'Did not appear', points: 0 });
    return { points: 0, ledger };
  }

  const slot = fieldedSlot.position;

  // --- event counts. A starter's events all count whenever they fell; a
  // finisher's are filtered to strictly after their entry minute (G4).
  const counts = isFinisher
    ? countsFromEvents(events, entryMinute as number)
    : countsFromStats(stats);

  if (isFinisher) {
    const aggregate = countsFromStats(stats);
    if (aggregate.goals !== counts.goals || aggregate.assists !== counts.assists) {
      ledger.push({
        code: 'finisher.eventMismatch',
        label: 'Event/aggregate disagreement',
        points: 0,
        note: `aggregate line says ${aggregate.goals}G/${aggregate.assists}A, post-entry events say ${counts.goals}G/${counts.assists}A; events used`,
      });
    }
  }

  // --- minutes. v0.3 §Finishers replaces the universal minutes points with a
  // flat appearance point for a finisher.
  if (isFinisher) {
    ledger.push({ code: 'minutes.subAppearance', label: 'Appearance as finisher', points: SUB_APPEARANCE });
  } else if (stats.minutes >= 60) {
    ledger.push({ code: 'minutes.60plus', label: 'Played 60+ min', count: stats.minutes, points: MINUTES_60_PLUS });
  } else {
    ledger.push({ code: 'minutes.under60', label: 'Played 1-59 min', count: stats.minutes, points: MINUTES_UNDER_60 });
  }

  // --- goals and assists, position-weighted.
  if (counts.goals > 0) {
    ledger.push({
      code: 'goals',
      label: 'Goals',
      count: counts.goals,
      unit: GOAL_POINTS[slot],
      points: clean(counts.goals * GOAL_POINTS[slot]),
    });
  }
  if (counts.assists > 0) {
    ledger.push({
      code: 'assists',
      label: 'Assists',
      count: counts.assists,
      unit: ASSIST_POINTS[slot],
      points: clean(counts.assists * ASSIST_POINTS[slot]),
    });
  }

  // --- team result. v0.3 gates this on 60+ minutes for everyone, finishers
  // included: only the minutes POINTS are replaced for a finisher, not the
  // 60-minute qualifier attached to the win/draw line.
  if (stats.minutes >= 60) {
    if (context.result === 'win') {
      ledger.push({ code: 'result.win', label: 'Team win (60+ min)', points: WIN_POINTS });
    } else if (context.result === 'draw') {
      ledger.push({ code: 'result.draw', label: 'Team draw (60+ min)', points: DRAW_POINTS });
    }
  }

  // --- template.
  // G1/G2: both terms require 60+ minutes played, and team goals against come
  // from the fixture score rather than the player's own (keeper-only) row.
  const qualifies = stats.minutes >= QUALIFYING_MINUTES;
  const cleanSheet = qualifies && context.teamGoalsAgainst === 0;
  const conceded = qualifies ? context.teamGoalsAgainst : 0;
  if (slot === 'GK') ledger.push(...goalkeeperEntries(stats, cleanSheet, conceded, caps));
  else if (slot === 'DEF') ledger.push(...defenderEntries(stats, cleanSheet, conceded, caps));
  else if (slot === 'MID') ledger.push(...midfielderEntries(stats, cleanSheet, caps));
  else ledger.push(...attackerEntries(stats, caps));

  // --- universal negatives and penalty events.
  if (counts.yellowCards > 0) {
    ledger.push({ code: 'cards.yellow', label: 'Yellow cards', count: counts.yellowCards, unit: YELLOW_CARD, points: counts.yellowCards * YELLOW_CARD });
  }
  if (counts.redCards > 0) {
    ledger.push({ code: 'cards.red', label: 'Second yellow / straight red', count: counts.redCards, unit: RED_CARD, points: counts.redCards * RED_CARD });
  }
  if (counts.ownGoals > 0) {
    ledger.push({ code: 'ownGoals', label: 'Own goals', count: counts.ownGoals, unit: OWN_GOAL, points: counts.ownGoals * OWN_GOAL });
  }
  if (counts.penaltiesMissed > 0) {
    ledger.push({ code: 'penalty.missed', label: 'Penalties missed', count: counts.penaltiesMissed, unit: PENALTY_MISSED, points: counts.penaltiesMissed * PENALTY_MISSED });
  }
  if (counts.penaltiesWon > 0) {
    ledger.push({ code: 'penalty.won', label: 'Penalties won', count: counts.penaltiesWon, unit: PENALTY_WON, points: counts.penaltiesWon * PENALTY_WON });
  }
  if (counts.penaltiesConceded > 0) {
    ledger.push({ code: 'penalty.conceded', label: 'Penalties conceded', count: counts.penaltiesConceded, unit: PENALTY_CONCEDED, points: counts.penaltiesConceded * PENALTY_CONCEDED });
  }
  if (slot === 'GK' && counts.penaltiesSaved > 0) {
    ledger.push({ code: 'gk.penaltySaved', label: 'Penalties saved', count: counts.penaltiesSaved, unit: GK_PENALTY_SAVED, points: counts.penaltiesSaved * GK_PENALTY_SAVED });
  }

  let total = clean(ledger.reduce((sum, entry) => sum + entry.points, 0));

  // --- closer multiplier. Finisher slots only, positive TIMED events only (G3).
  if (isFinisher) {
    const decisiveBasis = events
      .filter((event) => event.minute >= (entryMinute as number))
      .filter((event) => event.minute > DECISIVE_MOMENT_AFTER_MINUTE)
      .filter((event) => POSITIVE_TIMED_KINDS.includes(event.kind))
      .reduce((sum, event) => sum + timedEventValue(event.kind, slot), 0);

    const delta = clean(decisiveBasis * (DECISIVE_MOMENT_MULTIPLIER - 1));
    if (delta !== 0) {
      total = clean(total + delta);
      ledger.push({
        code: 'finisher.decisiveMoment',
        label: `Decisive-moment multiplier on post-${DECISIVE_MOMENT_AFTER_MINUTE}' events`,
        factor: DECISIVE_MOMENT_MULTIPLIER,
        raw: decisiveBasis,
        points: delta,
        note: 'timestamped events only — the feed cannot place tackles, saves or key passes on the clock (G3)',
      });
    }
  }

  // --- mismatch dampener.
  if (verdictPosition !== fieldedSlot.position) {
    const damped = applyMismatch(total);
    const delta = clean(damped - total);
    ledger.push({
      code: 'mismatch.dampener',
      label: `Position mismatch (fielded ${fieldedSlot.position}, verdict ${verdictPosition})`,
      factor: total >= 0 ? MISMATCH_DAMPENER : 1,
      points: delta,
      note: total < 0 ? 'negative base passes through undamped (G5)' : undefined,
    });
    total = damped;
  }

  // --- crowd multiplier. v0.4.1 mirrors the factor against a negative base, so
  // a positive crowd verdict shrinks a negative score toward zero rather than
  // deepening it: the factor is a judgment direction, not a raw scalar.
  if (crowdFactor !== 0) {
    const factor = total >= 0 ? 1 + crowdFactor : 1 - crowdFactor;
    const delta = clean(total * (factor - 1));
    ledger.push({
      code: 'crowd',
      label: 'Crowd multiplier',
      factor: clean(factor),
      points: delta,
      note: total < 0 ? 'mirrored against a negative base (v0.4.1)' : undefined,
    });
    total = clean(total + delta);
  }

  return { points: total, ledger };
}

/**
 * v0.4 §Position mismatch (G5): "x0.75 applied only when the templated base is
 * positive; negative bases pass through undamped. Mis-slotting never outscores
 * correct slotting."
 *
 * The v0.3 text said "floored at zero", which inverted the mechanic — a
 * red-carded player's -5 became 0, making a deliberate mis-slot worth +5 over
 * calling the position right. Damping only the positive side satisfies both of
 * the spec's original sentences at once: a mismatch can never drive a positive
 * score negative, and cards still apply.
 */
function applyMismatch(total: number): number {
  return total >= 0 ? clean(total * MISMATCH_DAMPENER) : total;
}

/**
 * v0.4 §Rounding (G6): "The engine returns scores unrounded. Display rounds to
 * 1 dp." This is the display side — never call it before comparing, ranking or
 * summing, or two scores 0.04 apart become a tie that the engine did not intend.
 */
export function formatPoints(points: number): string {
  // Ties round AWAY FROM ZERO, so -5.75 displays as -5.8 and 5.75 as 5.8.
  // Math.round would break both ties toward +infinity and render -5.75 as -5.7,
  // shrinking negative scores and growing positive ones by the same half-tenth.
  // v0.4 does not name a tie-break rule; symmetry is the defensible default for
  // a value that can legitimately be negative, and -5.75 is reachable (case 20).
  const scaled = points * 10;
  const magnitude = Math.round(Math.abs(scaled));
  const rounded = (scaled < 0 ? -magnitude : magnitude) / 10;
  // Normalising the zero keeps "-0.0" off a leaderboard.
  return (rounded === 0 ? 0 : rounded).toFixed(1);
}

/** Point value of a single timed event in a given slot, for the decisive basis. */
function timedEventValue(kind: TimedEventKind, slot: Slot): number {
  switch (kind) {
    case 'goal':
      return GOAL_POINTS[slot];
    case 'assist':
      return ASSIST_POINTS[slot];
    case 'penaltyWon':
      return PENALTY_WON;
    case 'penaltySaved':
      return slot === 'GK' ? GK_PENALTY_SAVED : 0;
    default:
      return 0;
  }
}
