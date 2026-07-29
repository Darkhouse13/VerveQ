import { describe, expect, it } from 'vitest';
import { formatPoints, scorePlayer } from '../scoring/scoring.ts';
import {
  emptyStats,
  type FieldedSlot,
  type MatchContext,
  type PlayerMatchStats,
  type ScoringInput,
  type Slot,
  type TimedPlayerEvent,
} from '../scoring/types.ts';

/**
 * Hand-computed acceptance cases for SCORING_SPEC.md v0.4.1.
 *
 * Every expected number below was worked out on paper from the spec text first
 * and is shown as an addition in the comment above its assertion. None was
 * produced by running the function and pasting the result — that would assert
 * only that the code does what it does.
 *
 * Cases 14, 16, 17 and 20 are re-pinned from v0.3 to the v0.4 gap rulings;
 * cases 22-26 cover the rulings that had no v0.3 equivalent; case 20 was
 * re-pinned again and case 27 added for the v0.4.1 crowd mirror.
 */

function ctx(overrides: Partial<MatchContext> = {}): MatchContext {
  return { teamGoalsFor: 0, teamGoalsAgainst: 0, result: 'draw', ...overrides };
}

function input(
  stats: Partial<PlayerMatchStats>,
  context: MatchContext,
  events: readonly TimedPlayerEvent[] = [],
): ScoringInput {
  return { stats: emptyStats(stats), context, events };
}

const starter = (position: Slot): FieldedSlot => ({ position, role: 'starter' });
const finisher = (position: Slot): FieldedSlot => ({ position, role: 'finisher' });

/** The ledger must reconstruct the total by addition alone (v0.3 §Legibility). */
function expectLedgerReconciles(result: { points: number; ledger: readonly { points: number }[] }): void {
  const summed = result.ledger.reduce((sum, entry) => sum + entry.points, 0);
  expect(summed).toBeCloseTo(result.points, 9);
}

describe('GK template', () => {
  it('case 1 — clean sheet, saves under the cap, win', () => {
    // minutes 60+        +2
    // team win (60+)     +2
    // saves 5 x 0.5      +2.5   (cap 4, not binding)
    // clean sheet GK     +5
    // conceded 0 -> floor(0/2) = 0
    //                  = 11.5
    const result = scorePlayer(
      input({ minutes: 90, saves: 5 }, ctx({ teamGoalsFor: 2, teamGoalsAgainst: 0, result: 'win' })),
      starter('GK'),
      'GK',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(11.5, 9);
    expectLedgerReconciles(result);
  });

  it('case 2 — save cap binds, penalty saved, two goals conceded', () => {
    // minutes 60+                    +2
    // loss                            0
    // saves 12 x 0.5 = 6 -> cap      +4
    // clean sheet                     0  (conceded 3)
    // conceded 3 -> floor(3/2) = 1   -1
    // penalty saved 1 x 6            +6
    //                              = 11
    const result = scorePlayer(
      input({ minutes: 90, saves: 12, penaltiesSaved: 1 }, ctx({ teamGoalsAgainst: 3, result: 'loss' })),
      starter('GK'),
      'GK',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(11, 9);
    expectLedgerReconciles(result);
  });
});

describe('DEF template', () => {
  it('case 3 — clean sheet, duel bonus, no cap binding', () => {
    // minutes 60+           +2
    // win                   +2
    // clean sheet DEF       +4
    // tackles 5 x 0.4       +2      (cap 3)
    // interceptions 4 x 0.6 +2.4    (cap 3)
    // blocks 3 x 0.5        +1.5    (cap 2)
    // duels 7/10 = 70% >= 60% on 10 >= 6 contested  +2
    //                     = 15.9
    const result = scorePlayer(
      input(
        { minutes: 90, tackles: 5, interceptions: 4, blocks: 3, duelsWon: 7, duelsTotal: 10 },
        ctx({ teamGoalsFor: 1, teamGoalsAgainst: 0, result: 'win' }),
      ),
      starter('DEF'),
      'DEF',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(15.9, 9);
    expectLedgerReconciles(result);
  });

  it('case 4 — every cap binds, duel rate just under the cliff', () => {
    // minutes 60+                          +2
    // loss                                  0
    // tackles 10 x 0.4 = 4      -> cap 3   +3
    // interceptions 8 x 0.6 = 4.8 -> cap 3 +3
    // blocks 6 x 0.5 = 3        -> cap 2   +2
    // duels 5/9 = 55.6% < 60%               0
    // conceded 4 -> floor(4/2) = 2         -2
    //                                    = 8
    const result = scorePlayer(
      input(
        { minutes: 90, tackles: 10, interceptions: 8, blocks: 6, duelsWon: 5, duelsTotal: 9 },
        ctx({ teamGoalsAgainst: 4, result: 'loss' }),
      ),
      starter('DEF'),
      'DEF',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(8, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'def.duels')).toBeUndefined();
  });

  it('case 5 — duel threshold is inclusive at exactly 60%', () => {
    // minutes 60+                        +2
    // draw                               +1
    // duels 6/10 = exactly 60% on 10     +2
    // conceded 1 -> floor(1/2) = 0        0
    //                                  = 5
    const result = scorePlayer(
      input({ minutes: 90, duelsWon: 6, duelsTotal: 10 }, ctx({ teamGoalsAgainst: 1, result: 'draw' })),
      starter('DEF'),
      'DEF',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(5, 9);
    expectLedgerReconciles(result);
  });
});

describe('MID template', () => {
  it('case 6 — the destroyer: combined defensive cap binds, pass bonus pays', () => {
    // minutes 60+                                 +2
    // win                                         +2
    // (tackles 6 + interceptions 5) = 11 x 0.5
    //   = 5.5 -> combined cap 4                   +4
    // key passes 0                                 0
    // dribbles 1 x 0.5                            +0.5  (cap 2)
    // completion 74/80 = 92.5% >= 88% on 80 >= 40 +2
    // clean sheet MID                             +1
    //                                           = 11.5
    const result = scorePlayer(
      input(
        { minutes: 90, tackles: 6, interceptions: 5, dribblesCompleted: 1, passesTotal: 80, passesAccurate: 74 },
        ctx({ teamGoalsFor: 3, teamGoalsAgainst: 0, result: 'win' }),
      ),
      starter('MID'),
      'MID',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(11.5, 9);
    expectLedgerReconciles(result);
  });

  it('case 7 — pass completion just under the cliff', () => {
    // minutes 60+                          +2
    // loss                                  0
    // (2 + 1) = 3 x 0.5                    +1.5
    // key passes 3 x 0.8                   +2.4  (cap 4)
    // completion 43/50 = 86% < 88%          0
    // clean sheet: conceded 2               0
    //                                    = 5.9
    const result = scorePlayer(
      input(
        { minutes: 90, tackles: 2, interceptions: 1, keyPasses: 3, passesTotal: 50, passesAccurate: 43 },
        ctx({ teamGoalsAgainst: 2, result: 'loss' }),
      ),
      starter('MID'),
      'MID',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(5.9, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'mid.passCompletion')).toBeUndefined();
  });

  it('case 8 — 100% completion still fails the >= 40 total-passes gate', () => {
    // minutes 60+                       +2
    // win                               +2
    // key passes 6 x 0.8 = 4.8 -> cap 4 +4
    // completion 39/39 = 100% but 39 < 40 total  0
    // clean sheet MID                   +1
    //                                 = 9
    const result = scorePlayer(
      input(
        { minutes: 90, keyPasses: 6, passesTotal: 39, passesAccurate: 39 },
        ctx({ teamGoalsFor: 1, teamGoalsAgainst: 0, result: 'win' }),
      ),
      starter('MID'),
      'MID',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(9, 9);
    expectLedgerReconciles(result);
  });
});

describe('ATT template', () => {
  it('case 9 — brace plus assist, shot cap binds', () => {
    // minutes 60+                        +2
    // goals 2 x 5 (ATT)                 +10
    // assists 1 x 3 (ATT)                +3
    // win                                +2
    // shots on 5 x 0.5 = 2.5 -> cap 2    +2
    // key passes 2 x 0.8                 +1.6  (cap 4)
    // dribbles 4 x 0.5                   +2    (cap 3)
    // conceded 2: ATT takes no negative   0
    //                                  = 22.6
    const result = scorePlayer(
      input(
        { minutes: 90, goals: 2, assists: 1, shotsOn: 5, keyPasses: 2, dribblesCompleted: 4 },
        ctx({ teamGoalsFor: 3, teamGoalsAgainst: 2, result: 'win' }),
      ),
      starter('ATT'),
      'ATT',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(22.6, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'att.cleanSheet')).toBeUndefined();
  });

  it('case 10 — under 60 minutes forfeits the win points', () => {
    // minutes 1-59            +1
    // goals 1 x 5             +5
    // win but minutes < 60     0
    // shots on 2 x 0.5        +1
    //                       = 7
    const result = scorePlayer(
      input({ minutes: 45, goals: 1, shotsOn: 2 }, ctx({ teamGoalsFor: 1, teamGoalsAgainst: 0, result: 'win' })),
      starter('ATT'),
      'ATT',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(7, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'result.win')).toBeUndefined();
  });
});

describe('finishers', () => {
  it('case 11 — pre-75 assist and post-75 goal; only the goal is multiplied', () => {
    // Came on at 60', played 30 minutes.
    // appearance as finisher      +1
    // goal (82') 1 x 5 (ATT)      +5
    // assist (70') 1 x 3          +3
    // win but minutes 30 < 60      0
    // shots on 1 x 0.5            +0.5
    //   base                     = 9.5
    // closer: post-75 positive timed events = the 82' goal, worth 5
    //         delta = 5 x 0.25   +1.25
    //                          = 10.75
    const events: TimedPlayerEvent[] = [
      { minute: 70, kind: 'assist' },
      { minute: 82, kind: 'goal' },
    ];
    const result = scorePlayer(
      input(
        { minutes: 30, goals: 1, assists: 1, shotsOn: 1, wasSubstitute: true },
        ctx({ teamGoalsFor: 2, teamGoalsAgainst: 1, result: 'win' }),
        events,
      ),
      finisher('ATT'),
      'ATT',
      60,
      0,
    );
    expect(result.points).toBeCloseTo(10.75, 9);
    expectLedgerReconciles(result);
    const decisive = result.ledger.find((e) => e.code === 'finisher.decisiveMoment');
    expect(decisive?.raw).toBeCloseTo(5, 9);
    expect(decisive?.points).toBeCloseTo(1.25, 9);
  });

  it('case 12 — an event before the entry minute does not count', () => {
    // Came on at 70', played 20 minutes.
    // The 65' yellow belongs to the match but predates entry, so it is excluded
    // by v0.3 §Finishers "only from events after their entry minute".
    // appearance as finisher   +1
    // goal (80') 1 x 6 (MID)   +6
    // yellow (65') excluded     0
    // minutes 20 < 60           0
    //   base                  = 7
    // closer: 80' goal worth 6, delta = 6 x 0.25  +1.5
    //                                           = 8.5
    const events: TimedPlayerEvent[] = [
      { minute: 65, kind: 'yellowCard' },
      { minute: 80, kind: 'goal' },
    ];
    const result = scorePlayer(
      input(
        { minutes: 20, goals: 1, yellowCards: 1, wasSubstitute: true },
        ctx({ teamGoalsFor: 1, teamGoalsAgainst: 1, result: 'draw' }),
        events,
      ),
      finisher('MID'),
      'MID',
      70,
      0,
    );
    expect(result.points).toBeCloseTo(8.5, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'cards.yellow')).toBeUndefined();
  });

  it('case 13 — an unused finisher scores exactly zero, with no participation floor', () => {
    const result = scorePlayer(
      input({ minutes: 0 }, ctx({ teamGoalsFor: 4, teamGoalsAgainst: 0, result: 'win' })),
      finisher('DEF'),
      'DEF',
      null,
      0,
    );
    expect(result.points).toBe(0);
    expect(result.ledger).toHaveLength(1);
    expect(result.ledger[0].code).toBe('finisher.unused');
  });

  it('case 14 — the decisive-moment multiplier reaches only timestamped events (G3)', () => {
    // Came on at 70'. Six tackles' worth of work in the last twenty minutes
    // earns no bonus, because the feed does not timestamp tackles. Only the
    // 88' penalty won can be placed after the 75th minute.
    // appearance                        +1
    // penalty won (88') 1 x 2           +2
    // minutes 20 < 60                    0
    // tackles 6 x 0.4 = 2.4             +2.4  (DEF cap 3)
    // conceded: 20 < 60 min, no penalty  0    (v0.4 G2)
    //   base                           = 5.4
    // decisive basis = 2 (the penalty only), delta = 2 x 0.25  +0.5
    //                                                        = 5.9
    const events: TimedPlayerEvent[] = [{ minute: 88, kind: 'penaltyWon' }];
    const result = scorePlayer(
      input(
        { minutes: 20, tackles: 6, penaltiesWon: 1, wasSubstitute: true },
        ctx({ teamGoalsFor: 1, teamGoalsAgainst: 1, result: 'draw' }),
        events,
      ),
      finisher('DEF'),
      'DEF',
      70,
      0,
    );
    expect(result.points).toBeCloseTo(5.9, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'finisher.decisiveMoment')?.raw).toBeCloseTo(2, 9);
  });

  it('case 22 — an event in the entry minute itself counts (v0.4 G4, inclusive)', () => {
    // Came on at 60' and scored in the 60th minute. Under v0.3's exclusive
    // reading this goal was thrown away; v0.4 counts it.
    // appearance            +1
    // goal (60') 1 x 5      +5
    // minutes 30 < 60        0
    //   base               = 6
    // decisive: 60' is not after the 75th minute, so no multiplier
    //                      = 6
    const events: TimedPlayerEvent[] = [{ minute: 60, kind: 'goal' }];
    const result = scorePlayer(
      input(
        { minutes: 30, goals: 1, wasSubstitute: true },
        ctx({ teamGoalsFor: 1, teamGoalsAgainst: 1, result: 'draw' }),
        events,
      ),
      finisher('ATT'),
      'ATT',
      60,
      0,
    );
    expect(result.points).toBeCloseTo(6, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'goals')?.count).toBe(1);
  });
});

describe('position mismatch', () => {
  it('case 15 — the 0.75 dampener on a positive score', () => {
    // Fielded DEF, verdict MID.
    // minutes 60+       +2
    // win               +2
    // clean sheet DEF   +4
    // tackles 5 x 0.4   +2
    //   base          = 10
    // mismatch: 10 x 0.75 = 7.5
    const result = scorePlayer(
      input({ minutes: 90, tackles: 5 }, ctx({ teamGoalsFor: 1, teamGoalsAgainst: 0, result: 'win' })),
      starter('DEF'),
      'MID',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(7.5, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'mismatch.dampener')?.points).toBeCloseTo(-2.5, 9);
  });

  it('case 16 — a negative base passes through the mismatch undamped (v0.4 G5)', () => {
    // Fielded DEF, verdict ATT.
    // minutes 60+                    +2
    // loss                            0
    // conceded 4 -> floor(4/2) = 2   -2   (90 min, so the 60+ gate is met)
    // yellow                         -1
    // red                            -4
    //   base                       = -5
    // mismatch: base is negative, so x0.75 does NOT apply. -5 passes through.
    const result = scorePlayer(
      input({ minutes: 90, yellowCards: 1, redCards: 1 }, ctx({ teamGoalsAgainst: 4, result: 'loss' })),
      starter('DEF'),
      'ATT',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(-5, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'mismatch.dampener')?.points).toBe(0);
    expect(result.ledger.find((e) => e.code === 'mismatch.dampener')?.note).toContain('undamped');
  });

  it('case 17 — mis-slotting never outscores correct slotting (v0.4 G5)', () => {
    // Identical stats to case 16, fielded DEF with verdict DEF: base -5 again.
    //
    // Under v0.3 these two diverged (-5 correct vs 0 mis-slotted), so holding a
    // sent-off player made deliberate mis-slotting worth +5. v0.4 removes the
    // floor, and the pair now agree — which is the property the ruling asks for.
    const wrong = scorePlayer(
      input({ minutes: 90, yellowCards: 1, redCards: 1 }, ctx({ teamGoalsAgainst: 4, result: 'loss' })),
      starter('DEF'),
      'ATT',
      null,
      0,
    );
    const right = scorePlayer(
      input({ minutes: 90, yellowCards: 1, redCards: 1 }, ctx({ teamGoalsAgainst: 4, result: 'loss' })),
      starter('DEF'),
      'DEF',
      null,
      0,
    );
    expect(right.points).toBeCloseTo(-5, 9);
    expect(wrong.points).toBeLessThanOrEqual(right.points);
    expectLedgerReconciles(right);
  });
});

describe('crowd multiplier', () => {
  it('case 18 — +15% and -15% clamp ends applied to the same base', () => {
    // Case 1's goalkeeper, base 11.5.
    //   +15%: 11.5 x 1.15 = 13.225
    //   -15%: 11.5 x 0.85 =  9.775
    const build = (crowd: number) =>
      scorePlayer(
        input({ minutes: 90, saves: 5 }, ctx({ teamGoalsFor: 2, teamGoalsAgainst: 0, result: 'win' })),
        starter('GK'),
        'GK',
        null,
        crowd,
      );

    expect(build(0.15).points).toBeCloseTo(13.225, 9);
    expect(build(-0.15).points).toBeCloseTo(9.775, 9);
    expect(build(0).points).toBeCloseTo(11.5, 9);
    expectLedgerReconciles(build(0.15));
    expectLedgerReconciles(build(-0.15));
  });

  it('case 19 — crowd applies after the mismatch dampener, not before', () => {
    // Case 15's base 10, damped to 7.5, then +10%: 7.5 x 1.1 = 8.25.
    // Applying crowd first would give 10 x 1.1 x 0.75 = 8.25 as well, so the
    // orders coincide for a positive score — but not once the zero floor bites,
    // which is why the order is pinned here and in case 20.
    const result = scorePlayer(
      input({ minutes: 90, tackles: 5 }, ctx({ teamGoalsFor: 1, teamGoalsAgainst: 0, result: 'win' })),
      starter('DEF'),
      'MID',
      null,
      0.1,
    );
    expect(result.points).toBeCloseTo(8.25, 9);
    expectLedgerReconciles(result);
  });

  it('case 20 — a positive crowd factor shrinks a negative base toward zero (v0.4.1)', () => {
    // Case 16's base is -5 and survives the mismatch undamped, so the crowd
    // factor lands on a negative number. v0.4.1 mirrors it:
    //   base < 0  ->  base x (1 - f) = -5 x (1 - 0.15) = -5 x 0.85 = -4.25
    //
    // Under v0.4 this was -5.75: a player the crowd LIKED, who was sent off, was
    // punished harder for being liked. The mirror removes that.
    const result = scorePlayer(
      input({ minutes: 90, yellowCards: 1, redCards: 1 }, ctx({ teamGoalsAgainst: 4, result: 'loss' })),
      starter('DEF'),
      'ATT',
      null,
      0.15,
    );
    expect(result.points).toBeCloseTo(-4.25, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'crowd')?.note).toContain('mirrored');
  });

  it('case 27 — the crowd factor is a judgment direction on both signs (v0.4.1)', () => {
    // Same -5 base at both clamp ends:
    //   f = +0.15  ->  -5 x (1 - 0.15) = -4.25   approval shrinks the deficit
    //   f = -0.15  ->  -5 x (1 + 0.15) = -5.75   disapproval deepens it
    //
    // And the positive-base direction is unchanged, so the mirror does not flip
    // the meaning of the factor for a player who scored well:
    //   base 11.5, f = +0.15 -> 13.225  (case 18)
    const negative = (crowd: number) =>
      scorePlayer(
        input({ minutes: 90, yellowCards: 1, redCards: 1 }, ctx({ teamGoalsAgainst: 4, result: 'loss' })),
        starter('DEF'),
        'DEF',
        null,
        crowd,
      );

    expect(negative(0.15).points).toBeCloseTo(-4.25, 9);
    expect(negative(-0.15).points).toBeCloseTo(-5.75, 9);
    expect(negative(0).points).toBeCloseTo(-5, 9);

    // The invariant the ruling asks for: a higher crowd verdict is never worse,
    // whatever the sign of the base.
    expect(negative(0.15).points).toBeGreaterThan(negative(-0.15).points);
    const positive = (crowd: number) =>
      scorePlayer(
        input({ minutes: 90, saves: 5 }, ctx({ teamGoalsFor: 2, teamGoalsAgainst: 0, result: 'win' })),
        starter('GK'),
        'GK',
        null,
        crowd,
      );
    expect(positive(0.15).points).toBeGreaterThan(positive(-0.15).points);
    expectLedgerReconciles(negative(0.15));
  });
});

describe('60-minute qualifiers (v0.4 G1/G2)', () => {
  it('case 23 — a sub-60 defender collects no clean sheet', () => {
    // minutes 1-59                              +1
    // win but minutes < 60                       0
    // clean sheet requires 60+ minutes           0
    // tackles 3 x 0.4                           +1.2
    //                                         = 2.2
    const result = scorePlayer(
      input({ minutes: 45, tackles: 3 }, ctx({ teamGoalsFor: 2, teamGoalsAgainst: 0, result: 'win' })),
      starter('DEF'),
      'DEF',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(2.2, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'def.cleanSheet')).toBeUndefined();
  });

  it('case 24 — a sub-60 defender also escapes the concession penalty', () => {
    // Same 45 minutes, but the team ships four.
    // minutes 1-59                              +1
    // loss                                       0
    // concession penalty requires 60+ minutes    0   (would have been -2)
    // tackles 3 x 0.4                           +1.2
    //                                         = 2.2
    //
    // The two rulings are symmetric on purpose: a short appearance neither earns
    // the clean sheet nor wears the concessions.
    const result = scorePlayer(
      input({ minutes: 45, tackles: 3 }, ctx({ teamGoalsAgainst: 4, result: 'loss' })),
      starter('DEF'),
      'DEF',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(2.2, 9);
    expectLedgerReconciles(result);
    expect(result.ledger.find((e) => e.code === 'def.conceded')).toBeUndefined();
  });

  it('case 25 — a goalkeeper on exactly 60 minutes qualifies for both', () => {
    // The gate is >= 60, so 60 exactly is inside it.
    // minutes 60+           +2
    // draw                  +1
    // saves 4 x 0.5         +2
    // clean sheet GK        +5
    //                     = 10
    const result = scorePlayer(
      input({ minutes: 60, saves: 4 }, ctx({ teamGoalsFor: 0, teamGoalsAgainst: 0, result: 'draw' })),
      starter('GK'),
      'GK',
      null,
      0,
    );
    expect(result.points).toBeCloseTo(10, 9);
    expectLedgerReconciles(result);
  });
});

describe('display rounding (v0.4 G6)', () => {
  it('case 26 — the engine returns unrounded, display rounds to 1 dp', () => {
    // Case 3's defender scores 15.9 exactly; case 7's midfielder 5.9.
    // formatPoints is display-only and must never be used before comparing.
    expect(formatPoints(15.9)).toBe('15.9');
    expect(formatPoints(5.94)).toBe('5.9');
    expect(formatPoints(5.95)).toBe('6.0');
    // Ties round away from zero, symmetrically. -5.75 is reachable (case 20).
    expect(formatPoints(-5.75)).toBe('-5.8');
    expect(formatPoints(5.75)).toBe('5.8');
    // -0.04 must not render as "-0.0" on a leaderboard.
    expect(formatPoints(-0.04)).toBe('0.0');
    // Two scores 0.04 apart are distinct to the engine even though they display
    // identically — which is exactly why ranking must use the raw value.
    expect(formatPoints(7.01)).toBe(formatPoints(7.04));
    expect(7.01).not.toBe(7.04);
  });
});

describe('determinism', () => {
  it('case 21 — identical inputs give identical output, ledger included', () => {
    const build = () =>
      scorePlayer(
        input(
          { minutes: 90, goals: 1, assists: 2, tackles: 4, interceptions: 3, keyPasses: 5, passesTotal: 60, passesAccurate: 55, duelsWon: 8, duelsTotal: 12 },
          ctx({ teamGoalsFor: 3, teamGoalsAgainst: 1, result: 'win' }),
        ),
        starter('MID'),
        'MID',
        null,
        0.07,
      );
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });
});
