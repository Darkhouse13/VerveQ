/**
 * Weekend Fantasy — the gameweek constitution (FW-2).
 *
 * This module answers one question: **given a kickoff instant, which gameweek
 * does that fixture belong to?** Everything else in ingestion is bookkeeping
 * around this answer.
 *
 * ── The constitution (owner ruling, inherited by FW-2) ──
 *
 *   weekend window : Friday 00:00 → Monday 23:59   Europe/Paris
 *   midweek window : Tuesday 00:00 → Thursday 23:59 Europe/Paris
 *   finality       : 23:59 Europe/Paris the day AFTER the window closes
 *
 * The two window kinds **tile the week exactly** — every instant belongs to
 * exactly one, with no gap and no overlap. That is deliberate and is why the
 * windows are modelled as half-open intervals `[startsAt, endsAt)` rather than
 * as the inclusive "…23:59" the ruling is worded in. "Monday 23:59" and
 * "Tuesday 00:00 exclusive" describe the same boundary, but only one of them
 * survives contact with a fixture kicking off at 23:59:30 — a real thing in
 * South American broadcasts and not worth being wrong about. The wording is
 * preserved in the names; the arithmetic uses the half-open form.
 *
 * ── This is the ONLY finality rule (STOP-E) ──
 *
 * FW-1 shipped `fantasyConstants.finalityAtOrAfter` = "the first Tuesday 23:59
 * Paris at or after an instant", from a time when a gameweek was assumed to be
 * a weekend and nothing else. For a weekend window the two agree exactly; they
 * diverge for MIDWEEK windows, which must settle on Friday.
 *
 * Per the owner's STOP-E ruling (2026-07-29) that function was DELETED rather
 * than kept alongside this one. Two finality functions in one namespace is an
 * invitation for a caller to pick the wrong one, and the wrong one does not
 * fail loudly — it returns a plausible timestamp up to four days late. Every
 * consumer now reads `windowFor(instant).finalityAt`.
 *
 * PURE: no Convex imports, no `Date.now()`. Every function is a total function
 * of its arguments, which is what makes the whole thing directly unit testable.
 */

import {
  FINALITY_HOUR,
  FINALITY_MINUTE,
  FINALITY_TIME_ZONE,
  zonedDateParts,
  zonedWallClockToEpochMs,
} from "./fantasyConstants";

const MS_PER_DAY = 86_400_000;

export type WindowKind = "weekend" | "midweek";

export interface GameweekWindow {
  readonly kind: WindowKind;
  /** Inclusive. 00:00 Europe/Paris on the window's first day. */
  readonly startsAt: number;
  /** EXCLUSIVE. 00:00 Europe/Paris on the day after the window's last day. */
  readonly endsAt: number;
  /** 23:59 Europe/Paris on the day after the window closes. */
  readonly finalityAt: number;
  /** Stable identity, e.g. `weekend:2026-08-21`. Used to dedupe across leagues. */
  readonly key: string;
}

/**
 * Weekday → how many days back the window containing it started, plus which
 * kind of window that is.
 *
 * Sunday is 0 in JS, so the weekend run reads 5,6,0,1 rather than a contiguous
 * range — the reason this is a lookup table and not arithmetic.
 */
const WINDOW_OF_WEEKDAY: Readonly<
  Record<number, { kind: WindowKind; daysBack: number; spanDays: number }>
> = {
  5: { kind: "weekend", daysBack: 0, spanDays: 4 }, // Friday
  6: { kind: "weekend", daysBack: 1, spanDays: 4 }, // Saturday
  0: { kind: "weekend", daysBack: 2, spanDays: 4 }, // Sunday
  1: { kind: "weekend", daysBack: 3, spanDays: 4 }, // Monday
  2: { kind: "midweek", daysBack: 0, spanDays: 3 }, // Tuesday
  3: { kind: "midweek", daysBack: 1, spanDays: 3 }, // Wednesday
  4: { kind: "midweek", daysBack: 2, spanDays: 3 }, // Thursday
};

/** The Paris calendar date `dayOffset` whole days from the one containing `instant`. */
function parisDateShifted(
  instant: number,
  dayOffset: number,
  timeZone: string,
): { year: number; month: number; day: number } {
  const { year, month, day } = zonedDateParts(instant, timeZone);
  // Add days to a UTC-anchored midnight and read the parts back, so month and
  // year rollover are the platform's problem rather than ours.
  const shifted = new Date(Date.UTC(year, month - 1, day) + dayOffset * MS_PER_DAY);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function midnightParis(
  date: { year: number; month: number; day: number },
  timeZone: string,
): number {
  return zonedWallClockToEpochMs(date.year, date.month, date.day, 0, 0, timeZone);
}

function isoDate(date: { year: number; month: number; day: number }): string {
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  return `${date.year}-${mm}-${dd}`;
}

/**
 * The gameweek window containing `instant`.
 *
 * Total: every instant lands in exactly one window, because the two kinds tile
 * the week. There is no "no window" answer and therefore no fixture that
 * ingestion has to drop for being unplaceable.
 */
export function windowFor(
  instant: number,
  timeZone: string = FINALITY_TIME_ZONE,
): GameweekWindow {
  const { weekday } = zonedDateParts(instant, timeZone);
  const spec = WINDOW_OF_WEEKDAY[weekday];

  const startDate = parisDateShifted(instant, -spec.daysBack, timeZone);
  const startsAt = midnightParis(startDate, timeZone);

  // endsAt is midnight Paris on the day after the last day of the window:
  // weekend Fri +4 = Tue 00:00, midweek Tue +3 = Fri 00:00. DST is handled by
  // re-solving the wall clock rather than by adding 4x86.4e6 ms to startsAt,
  // which would be an hour wrong twice a season.
  const endDate = parisDateShifted(startsAt, spec.spanDays, timeZone);
  const endsAt = midnightParis(endDate, timeZone);

  return {
    kind: spec.kind,
    startsAt,
    endsAt,
    finalityAt: finalityForWindow(endDate, timeZone),
    key: `${spec.kind}:${isoDate(startDate)}`,
  };
}

/**
 * 23:59 Europe/Paris on the day the half-open window ends.
 *
 * The ruling says "the day after the window closes", and the day after a
 * weekend window's last day (Monday) is exactly the calendar day its half-open
 * interval ends on (Tuesday). Same for midweek: last day Thursday, interval
 * ends Friday, finality Friday 23:59. So this is a single expression rather
 * than a per-kind branch.
 */
function finalityForWindow(
  endDate: { year: number; month: number; day: number },
  timeZone: string,
): number {
  return zonedWallClockToEpochMs(
    endDate.year,
    endDate.month,
    endDate.day,
    FINALITY_HOUR,
    FINALITY_MINUTE,
    timeZone,
  );
}

/**
 * Constitute the ordered set of gameweeks covering `kickoffs`.
 *
 * A window with no fixture in it is NOT a gameweek — international breaks and
 * the midweeks of ordinary weeks simply produce no window, which is why the
 * ordinals come from the observed set rather than from counting weeks since
 * the season opener. `gwNumber` is chronological and 1-based across BOTH kinds
 * (a midweek round is a gameweek in its own right, not a sub-part of the
 * weekend beside it).
 *
 * Deterministic: same kickoffs in any order produce the same numbering.
 */
export function constituteGameweeks(
  kickoffs: readonly number[],
  timeZone: string = FINALITY_TIME_ZONE,
): (GameweekWindow & { gwNumber: number })[] {
  const byKey = new Map<string, GameweekWindow>();
  for (const kickoff of kickoffs) {
    const window = windowFor(kickoff, timeZone);
    if (!byKey.has(window.key)) byKey.set(window.key, window);
  }

  return [...byKey.values()]
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((window, index) => ({ ...window, gwNumber: index + 1 }));
}

/** What the ingest wants a season's gameweek row to say. */
export interface GameweekWindowUpsert {
  gwNumber: number;
  leagueIds: number[];
  finalityAt: number;
}

/**
 * Reconcile stored gameweek rows against a freshly constituted window set —
 * matching by WINDOW IDENTITY, never by ordinal (FW-EXPAND, 2026-08-12).
 *
 * `finalityAt` is the identity: every window's finality instant is unique
 * (23:59 Paris on the window's own end day; weekend finalities are Tuesdays,
 * midweek finalities are Fridays, and no two windows share an end day). The
 * ordinal is NOT identity — it is a label that shifts whenever a fixture set
 * populates a previously empty window (a new league's midweek round, or a
 * postponement into an empty week). Before this, the writer matched rows by
 * `(season, gwNumber)`, so an ordinal shift silently re-purposed every
 * subsequent row for a different real-world window while squads, scores and
 * claims kept pointing at the old document ids. Matching by identity keeps
 * each document bound to its window for life and re-stamps the label instead.
 *
 * Rows matching no window are left untouched (they hold history) — but if a
 * surviving row's ordinal is claimed by the new numbering, the caller must
 * refuse the whole write: two rows with one ordinal would make
 * `by_season_gwNumber` lookups ambiguous. Fail closed, report, decide.
 */
export function reconcileGameweeks<
  T extends { gwNumber: number; leagueIds: readonly number[]; finalityAt: number },
>(
  existing: readonly T[],
  windows: readonly GameweekWindowUpsert[],
): {
  inserts: GameweekWindowUpsert[];
  patches: { current: T; gwNumber: number; leagueIds: number[] }[];
  /** Unmatched stored rows whose ordinal the new numbering claims. */
  conflicts: T[];
} {
  const byFinality = new Map<number, T>();
  for (const row of existing) {
    if (!byFinality.has(row.finalityAt)) byFinality.set(row.finalityAt, row);
  }

  const inserts: GameweekWindowUpsert[] = [];
  const patches: { current: T; gwNumber: number; leagueIds: number[] }[] = [];
  const matched = new Set<T>();

  for (const window of windows) {
    const current = byFinality.get(window.finalityAt);
    if (current === undefined) {
      inserts.push(window);
      continue;
    }
    matched.add(current);
    const sameLeagues =
      current.leagueIds.length === window.leagueIds.length &&
      current.leagueIds.every((id, i) => id === window.leagueIds[i]);
    if (current.gwNumber !== window.gwNumber || !sameLeagues) {
      patches.push({ current, gwNumber: window.gwNumber, leagueIds: window.leagueIds });
    }
  }

  const claimed = new Set(windows.map((w) => w.gwNumber));
  const conflicts = existing.filter(
    (row) => !matched.has(row) && claimed.has(row.gwNumber),
  );

  return { inserts, patches, conflicts };
}

/**
 * The season label a provider season year maps to, e.g. 2026 → "2026-2027".
 *
 * API-Football names a European season by its opening calendar year; the
 * schema's `fantasyGameweeks.season` wants the human form.
 */
export function seasonLabel(apiSeason: number): string {
  return `${apiSeason}-${apiSeason + 1}`;
}
