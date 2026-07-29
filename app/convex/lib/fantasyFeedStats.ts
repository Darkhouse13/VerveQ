/**
 * API-Football → scoring-engine normalisation. Pure, and the ONLY place the
 * feed's shape is interpreted.
 *
 * ── Why this lives beside the engine (FW-4, extending ruling R1) ──
 *
 * R1 says one engine, driven by both the sim harness and the pipeline, "do not
 * fork, copy, or re-implement". The engine cannot be scored without turning a
 * feed payload into a `PlayerMatchStats`, and that translation carries every
 * measured trap in the feed: `passes.accuracy` is an accurate-pass COUNT shipped
 * as a string, `penalty.commited` is the feed's own misspelling, a substitution
 * event names the incoming player in `assist` and not in `player`, and null
 * means "did not record this" rather than zero. Re-implementing that in the
 * Convex ingest would have been a second normaliser — and the FW-4 regression
 * gate (harness numbers vs live numbers) would then be comparing two
 * translations as much as one engine.
 *
 * So `research/fantasy/scoring/events.ts` and the normalisation half of
 * `research/fantasy/sim/dataset.ts` moved here. The harness's dataset loader
 * keeps the file I/O and the round grouping and calls into this module for
 * every value it reads out of the feed.
 *
 * PURE: no network, no clock, no Convex import — the research harness has no
 * `convex` dependency and this file staying dependency-free is what keeps it
 * importable from both sides.
 */

import { emptyStats } from "./fantasyScoring";
import type {
  MatchContext,
  PlayerMatchStats,
  Slot,
  TimedEventKind,
  TimedPlayerEvent,
} from "./fantasyScoring";

// ------------------------------------------------------------------ feed shapes
//
// Every leaf is optional and nullable because the feed omits what a player did
// not record. The types are deliberately explicit rather than `any`: they are
// the phase-1 schema probe's measurement of what the payload carries, written
// down where the code that reads it can be checked against them.

/** A count the feed may ship as a number, as a string, or not at all. */
type FeedCount = number | string | null | undefined;

export interface FeedStatBlock {
  readonly games?: {
    readonly minutes?: FeedCount;
    readonly number?: FeedCount;
    /** Single letter: G | D | M | F. The lineup position for THIS fixture. */
    readonly position?: string | null;
    readonly rating?: string | null;
    readonly captain?: boolean | null;
    readonly substitute?: boolean | null;
  } | null;
  readonly shots?: { readonly total?: FeedCount; readonly on?: FeedCount } | null;
  readonly goals?: {
    readonly total?: FeedCount;
    /** Keeper-only. Never read for an outfielder — see MatchContext (G2). */
    readonly conceded?: FeedCount;
    readonly assists?: FeedCount;
    readonly saves?: FeedCount;
  } | null;
  readonly passes?: {
    readonly total?: FeedCount;
    readonly key?: FeedCount;
    /** Named "accuracy"; shipped as an accurate-pass COUNT, often as a string. */
    readonly accuracy?: FeedCount;
  } | null;
  readonly tackles?: {
    readonly total?: FeedCount;
    readonly blocks?: FeedCount;
    readonly interceptions?: FeedCount;
  } | null;
  readonly duels?: { readonly total?: FeedCount; readonly won?: FeedCount } | null;
  readonly dribbles?: {
    readonly attempts?: FeedCount;
    readonly success?: FeedCount;
    readonly past?: FeedCount;
  } | null;
  readonly fouls?: { readonly drawn?: FeedCount; readonly committed?: FeedCount } | null;
  readonly cards?: { readonly yellow?: FeedCount; readonly red?: FeedCount } | null;
  readonly penalty?: {
    readonly won?: FeedCount;
    /** The feed's own spelling. Not a typo here. */
    readonly commited?: FeedCount;
    readonly scored?: FeedCount;
    readonly missed?: FeedCount;
    readonly saved?: FeedCount;
  } | null;
}

/**
 * One timed event as the `/fixtures/events` endpoint ships it.
 *
 * This module exists partly for one trap in this shape: the feed's `subst`
 * event does not say "incoming" anywhere. It carries two players, and the
 * naming is backwards from what you would guess:
 *
 *     player  -> the player going OFF
 *     assist  -> the player coming ON
 *
 * Measured across all 10 substitutions in probe fixture 1208070: the `player`
 * row had `substitute=false` and `minutes` exactly equal to `time.elapsed`,
 * while the `assist` row had `substitute=true` and `minutes` equal to the
 * remaining match time. Reading `player` as the incoming substitute would
 * invert every finisher score in the sample and would not look wrong — the
 * numbers would just be attached to the wrong half of each substitution. Hence
 * a named function and a test, rather than a field access at the call site.
 */
export interface MatchEvent {
  readonly time: { readonly elapsed: number | null; readonly extra: number | null };
  readonly type: string;
  readonly detail: string;
  readonly player: { readonly id: number | null; readonly name: string | null };
  readonly assist: { readonly id: number | null; readonly name: string | null };
}

// ---------------------------------------------------------------- primitives

/**
 * The feed's null means "did not record this", measured in the phase-1 probe by
 * reconciling goal events against summed non-null totals. This is the ONLY
 * interpretation applied to a raw value anywhere in the pipeline or the harness.
 */
export function feedNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `games.position` is a single letter. Anything else is left null and reported. */
export function slotFromFeedPosition(raw: unknown): Slot | null {
  switch (String(raw ?? "").toUpperCase()) {
    case "G":
      return "GK";
    case "D":
      return "DEF";
    case "M":
      return "MID";
    case "F":
      return "ATT";
    default:
      return null;
  }
}

/**
 * One player's aggregate line, normalised. `ownGoals` is left at 0 here — the
 * stat line does not carry it and the caller fills it from the events feed.
 */
export function statsFromFeed(statistics: FeedStatBlock | undefined | null): PlayerMatchStats {
  const s = statistics ?? {};
  return emptyStats({
    minutes: feedNumber(s.games?.minutes),
    goals: feedNumber(s.goals?.total),
    assists: feedNumber(s.goals?.assists),
    shotsTotal: feedNumber(s.shots?.total),
    shotsOn: feedNumber(s.shots?.on),
    keyPasses: feedNumber(s.passes?.key),
    passesTotal: feedNumber(s.passes?.total),
    // Named "accuracy", shipped as an accurate-pass COUNT, and shipped as a
    // string. Measured in the probe; see fetch/config.ts REQUIRED_STATS.
    passesAccurate: feedNumber(s.passes?.accuracy),
    dribblesAttempted: feedNumber(s.dribbles?.attempts),
    dribblesCompleted: feedNumber(s.dribbles?.success),
    tackles: feedNumber(s.tackles?.total),
    interceptions: feedNumber(s.tackles?.interceptions),
    blocks: feedNumber(s.tackles?.blocks),
    duelsTotal: feedNumber(s.duels?.total),
    duelsWon: feedNumber(s.duels?.won),
    foulsCommitted: feedNumber(s.fouls?.committed),
    foulsDrawn: feedNumber(s.fouls?.drawn),
    yellowCards: feedNumber(s.cards?.yellow),
    redCards: feedNumber(s.cards?.red),
    saves: feedNumber(s.goals?.saves),
    penaltiesWon: feedNumber(s.penalty?.won),
    // The feed's own spelling. Not a typo here.
    penaltiesConceded: feedNumber(s.penalty?.commited),
    penaltiesScored: feedNumber(s.penalty?.scored),
    penaltiesMissed: feedNumber(s.penalty?.missed),
    penaltiesSaved: feedNumber(s.penalty?.saved),
    ownGoals: 0, // filled from events by the caller — the stat line lacks it
    wasSubstitute: s.games?.substitute === true,
  });
}

/**
 * The match-level context for one side of a fixture.
 *
 * Both goal counts come from the FIXTURE SCORE, never from a player row: the
 * feed's `goals.conceded` is keeper-only, so in a 0-3 defeat every outfield row
 * reads 0 and scoring clean sheets off it would award the whole back four one
 * (G2, measured in the phase-1 probe).
 */
export function matchContextFor(goalsFor: number, goalsAgainst: number): MatchContext {
  return {
    teamGoalsFor: goalsFor,
    teamGoalsAgainst: goalsAgainst,
    result: goalsFor > goalsAgainst ? "win" : goalsFor === goalsAgainst ? "draw" : "loss",
  };
}

// ------------------------------------------------------------------ events

export function isSubstitution(event: MatchEvent): boolean {
  return event.type.toLowerCase() === "subst";
}

/** The player coming ON. NOT `event.player` — see MatchEvent's comment. */
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

/**
 * Timed events per player id.
 *
 * Only the categories `TimedEventKind` admits are emitted, because only those
 * can be placed on the clock — which is the whole reason SCORING_SPEC §Finishers
 * needs this feed. Deliberately NOT emitted:
 *
 *  - `Var | *` rows. They annotate a decision, they are not the event. Counting
 *    "Goal cancelled" as a goal would be an outright fabrication; the FS-1
 *    integrity pass measured that cancelled goals are ALREADY excluded from the
 *    `Goal` rows (event goals reconcile to the fixture score in 192/192
 *    fixtures), so nothing here has to interpret a VAR row.
 *  - `subst`. Not a scoring event; consumed for entry minutes only.
 *  - Penalty SAVED. There is no event detail for it anywhere in the 3,209-event
 *    sample — the stat line carries `penalty.saved` untimed. A GK finisher's
 *    penalty save therefore cannot be clock-placed, which is a measured feed
 *    limit reported in the calibration report, not a modelling choice.
 */
export function timedEventsByPlayer(
  events: readonly MatchEvent[],
): Map<number, TimedPlayerEvent[]> {
  const byPlayer = new Map<number, TimedPlayerEvent[]>();
  const push = (playerId: number | null, minute: number | null, kind: TimedEventKind): void => {
    if (playerId === null || minute === null) return;
    const list = byPlayer.get(playerId) ?? [];
    list.push({ minute, kind });
    byPlayer.set(playerId, list);
  };

  for (const event of events) {
    const minute = eventMinute(event);
    const type = event.type?.toLowerCase() ?? "";
    const detail = event.detail?.toLowerCase() ?? "";

    if (type === "goal") {
      if (detail.includes("own goal")) {
        push(event.player.id, minute, "ownGoal");
        continue;
      }
      if (detail.includes("missed penalty")) {
        push(event.player.id, minute, "penaltyMissed");
        continue;
      }
      // "Normal Goal" and "Penalty" both score as a goal; the penalty-scored
      // count itself lives on the stat line and is not separately priced.
      push(event.player.id, minute, "goal");
      push(event.assist.id, minute, "assist");
      continue;
    }

    if (type === "card") {
      // No second-yellow detail exists anywhere in the sample (measured:
      // 780 "Yellow Card", 38 "Red Card", zero "Second Yellow"). v0.4.1 prices
      // both reds at -4, so the missing split costs nothing.
      if (detail.includes("red")) push(event.player.id, minute, "redCard");
      else if (detail.includes("yellow")) push(event.player.id, minute, "yellowCard");
      continue;
    }
  }

  return byPlayer;
}
