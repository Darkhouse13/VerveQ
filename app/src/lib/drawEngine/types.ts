/**
 * THE DRAW — frozen v0 contract.
 *
 * Everything in the engine, the sim harness, and (later) the UI imports its
 * shapes from this file. Breaking changes to this file mid-build are a
 * STOP-and-report event (see DECISIONS.md).
 *
 * Design invariants:
 * - A board is FULLY derived from (boardSeed, cardSet, EngineConfig). No I/O,
 *   no wall clock, no ambient randomness anywhere in the engine.
 * - All card content is synthetic (generated fake names, CLUB_A-style tag
 *   vocabularies). No real-world players, clubs, or managers.
 * - The whole gauntlet (fixtures F1..F5, their archetypes/modifiers AND
 *   thresholds) is visible from board start: it is part of BoardSpec.
 * - Form is derived from (boardSeed, cardId, roundIndex) only — never from
 *   user identity or user choices. Same card ⇒ same form for every user on
 *   the same board.
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

/** Threshold curve: threshold(i) = round(base * growth^i), boss ×bossMult. */
export interface ThresholdConfig {
  base: number;
  growth: number;
  bossMult: number;
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
   * that length in a family. Lengths beyond the last entry clamp to it;
   * missing/short entries mean ×1. Default: 3→1.5, 4→2.0, 5→2.5, 6→3.0.
   */
  synergyTable: number[];
  /** Hard cap on synergy families (ties to the layout meter budget). */
  maxSynergyFamilies: number;
  thresholds: ThresholdConfig;
  /** Archetype knob table boards sample their fixtures from. */
  archetypes: FixtureArchetype[];
  cardGen: CardGenConfig;
}

/** One user decision. Draft rows take picks; cleared rounds take bank/push. */
export type Choice =
  | { type: "pick"; offerIndex: number }
  | { type: "bank" }
  | { type: "push" };

/** The complete decision record of a run. replay(board, config, log) ⇒ identical RunResult. */
export type ChoiceLog = Choice[];

export type RunPhase = "draft" | "decision" | "done";
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
  /** Σ contributions before synergy. */
  baseSum: number;
  /** Families that granted a multiplier (chain ≥ first table entry > 1). */
  synergies: SynergyBreakdown[];
  /** Product of granted family multipliers. */
  synergyMult: number;
  score: number;
  cleared: boolean;
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
  /** Fixture just played (decision phase) / next to play (end of draft). */
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
