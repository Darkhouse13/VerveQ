import { describe, expect, it } from 'vitest';
import {
  entryMinute,
  eventMinute,
  incomingPlayerId,
  isSubstitution,
  outgoingPlayerId,
  type MatchEvent,
} from '../../../app/convex/lib/fantasyFeedStats.ts';

/**
 * Guards the single most dangerous misreading available in this feed.
 *
 * The rows below are copied verbatim from probe fixture 1208070 (Premier League
 * 2024, Regular Season - 5, West Ham v Chelsea), with the per-player `minutes`
 * and `substitute` values from the matching `fixtures/players` response recorded
 * alongside as the evidence for which side is which. They are frozen here rather
 * than read from `data/` so the test runs on a clean checkout, where the sample
 * is absent by design (`data/` is gitignored).
 */

interface SubstCase {
  readonly event: MatchEvent;
  /** From fixtures/players, for the id in `event.player`. */
  readonly playerField: { minutes: number; substitute: boolean };
  /** From fixtures/players, for the id in `event.assist`. */
  readonly assistField: { minutes: number; substitute: boolean };
}

const SUBSTITUTIONS: readonly SubstCase[] = [
  {
    event: {
      time: { elapsed: 38, extra: null },
      type: 'subst',
      detail: 'Substitution 1',
      player: { id: 2476, name: 'G. Rodríguez' },
      assist: { id: 1243, name: 'T. Souček' },
    },
    playerField: { minutes: 38, substitute: false },
    assistField: { minutes: 52, substitute: true },
  },
  {
    event: {
      time: { elapsed: 54, extra: null },
      type: 'subst',
      detail: 'Substitution 2',
      player: { id: 37724, name: 'C. Summerville' },
      assist: { id: 18819, name: 'M. Antonio' },
    },
    playerField: { minutes: 54, substitute: false },
    assistField: { minutes: 36, substitute: true },
  },
  {
    event: {
      time: { elapsed: 54, extra: null },
      type: 'subst',
      detail: 'Substitution 3',
      player: { id: 2869, name: 'E. Álvarez' },
      assist: { id: 930, name: 'Carlos Soler' },
    },
    playerField: { minutes: 54, substitute: false },
    assistField: { minutes: 36, substitute: true },
  },
];

describe('subst event semantics', () => {
  it('reads the incoming player from the assist field, not the player field', () => {
    for (const { event } of SUBSTITUTIONS) {
      expect(incomingPlayerId(event)).toBe(event.assist.id);
      expect(incomingPlayerId(event)).not.toBe(event.player.id);
      expect(outgoingPlayerId(event)).toBe(event.player.id);
    }
  });

  it('is corroborated by the substitute flag on the matching player rows', () => {
    // The feed's own answer to "who came on": exactly one side of each event is
    // flagged as a substitute, and it is always the assist side.
    for (const { assistField, playerField } of SUBSTITUTIONS) {
      expect(assistField.substitute).toBe(true);
      expect(playerField.substitute).toBe(false);
    }
  });

  it('is corroborated by minutes played on the matching player rows', () => {
    // The outgoing player's total minutes equal the substitution minute; the
    // incoming player's are the remainder of the match. This is the arithmetic
    // that makes the direction unambiguous rather than a naming convention.
    for (const { event, playerField, assistField } of SUBSTITUTIONS) {
      const minute = event.time.elapsed as number;
      expect(playerField.minutes).toBe(minute);
      expect(assistField.minutes).toBeGreaterThanOrEqual(90 - minute);
    }
  });

  it('finds a finisher entry minute, and returns null for a starter', () => {
    const events = SUBSTITUTIONS.map((c) => c.event);
    // Souček came on at 38'.
    expect(entryMinute(events, 1243)).toBe(38);
    // Antonio at 54'.
    expect(entryMinute(events, 18819)).toBe(54);
    // Rodríguez went OFF at 38' — he started, so he has no entry minute. Null,
    // never 0: SCORING_SPEC §Finishers scores only events after entry, and 0
    // would credit a finisher with the entire match.
    expect(entryMinute(events, 2476)).toBeNull();
    // Someone not in this fixture at all.
    expect(entryMinute(events, 999_999)).toBeNull();
  });

  it('counts stoppage time toward the event minute', () => {
    // A 90+4' event must land after the 75' boundary at 94, not at 90.
    const stoppage: MatchEvent = {
      time: { elapsed: 90, extra: 4 },
      type: 'Goal',
      detail: 'Normal Goal',
      player: { id: 1, name: 'x' },
      assist: { id: null, name: null },
    };
    expect(eventMinute(stoppage)).toBe(94);
    expect(eventMinute(SUBSTITUTIONS[0].event)).toBe(38);
  });

  it('ignores non-substitution events', () => {
    const goal: MatchEvent = {
      time: { elapsed: 4, extra: null },
      type: 'Goal',
      detail: 'Normal Goal',
      player: { id: 283058, name: 'N. Jackson' },
      assist: { id: 18, name: 'J. Sancho' },
    };
    // A goal also populates `assist` — with the assister. Treating that as an
    // incoming substitute is the same bug in a different costume.
    expect(isSubstitution(goal)).toBe(false);
    expect(incomingPlayerId(goal)).toBeNull();
    expect(outgoingPlayerId(goal)).toBeNull();
  });
});
