/**
 * Timed-event reading. Pure — no I/O, no network.
 *
 * This module exists for one reason: SCORING_SPEC §Finishers needs a
 * substitute's ENTRY minute, and the feed's `subst` event does not say
 * "incoming" anywhere. It carries two players, and the naming is a trap:
 *
 *     player  -> the player going OFF
 *     assist  -> the player coming ON
 *
 * Measured across all 10 substitutions in probe fixture 1208070: the `player`
 * row had `substitute=false` and `minutes` exactly equal to `time.elapsed`,
 * while the `assist` row had `substitute=true` and `minutes` equal to the
 * remaining match time. See `fetch/config.ts` REQUIRED_EVENT_FIELDS and
 * `reports/phase1-schema-probe-2026-07-27.md` §4.
 *
 * Reading `player` as the incoming substitute would invert every finisher score
 * in the sample and would not look wrong — the numbers would just be attached
 * to the wrong half of each substitution. Hence a named function and a test,
 * rather than a field access at the call site.
 */

export interface MatchEvent {
  readonly time: { readonly elapsed: number | null; readonly extra: number | null };
  readonly type: string;
  readonly detail: string;
  readonly player: { readonly id: number | null; readonly name: string | null };
  readonly assist: { readonly id: number | null; readonly name: string | null };
}

export function isSubstitution(event: MatchEvent): boolean {
  return event.type.toLowerCase() === 'subst';
}

/** The player coming ON. NOT `event.player` — see the module comment. */
export function incomingPlayerId(event: MatchEvent): number | null {
  if (!isSubstitution(event)) return null;
  return event.assist.id;
}

/** The player going OFF. */
export function outgoingPlayerId(event: MatchEvent): number | null {
  if (!isSubstitution(event)) return null;
  return event.player.id;
}

/**
 * Whole-minute clock position of an event, stoppage time included.
 *
 * `time.extra` is the minutes played beyond the nominal mark, so a goal at
 * "90+4" arrives as elapsed 90, extra 4 and belongs after the 75' boundary at
 * 94. Summing them keeps the post-75' comparison monotonic, which a bare
 * `elapsed` would not.
 */
export function eventMinute(event: MatchEvent): number | null {
  if (event.time.elapsed === null) return null;
  return event.time.elapsed + (event.time.extra ?? 0);
}

/**
 * Entry minute for `playerId`, or null if they were not substituted on.
 *
 * Null is the correct answer for a starter, and callers must not conflate it
 * with 0: SCORING_SPEC §Finishers scores a finisher only from events AFTER
 * their entry, and an entry minute of 0 would credit them with the whole match.
 */
export function entryMinute(events: readonly MatchEvent[], playerId: number): number | null {
  for (const event of events) {
    if (isSubstitution(event) && incomingPlayerId(event) === playerId) {
      return eventMinute(event);
    }
  }
  return null;
}
