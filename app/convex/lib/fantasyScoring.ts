/**
 * SCORING_SPEC.md v0.5.1 — THE scoring engine. One engine, this file.
 *
 * ── Why this file is here and not in research/ (FW-4 ruling R1) ──
 *
 * It was `research/fantasy/scoring/scoring.ts` (+ `types.ts`), where the FS-1
 * calibration harness could reach it and the shipped product could not. Convex
 * bundles from `app/convex/`, so a production scoring pass could only have got
 * at it by copying it — and a copied scoring engine is two engines that agree
 * until the first time someone edits one. So the engine moved HERE and the sim
 * harness now imports it from this path: same file, two callers, and the FW-4
 * regression gate asserts the live Convex path and the harness produce identical
 * numbers for identical inputs. `research/fantasy/scoring/MOVED.md` is the
 * pointer left at the old location.
 *
 * The move was byte-preserving for the arithmetic. `types.ts` was folded in
 * (the harness's types cannot live outside the Convex bundle either), and
 * `applyCrowdFactor` was extracted from the crowd block below so the PIPELINE
 * can derive a total from a stored baseScore through the same expression the
 * engine uses — see R5, which stores base and factor separately. Nothing else
 * changed: the acceptance suite and the 2000-squad sweep both reproduce their
 * pre-move outputs exactly.
 *
 * ── What this file is ──
 *
 * Pure and deterministic: same input, same output, no I/O, no clock, no RNG, and
 * NO Convex import — the research harness has no `convex` dependency, and this
 * file staying dependency-free is what keeps it importable from both sides.
 *
 * Implements v0.5.1 exactly as written (v0.5.1 was an editorial closeout of
 * v0.5.0; no constant or structure changed).
 *
 * v0.5.0 applied the owner's rulings on the FS-1 Phase 4 calibration
 * (reports/fs1-phase4-calibration-2026-07-29.md). Where each lives here:
 *
 *  P1  Appearance is a flat +1 for any minutes, one ledger line. The 60-minute
 *      threshold still gates team result, clean sheets and concessions.
 *  P2  Win +1, draw +0.5 (simple form; no contribution gate).
 *  P4  The duel and pass-completion step bonuses are linear ramps:
 *      DEF duels  +2 x clamp((rate - 0.50) / 0.20, 0, 1) on >= 6 contested;
 *      MID passes +2 x clamp((completion - 0.84) / 0.08, 0, 1) on >= 40 passes.
 *      Ramp points are quantised to 2 dp (`ramp2`) so the ledger line still
 *      reconstructs by hand from the displayed rate.
 *  P5  MID defensive rate +0.5 -> +0.7 per action, combined cap unchanged at 4.
 *  P6a The decisive-moment multiplier applies ONLY to a finisher's goal and
 *      assist events after 75' — an attacking mechanic by ruling. See
 *      DECISIVE_KINDS: penalty events are structurally excluded from the basis.
 *  P3b/P7/P8 changed no constants (cap wording, crowd clamp kept at +/-15%,
 *      ATT distribution accepted); they live in the spec, not here.
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
 *      timestamped events only. A feed-data limit, now stated in the spec:
 *      tackles, saves, key passes, dribbles, blocks and duels arrive as match
 *      totals with no clock, so the multiplier is consequently weaker for
 *      defensive and goalkeeping finishers. v0.4's basis (goals, assists,
 *      penalty events) was narrowed by v0.5.0 P6a — see above — to goals and
 *      assists only.
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
 * shrinks a negative score toward zero instead of deepening it. See
 * `applyCrowdFactor`.
 */

/** The SCORING_SPEC version this engine implements. Stamped on every score row. */
export const SCORING_SPEC_VERSION = '0.5.1';

// ------------------------------------------------------------------ data shapes
//
// Formerly research/fantasy/scoring/types.ts. Pure data: no I/O, no dependency
// on the feed client, no dependency on THE DRAW.

export type Slot = 'GK' | 'DEF' | 'MID' | 'ATT';
export type SlotRole = 'starter' | 'finisher';

/** Which of the XI + 2 finisher slots the user played this player in. */
export interface FieldedSlot {
  readonly position: Slot;
  readonly role: SlotRole;
}

/**
 * One player's aggregate line for one match, normalised from the feed.
 *
 * The feed encodes "did not record this" as null; the normaliser converts that
 * to 0, which the phase-1 probe proved is what it means (goal events reconcile
 * exactly against the summed non-null totals). Every field here is a count, not
 * a rate — including `passesAccurate`, which the feed ships as an accurate-pass
 * COUNT despite being named `accuracy`.
 */
export interface PlayerMatchStats {
  readonly minutes: number;
  readonly goals: number;
  readonly assists: number;
  readonly shotsTotal: number;
  readonly shotsOn: number;
  readonly keyPasses: number;
  readonly passesTotal: number;
  readonly passesAccurate: number;
  readonly dribblesAttempted: number;
  readonly dribblesCompleted: number;
  /** Tackles ATTEMPTED. The feed has no won/lost split (v0.3 §3). */
  readonly tackles: number;
  readonly interceptions: number;
  readonly blocks: number;
  readonly duelsTotal: number;
  readonly duelsWon: number;
  readonly foulsCommitted: number;
  readonly foulsDrawn: number;
  readonly yellowCards: number;
  /** Second yellow and straight red are indistinguishable in the feed; v0.3 prices both at -4. */
  readonly redCards: number;
  readonly saves: number;
  readonly penaltiesWon: number;
  readonly penaltiesConceded: number;
  readonly penaltiesScored: number;
  readonly penaltiesMissed: number;
  readonly penaltiesSaved: number;
  /** From the timed-events feed; the per-player stat line does not carry it. */
  readonly ownGoals: number;
  readonly wasSubstitute: boolean;
}

/**
 * Match-level facts the player's own stat line cannot supply.
 *
 * MEASURED (phase-1 probe, fixture 1208070): `goals.conceded` on the feed is a
 * GOALKEEPER statistic. West Ham conceded three; only their keeper's row shows
 * 3 and every outfield row shows 0. Reading clean sheets or the -1-per-2-conceded
 * term off an outfield player's own line would therefore hand every defender in
 * a 0-3 defeat a clean sheet. Team goals against must come from the fixture.
 */
export interface MatchContext {
  readonly teamGoalsFor: number;
  readonly teamGoalsAgainst: number;
  readonly result: 'win' | 'draw' | 'loss';
}

/**
 * The timed-event categories. Only these can be placed on the clock, which is
 * what the finisher rules in v0.3 §Finishers require.
 */
export type TimedEventKind =
  | 'goal'
  | 'assist'
  | 'yellowCard'
  | 'redCard'
  | 'ownGoal'
  | 'penaltyWon'
  | 'penaltyConceded'
  | 'penaltyMissed'
  | 'penaltySaved';

export interface TimedPlayerEvent {
  /** Whole-minute clock position, stoppage time included (90+4 -> 94). */
  readonly minute: number;
  readonly kind: TimedEventKind;
}

export interface ScoringInput {
  readonly stats: PlayerMatchStats;
  readonly context: MatchContext;
  /**
   * This player's timed events in this fixture. Required for a finisher (their
   * entry filter and the post-75' multiplier are both clock-dependent) and
   * ignored for a starter, whose events all count regardless of when they fell.
   */
  readonly events: readonly TimedPlayerEvent[];
}

/**
 * One itemised line of the match ledger (v0.3 §Design principles item 2).
 *
 * `points` on every entry sums exactly to the returned total — multiplier
 * entries carry the delta they introduced rather than a factor to re-apply. That
 * is what makes the ledger reconstructable by addition alone.
 */
export interface LedgerEntry {
  /** Stable machine key, e.g. `def.tackles`, `finisher.closer`. */
  readonly code: string;
  readonly label: string;
  /** Units of the thing, where it is a countable. */
  readonly count?: number;
  /** Points per unit. */
  readonly unit?: number;
  /** count x unit, before any cap. Present when a cap could bite. */
  readonly raw?: number;
  readonly cap?: number;
  /** Multiplicative factor, for multiplier lines. */
  readonly factor?: number;
  /** Contribution to the total. Sums across all entries to `points`. */
  readonly points: number;
  readonly note?: string;
}

export interface ScoreResult {
  readonly points: number;
  readonly ledger: readonly LedgerEntry[];
}

export function emptyStats(overrides: Partial<PlayerMatchStats> = {}): PlayerMatchStats {
  return {
    minutes: 0,
    goals: 0,
    assists: 0,
    shotsTotal: 0,
    shotsOn: 0,
    keyPasses: 0,
    passesTotal: 0,
    passesAccurate: 0,
    dribblesAttempted: 0,
    dribblesCompleted: 0,
    tackles: 0,
    interceptions: 0,
    blocks: 0,
    duelsTotal: 0,
    duelsWon: 0,
    foulsCommitted: 0,
    foulsDrawn: 0,
    yellowCards: 0,
    redCards: 0,
    saves: 0,
    penaltiesWon: 0,
    penaltiesConceded: 0,
    penaltiesScored: 0,
    penaltiesMissed: 0,
    penaltiesSaved: 0,
    ownGoals: 0,
    wasSubstitute: false,
    ...overrides,
  };
}

// ------------------------------------------------------------------ constants

/** v0.3 §Position templates. Goals and assists invert by position. */
const GOAL_POINTS: Record<Slot, number> = { GK: 8, DEF: 7, MID: 6, ATT: 5 };
const ASSIST_POINTS: Record<Slot, number> = { GK: 6, DEF: 5, MID: 4, ATT: 3 };
const CLEAN_SHEET_POINTS: Record<Slot, number> = { GK: 5, DEF: 4, MID: 1, ATT: 0 };

/** v0.5.0 §Universal events. */
const APPEARANCE = 1; // flat, any minutes (P1)
const SUB_APPEARANCE = 1;
const WIN_POINTS = 1; // P2
const DRAW_POINTS = 0.5; // P2
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
const DEF_DUEL_MAX = 2; // ramp top end — NOT raised in v0.5.0 (P4)
const DEF_DUEL_RAMP_FLOOR = 0.5;
const DEF_DUEL_RAMP_WIDTH = 0.2;
const DEF_DUEL_MIN_CONTESTED = 6;

/** MID template. */
const MID_DEFENSIVE = 0.7; // P5: rate raised, cap unchanged
const MID_DEFENSIVE_CAP = 4;
const MID_KEY_PASS = 0.8;
const MID_KEY_PASS_CAP = 4;
const MID_DRIBBLE = 0.5;
const MID_DRIBBLE_CAP = 2;
const MID_PASS_MAX = 2; // ramp top end — NOT raised in v0.5.0 (P4)
const MID_PASS_RAMP_FLOOR = 0.84;
const MID_PASS_RAMP_WIDTH = 0.08;
const MID_PASS_MIN_TOTAL = 40;

/** ATT template. */
const ATT_SHOT_ON = 0.5;
const ATT_SHOT_ON_CAP = 2;
const ATT_KEY_PASS = 0.8;
const ATT_KEY_PASS_CAP = 4;
const ATT_DRIBBLE = 0.5;
const ATT_DRIBBLE_CAP = 3;

/**
 * The launch crowd clamp — SCORING_SPEC §Crowd multiplier, ±15% (P7).
 *
 * Exported because THE PIPELINE enforces it, not the engine (FW-4 ruling R5):
 * `scorePlayer` applies whatever factor it is handed, and the ingest path
 * REJECTS a factor outside this band fail-closed rather than clamping one
 * silently. A clamp applied here would turn a bad upstream number into a
 * plausible score instead of an error.
 */
export const CROWD_FACTOR_LIMIT = 0.15;

/**
 * ── Cap overrides, for Phase 3 sensitivity sweeps only ──
 *
 * Every value defaults to the spec's. `scorePlayer` called without a `caps`
 * argument implements SCORING_SPEC v0.5.0 exactly as written, which is what
 * the acceptance tests assert and what this engine is for.
 *
 * The sweep exists because "are the caps the right size?" is unanswerable by
 * reading the spec: a cap that never binds is decoration, and one that binds on
 * every row has flattened the stat it was meant to temper. TICKET FS-1 asks for
 * 0.5x and 2x. Overriding a constant is strictly a HARNESS capability — the
 * report proposes, it never sets, and the pipeline never passes this argument.
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

/**
 * Timed events that can earn the decisive-moment multiplier: a finisher's goals
 * and assists ONLY (v0.5.0 P6a — an attacking mechanic by ruling). Penalty
 * events are deliberately not in this list; their exclusion is what makes the
 * "multiplier never fires on a non-goal/assist event" guarantee structural
 * rather than checked.
 */
const DECISIVE_KINDS: readonly TimedEventKind[] = ['goal', 'assist'];

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

/**
 * A v0.5.0 P4 linear ramp: max x clamp((rate - floor) / width, 0, 1), quantised
 * to 2 dp. The quantisation is part of the term's DEFINITION, not display
 * convenience: the spec requires the ledger line to reconstruct by hand
 * ("duel dominance 63.2% -> +1.32"), which only holds if the points the engine
 * sums are the same 2 dp value the ledger shows. This is not a G6 violation —
 * G6 forbids rounding the TOTAL to display precision, not defining a term at a
 * finite resolution.
 */
function ramp2(rate: number, floor: number, width: number, max: number): number {
  const t = Math.min(1, Math.max(0, (rate - floor) / width));
  return Math.round(max * t * 100) / 100;
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
  // Linear ramp (v0.5.0 P4) — the v0.4.1 step at 60% was measured as a cliff
  // with ~20% of eligible rows within 5pp of it (FS-1 §4). Zero at 50%, +2 at
  // 70%, qualifying volume unchanged.
  if (stats.duelsTotal >= DEF_DUEL_MIN_CONTESTED) {
    const rate = stats.duelsWon / stats.duelsTotal;
    const points = ramp2(rate, DEF_DUEL_RAMP_FLOOR, DEF_DUEL_RAMP_WIDTH, DEF_DUEL_MAX);
    if (points > 0) {
      out.push({
        code: 'def.duels',
        label: 'Duel dominance',
        count: stats.duelsWon,
        points,
        note: `${stats.duelsWon}/${stats.duelsTotal} = ${(rate * 100).toFixed(1)}% on >= 6 contested; ramp 0 at 50%, +2 at 70% (2 dp)`,
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
  // Linear ramp (v0.5.0 P4) — the v0.4.1 step at 88% sat on the median of its
  // eligible population (FS-1 §4). Zero at 84%, +2 at 92%, >= 40 passes.
  if (stats.passesTotal >= MID_PASS_MIN_TOTAL) {
    const completion = stats.passesAccurate / stats.passesTotal;
    const points = ramp2(completion, MID_PASS_RAMP_FLOOR, MID_PASS_RAMP_WIDTH, MID_PASS_MAX);
    if (points > 0) {
      out.push({
        code: 'mid.passCompletion',
        label: 'Pass completion',
        points,
        note: `${stats.passesAccurate}/${stats.passesTotal} = ${(completion * 100).toFixed(1)}% on >= 40 passes; ramp 0 at 84%, +2 at 92% (2 dp)`,
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
 *   fantasyFeedStats.ts, where null is deliberately distinct from 0.
 * @param crowdFactor Signed fraction, e.g. +0.15 for the launch clamp ceiling.
 *   v0.3 §Crowd multiplier: final = base x (1 + crowd_factor). The band is NOT
 *   enforced here — see CROWD_FACTOR_LIMIT.
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
  // finisher's are filtered to their entry minute onward — entry minute
  // INCLUSIVE (G4).
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

  // --- minutes. v0.5.0 P1: appearance is a flat +1 for any minutes, one
  // ledger line. A finisher's keeps its own code, same value.
  if (isFinisher) {
    ledger.push({ code: 'minutes.subAppearance', label: 'Appearance as finisher', points: SUB_APPEARANCE });
  } else {
    ledger.push({ code: 'minutes.appearance', label: 'Appearance', count: stats.minutes, points: APPEARANCE });
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

  // --- decisive-moment multiplier. Finisher slots only, goal and assist
  // events only (v0.5.0 P6a — attacking mechanic by ruling).
  if (isFinisher) {
    const decisiveBasis = events
      .filter((event) => event.minute >= (entryMinute as number))
      .filter((event) => event.minute > DECISIVE_MOMENT_AFTER_MINUTE)
      .filter((event) => DECISIVE_KINDS.includes(event.kind))
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
        note: 'goals and assists only — an attacking mechanic by ruling (P6a); the feed carries no clock for defensive actions or penalty saves',
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
    const delta = crowdDelta(total, crowdFactor);
    ledger.push({
      code: 'crowd',
      label: 'Crowd multiplier',
      factor: clean(crowdMultiplier(total, crowdFactor)),
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

/** The signed multiplier a crowd factor applies to a base. Mirrors below zero. */
function crowdMultiplier(base: number, crowdFactor: number): number {
  return base >= 0 ? 1 + crowdFactor : 1 - crowdFactor;
}

/** The crowd factor's contribution to a base — the ledger line's `points`. */
function crowdDelta(base: number, crowdFactor: number): number {
  return clean(base * (crowdMultiplier(base, crowdFactor) - 1));
}

/**
 * base + the crowd factor's contribution — SCORING_SPEC §Crowd multiplier:
 *
 *     final = base >= 0 ? base x (1 + f) : base x (1 - f)
 *
 * Exported and used by `scorePlayer` itself, so the ONE definition of this
 * expression serves both callers. FW-4 R5 stores `baseScore` and `crowdFactor`
 * separately and derives the total on read; a second copy of the mirroring rule
 * living in the read path is exactly the drift this avoids — and the mirroring
 * is the subtle half (a positive crowd verdict must shrink a negative score
 * toward zero, never deepen it).
 */
export function applyCrowdFactor(base: number, crowdFactor: number): number {
  if (crowdFactor === 0) return base;
  return clean(base + crowdDelta(base, crowdFactor));
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
  // v0.5.0 §Rounding names the rule explicitly ("ties rounded away from zero,
  // −5.75 → −5.8, 5.75 → 5.8"); this implements that spec text.
  const scaled = points * 10;
  const magnitude = Math.round(Math.abs(scaled));
  const rounded = (scaled < 0 ? -magnitude : magnitude) / 10;
  // Normalising the zero keeps "-0.0" off a leaderboard.
  return (rounded === 0 ? 0 : rounded).toFixed(1);
}

/**
 * Point value of a single timed event in a given slot, for the decisive basis.
 * Only DECISIVE_KINDS can reach this (P6a); anything else values at 0, so even
 * a future widening of the filter list could not silently multiply a penalty.
 */
function timedEventValue(kind: TimedEventKind, slot: Slot): number {
  switch (kind) {
    case 'goal':
      return GOAL_POINTS[slot];
    case 'assist':
      return ASSIST_POINTS[slot];
    default:
      return 0;
  }
}
