/**
 * Scoring inputs and ledger shape for SCORING_SPEC.md v0.3.
 *
 * Pure data. No I/O, no dependency on `fetch/`, no dependency on THE DRAW.
 */

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
