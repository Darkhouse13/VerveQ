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

/**
 * Absorption rule (constitution amendment 2026-08-19, re-amended 2026-09-03):
 * a midweek window is a gameweek only when at least one ANCHOR league plays a
 * full round in it — `MIDWEEK_ABSORPTION_MIN_FIXTURES` or more of THAT
 * league's fixtures between Tuesday and Thursday. Otherwise the whole window,
 * every league's fixtures in it, is absorbed forward into the following
 * weekend window.
 *
 * The problem the first amendment solved is the straggler round: LaLiga
 * opened 2026-2027 by spreading matchday 1 across nine days, leaving two
 * fixtures on the Tue-Thu after the opening weekend. Under the unamended
 * constitution those two fixtures constituted a full gameweek — a 116-player
 * board that occupied the open slot for the whole build week, so the REAL
 * weekend's board could not open until its own Friday fixtures had already
 * kicked off. That amendment counted fixtures ACROSS leagues: under 5 in
 * total absorbed, anything else stood.
 *
 * The shape that defeated it (prod, 2026-09-03): the Championship plays a
 * full 12-fixture round on a Tue-Wed roughly every other week, and whenever a
 * top-flight straggler lands beside it the window reads 13-15 fixtures and
 * constitutes. A "GW4" of 12 Championship + 1 LaLiga + 1 Ligue 1 fixtures
 * opened on the Tuesday with finality Friday 23:59, and the 77-fixture
 * weekend behind it could not open until its own Friday kickoffs — the exact
 * failure the first amendment was written for, with ten more such windows
 * queued across the season (nine of them Championship-only). Owner ruling
 * 2026-09-03: one, two or three games from a league in midweek is not a
 * gameweek; the weekend board carries them.
 *
 * Why anchor leagues rather than "any league with a full round": the
 * Championship's 46-game calendar is played largely on Tue-Wed and would keep
 * constituting a board every other midweek on its own — a board on which
 * seven of the eight leagues have nothing to pick. A midweek board exists for
 * the midweek rounds of the top five (Premier League, LaLiga, Serie A,
 * Bundesliga, Ligue 1); Championship, Eredivisie and Liga Portugal fixtures
 * ride along in whichever window they fall, exactly as a straggler does. When
 * an anchor round DOES constitute a midweek gameweek, every fixture in that
 * window files under it — a window is a time span, not a league filter, and
 * the per-club kickoff locks already handle a lone straggler inside it.
 *
 * Why the per-league count is 5: a real round in an anchor league is 9-10
 * fixtures and a straggler tail is 1-4 (observed 1, 2 and 4 on prod this
 * season). The gap between 4 and 9 is the line, as it was before.
 *
 * Absorption is FORWARD only, and only for midweek windows. Backward would
 * extend a gameweek whose finality (Tuesday 23:59) can pass before a Thursday
 * straggler even kicks off; forward yields a Tue → Mon combined window with
 * the normal Tuesday finality, and the existing per-club kickoff locks handle
 * the early fixtures exactly as they handle a Friday 18:00 kickoff today. A
 * club that plays twice in the combined window (a Championship side, Tue and
 * Sat) locks at its first kickoff and is scored per fixture, as any absorbed
 * straggler's club already was. Weekend windows are never absorbed regardless
 * of size, so absorption cannot chain and always terminates.
 *
 * Known limitation, accepted: the decision is a function of the window's
 * OBSERVED fixtures, so a postponement moving a 5th anchor-league fixture
 * INTO an already-absorbed window after squads were built would re-constitute
 * it as its own gameweek and strand the early picks. The pre-amendment
 * constitution had the mirror-image churn (ordinal shifts on any newly
 * populated window); `reconcileGameweeks`' fail-closed conflict check is the
 * backstop for both.
 */
export const MIDWEEK_ABSORPTION_MIN_FIXTURES = 5;

/**
 * The leagues whose full midweek round constitutes a midweek gameweek: the
 * top five. Mirrors the first five entries of `fantasyConstants.LEAGUE_IDS`
 * (39 Premier League, 140 LaLiga, 135 Serie A, 78 Bundesliga, 61 Ligue 1)
 * and is spelled out here rather than derived, because the constitution must
 * not change shape when the ingest list grows by another riding league.
 */
export const MIDWEEK_ANCHOR_LEAGUE_IDS: readonly number[] = [39, 140, 135, 78, 61];

/** One fixture as the constitution sees it: when it kicks off, and for whom. */
export interface FixtureKickoff {
  readonly kickoffAt: number;
  readonly leagueId: number;
}

/**
 * Does this set of midweek-window fixtures constitute a gameweek? True when
 * some anchor league has at least `MIDWEEK_ABSORPTION_MIN_FIXTURES` fixtures
 * in it. Exported so the ingest's migration guard and the constitution agree
 * by construction rather than by copy.
 */
export function midweekConstitutes(
  fixtures: readonly { readonly leagueId: number }[],
): boolean {
  const countByLeague = new Map<number, number>();
  for (const { leagueId } of fixtures) {
    countByLeague.set(leagueId, (countByLeague.get(leagueId) ?? 0) + 1);
  }
  return MIDWEEK_ANCHOR_LEAGUE_IDS.some(
    (id) => (countByLeague.get(id) ?? 0) >= MIDWEEK_ABSORPTION_MIN_FIXTURES,
  );
}

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
 * The weekend window a midweek window absorbs into: the one beginning the
 * instant the midweek window ends (Thu 23:59 → Fri 00:00 is the seam, and the
 * half-open `endsAt` IS Friday 00:00, which `windowFor` places in the weekend).
 */
export function absorbingWindowFor(
  midweek: GameweekWindow,
  timeZone: string = FINALITY_TIME_ZONE,
): GameweekWindow {
  return windowFor(midweek.endsAt, timeZone);
}

/**
 * Constitute the ordered set of gameweeks covering `kickoffs`.
 *
 * A window with no fixture in it is NOT a gameweek — international breaks and
 * the midweeks of ordinary weeks simply produce no window, which is why the
 * ordinals come from the observed set rather than from counting weeks since
 * the season opener. `gwNumber` is chronological and 1-based across BOTH kinds
 * (a FULL midweek round is a gameweek in its own right, not a sub-part of the
 * weekend beside it).
 *
 * `fixtures` carries ONE ENTRY PER FIXTURE with its league, duplicates
 * meaningful: the per-league count inside each window is what the absorption
 * rule reads. A midweek window in which no anchor league reaches
 * `MIDWEEK_ABSORPTION_MIN_FIXTURES` (`midweekConstitutes`) is not constituted
 * — its key joins the following weekend window's `keys` instead, so ALL its
 * fixtures file under that gameweek (see the constant's comment for the
 * ruling). The absorbing weekend window is constituted even when it has no
 * direct fixtures of its own yet — a straggler pair must always have a home.
 *
 * Every returned window carries `keys`: the set of `windowFor(...).key` values
 * that resolve to it (its own, plus any absorbed midweek's). Callers mapping a
 * fixture's kickoff to a gameweek MUST resolve through `keys`, never by
 * comparing against `key` alone.
 *
 * `coverageStartAt` (fantasyConstants.SEASON_COVERAGE_START) marks when the
 * product's coverage of the season began. Windows already past finality at
 * that instant are historical imports — settled before any board could open,
 * carrying fixtures only for aggregates — and take non-positive ordinals
 * counting back from -1 (the import nearest coverage), so ordinal 1 is always
 * the first PLAYABLE window. 0 is deliberately skipped: ingestion uses 0 as
 * its "window unresolved" sentinel and a real gameweek must never claim it.
 * Finality is monotone in window start, so the imports are exactly the
 * chronological prefix.
 *
 * Deterministic: same kickoffs in any order produce the same numbering.
 */
export function constituteGameweeks(
  fixtures: readonly FixtureKickoff[],
  timeZone: string = FINALITY_TIME_ZONE,
  coverageStartAt?: number,
): (GameweekWindow & { gwNumber: number; keys: string[] })[] {
  const byKey = new Map<string, GameweekWindow>();
  const fixturesByKey = new Map<string, FixtureKickoff[]>();
  for (const fixture of fixtures) {
    const window = windowFor(fixture.kickoffAt, timeZone);
    if (!byKey.has(window.key)) byKey.set(window.key, window);
    const filed = fixturesByKey.get(window.key) ?? [];
    filed.push(fixture);
    fixturesByKey.set(window.key, filed);
  }

  // Absorption pass: midweek windows without an anchor-league round fold
  // forward into their weekend.
  const thin = [...byKey.values()].filter(
    (w) =>
      w.kind === "midweek" && !midweekConstitutes(fixturesByKey.get(w.key) ?? []),
  );
  const absorbedKeysByHost = new Map<string, string[]>();
  for (const window of thin) {
    const host = absorbingWindowFor(window, timeZone);
    if (!byKey.has(host.key)) byKey.set(host.key, host);
    byKey.delete(window.key);
    const absorbed = absorbedKeysByHost.get(host.key) ?? [];
    absorbed.push(window.key);
    absorbedKeysByHost.set(host.key, absorbed);
  }

  const sorted = [...byKey.values()].sort((a, b) => a.startsAt - b.startsAt);
  const preCoverage =
    coverageStartAt === undefined
      ? 0
      : sorted.filter((w) => w.finalityAt < coverageStartAt).length;
  return sorted.map((window, index) => ({
    ...window,
    gwNumber:
      index < preCoverage ? index - preCoverage : index - preCoverage + 1,
    keys: [window.key, ...(absorbedKeysByHost.get(window.key) ?? []).sort()],
  }));
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
