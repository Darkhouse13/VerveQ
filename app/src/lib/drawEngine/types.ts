/**
 * THE DRAW — CONTRACT v1.1 (v1.0 frozen at Ticket 0.4, tag draw-engine-v1.0;
 * v1.1 adds the OWNER-SANCTIONED additive hint knob, Ticket G).
 *
 * Everything in the engine, the sim harness, and (later) the UI imports its
 * shapes from this file. v1.0 closed breaking changes: the contract may only
 * grow by ADDITIVE knobs, and only by owner ticket (see DECISIONS.md).
 * v1.1 additions (Ticket G): `EngineConfig.hints` (optional — omitting it
 * reproduces v1.0 bit-for-bit) and the formHint module (hints.ts). Hints are
 * design-public PRE-round; the realized form stays post-resolution only.
 * Ticket G2 addition (additive under v1.1): `EngineConfig.clearance` — the
 * coarse SAFE/TIGHT/LONGSHOT clearance-signal bucket cutoffs (clearance.ts),
 * computed from the same design-public inputs as the F3 band.
 *
 * Design invariants:
 * - P0-RUNTIME (CONTRACT INVARIANT, Ticket 0.4): production serving MUST
 *   pass detectDeadBoard — a dead board (no draft line can full-clear) is
 *   never served to players. Dead seed ⇒ deterministic reroll chain: the
 *   served board index is the first non-dead k in hash(dateSeed, k) for
 *   k = 0, 1, 2, …; a pure function of the date seed, so every user gets the
 *   same board (leaderboard fairness preserved). The player-facing dead-board
 *   rate is therefore 0% by construction. Implementation lands in the Convex
 *   serving ticket; the invariant binds from v1.0.
 * - A board is FULLY derived from (boardSeed, cardSet, EngineConfig). No I/O,
 *   no wall clock, no ambient randomness anywhere in the engine.
 * - All card content is synthetic (generated fake names, CLUB_A-style tag
 *   vocabularies). No real-world players, clubs, or managers.
 * - The whole gauntlet (fixtures F1..F5, their archetypes/modifiers AND
 *   thresholds) is visible from board start: it is part of BoardSpec.
 * - Form is derived from (boardSeed, cardId, roundIndex) only — never from
 *   user identity or user choices. Same card ⇒ same form for every user on
 *   the same board.
 * - MATCHDAY BENCH (Ticket 0.2 A1, final contract change): every round, before
 *   the reveal, exactly one squad card is benched; the remaining fielded cards
 *   score. The bench pick is an explicit per-round `bench` entry in ChoiceLog,
 *   and synergy chains are computed on the fielded cards only (A2).
 */

export type PositionId = "GK" | "DEF" | "MID" | "ATT";

/** Tag families that participate in synergy chains. Position is excluded in v0. */
export type SynergyFamily = "club" | "nation" | "era";

export const SYNERGY_FAMILIES: readonly SynergyFamily[] = ["club", "nation", "era"];

/** A synthetic player card. All tags come from generated vocabularies. */
export interface Card {
  /** Stable id within a card set, e.g. "CARD_017". */
  id: string;
  /** Generated fake name — never a real person. */
  name: string;
  /** Integer rating, EngineConfig.cardGen.ratingMin..ratingMax (60..95 default). */
  rating: number;
  /** 1..3 club tags, e.g. "CLUB_A". */
  clubs: string[];
  /** Exactly one nation tag, e.g. "NATION_C". */
  nation: string;
  /** Exactly one era bucket label, e.g. "ERA_1990s". */
  era: string;
  /** Ordinal index of the era bucket (0 = oldest). Used by eraBefore modifiers. */
  eraIndex: number;
  position: PositionId;
}

/**
 * One conditional multiplier on a fixture. A card matches when it carries the
 * named tag (or, for eraBefore/eraAtLeast, when its eraIndex compares true).
 * A card matching several modifiers on the same fixture multiplies them all.
 */
export interface FixtureModifier {
  kind: "position" | "club" | "nation" | "era" | "eraBefore" | "eraAtLeast";
  /** Tag string for tag kinds; era bucket index bound for eraBefore/eraAtLeast. */
  value: string | number;
  mult: number;
}

/** A reusable fixture archetype from the EngineConfig knob table. */
export interface FixtureArchetype {
  /** Synthetic id, e.g. "ARCH_WALL". */
  id: string;
  modifiers: FixtureModifier[];
}

/** A concrete fixture on a board. F(index+1); the last one is the boss. */
export interface Fixture {
  index: number;
  archetypeId: string;
  modifiers: FixtureModifier[];
  /** Round score required to clear. Visible from board start. */
  threshold: number;
  isBoss: boolean;
}

/** A fully-derived board: 6 rows × 3 slot offers + the visible gauntlet. */
export interface BoardSpec {
  seed: string;
  /** rows[r][o] — the offer grid is fixed regardless of picks. */
  rows: Card[][];
  /** Fixtures in play order, thresholds included. fixtures.length = fixtureCount. */
  fixtures: Fixture[];
}

/** Knobs for the synthetic card-set generator. */
export interface CardGenConfig {
  /** Number of cards in the generated set (boards sample from it). */
  setSize: number;
  ratingMin: number;
  ratingMax: number;
  /**
   * Rating curve shape: rating = min + (max-min) * u^ratingSkew.
   * skew > 1 biases toward low ratings (high ratings rare); 1 = uniform.
   */
  ratingSkew: number;
  /** Size of each generated tag vocabulary. */
  clubCount: number;
  nationCount: number;
  eraCount: number;
  /** Weight of a card having 1, 2, 3, ... club tags (index 0 = one club). */
  clubsPerCardWeights: number[];
  positionWeights: Record<PositionId, number>;
}

/**
 * Threshold curve: threshold(i) = round(base * growth^i * shape[i]), boss
 * additionally ×bossMult. thresholdShape is an optional per-fixture multiplier
 * on the geometric curve (length = fixtureCount; omitted or short ⇒ ×1).
 * Additive knob from Ticket 0.1 — omitting it reproduces the v0 curve exactly.
 */
export interface ThresholdConfig {
  base: number;
  growth: number;
  bossMult: number;
  thresholdShape?: number[];
}

/**
 * Coarse clearance-signal buckets (Ticket G2 — ADDITIVE). SAFE reads "band
 * centre ≥ safeRatio × threshold", LONGSHOT "< longshotRatio × threshold",
 * TIGHT in between. One definition shared by UI and bots — clearance.ts.
 */
export type ClearanceSignal = "SAFE" | "TIGHT" | "LONGSHOT";

/** Bucket cutoffs, as multiples of the fixture threshold. safeRatio ≥ longshotRatio. */
export interface ClearanceConfig {
  /** Band centre at or above safeRatio × threshold reads SAFE. */
  safeRatio: number;
  /** Band centre below longshotRatio × threshold reads LONGSHOT. */
  longshotRatio: number;
}

/**
 * Form-hint knobs (Ticket G, engine v1.1 — ADDITIVE; absent ⇒ no hints, the
 * exact v1.0 game). See hints.ts for the derivation and the sanitization
 * contract.
 */
export interface HintConfig {
  /**
   * P(hint band == realized form band). 1 = always truthful, 1/3 = fully
   * uninformative. Hints are seeded from (boardSeed, cardId, roundIndex)
   * only — same board ⇒ same hints for every user (locked decision 3).
   */
  hintReliability: number;
}

/** Every gameplay number is a knob here. */
export interface EngineConfig {
  /** Draft rows (squad size). Layout cap: ≤ 6. */
  rows: number;
  /** Offers per row. Layout cap: ≤ 3. */
  offersPerRow: number;
  /** Fixtures in the gauntlet. Layout cap: ≤ 5. */
  fixtureCount: number;
  /** Form multiplier is uniform in [1-formSpread, 1+formSpread]. */
  formSpread: number;
  /** On a failed round, final = cumulative * bustKeep. */
  bustKeep: number;
  /** On clearing the boss, final = cumulative * fullClearBonus. */
  fullClearBonus: number;
  /**
   * synergyTable[chainLength] = multiplier for the largest shared-tag chain of
   * that length in a family, computed on the FIELDED cards (Ticket 0.2 A2).
   * Lengths beyond the last entry clamp to it; missing/short entries mean ×1.
   * Default: 3→1.5, 4→2.0, 5→2.5 (chains cap at the 5 fielded cards).
   */
  synergyTable: number[];
  /** Hard cap on synergy families (ties to the layout meter budget). */
  maxSynergyFamilies: number;
  thresholds: ThresholdConfig;
  /** Archetype knob table boards sample their fixtures from. */
  archetypes: FixtureArchetype[];
  cardGen: CardGenConfig;
  /**
   * Ticket G (v1.1, ADDITIVE): pre-round form hints. Omitted ⇒ hints off and
   * the config plays exactly as under v1.0.
   */
  hints?: HintConfig;
  /**
   * Ticket G2 (ADDITIVE): coarse clearance-signal bucket cutoffs
   * (see clearance.ts). Omitted ⇒ no signal (consumers fall back to
   * DEFAULT_CLEARANCE for display-only use).
   */
  clearance?: ClearanceConfig;
}

/**
 * One user decision. Draft rows take picks; each round takes a bench pick
 * (squadIndex = position in the squad array, 0-based) before it plays;
 * cleared non-boss rounds take bank/push.
 */
export type Choice =
  | { type: "pick"; offerIndex: number }
  | { type: "bench"; squadIndex: number }
  | { type: "bank" }
  | { type: "push" };

/** The complete decision record of a run. replay(board, config, log) ⇒ identical RunResult. */
export type ChoiceLog = Choice[];

export type RunPhase = "draft" | "bench" | "decision" | "done";
export type RunOutcome = "banked" | "busted" | "fullclear";

export interface CardRoundBreakdown {
  cardId: string;
  rating: number;
  form: number;
  fixtureMult: number;
  /** rating * form * fixtureMult (pre-synergy). */
  contribution: number;
}

export interface SynergyBreakdown {
  family: SynergyFamily;
  /** The tag carried by the largest chain in this family. */
  tag: string;
  chain: number;
  mult: number;
}

export interface RoundBreakdown {
  fixtureIndex: number;
  threshold: number;
  /** The squad card benched for this round (Ticket 0.2 A1). */
  benchedCardId: string;
  /** Σ fielded contributions before synergy. */
  baseSum: number;
  /** Families that granted a multiplier (chain ≥ first table entry > 1). */
  synergies: SynergyBreakdown[];
  /** Product of granted family multipliers. */
  synergyMult: number;
  score: number;
  cleared: boolean;
  /** Fielded cards only (squad minus the benched card). */
  cards: CardRoundBreakdown[];
}

/**
 * Serializable run state. Plain JSON data — JSON.parse(JSON.stringify(state))
 * must resume identically (property-tested).
 */
export interface RunState {
  boardSeed: string;
  phase: RunPhase;
  /** Next draft row to pick from (draft phase only). */
  rowIndex: number;
  /** Picked card ids, in row order. */
  squad: string[];
  /** Next fixture to play (bench phase) / fixture just played (decision phase). */
  fixtureIndex: number;
  /** Sum of cleared round scores so far. */
  cumulative: number;
  rounds: RoundBreakdown[];
  choiceLog: ChoiceLog;
  outcome: RunOutcome | null;
  finalScore: number | null;
}

export interface RunResult {
  boardSeed: string;
  finalScore: number;
  roundsCleared: number;
  outcome: RunOutcome;
  rounds: RoundBreakdown[];
  choiceLog: ChoiceLog;
}
