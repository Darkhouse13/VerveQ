/**
 * THE WEEKEND — fixtures display rules (FW-IMMERSE A3).
 *
 * Pure functions between fantasyMarket.getWeekendFixtures and the surfaces
 * that render the weekend (fixtures screen, matchday hub). No football fact
 * is computed here — kickoffs, statuses and goals arrive from the feed via
 * the query; these functions only group, order and classify for display.
 *
 * The client's clock GREYS, never enforces: `started` (kickoff passed while
 * the feed still says scheduled) is a display state for the lock glyph — the
 * server's lock engine remains the only authority on what a lock means.
 */

export interface WeekendFixture {
  fixtureId: string;
  leagueId: number;
  kickoffAt: number;
  status:
    | "scheduled"
    | "live"
    | "finished"
    | "postponed"
    | "cancelled"
    | "abandoned";
  homeClubId: string;
  awayClubId: string;
  homeName: string | null;
  awayName: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  scored: boolean;
}

/**
 * What a fixture row shows in its centre column:
 *  - upcoming: localized kickoff time
 *  - started:  kickoff passed, feed not yet live — locked, no scoreline
 *  - live:     in play; scoreline only if the feed carries goals
 *  - played:   full time; scoreline only if the feed carries goals
 *  - void:     postponed / cancelled / abandoned — status label, no scoreline
 */
export type FixtureDisplayKind = "upcoming" | "started" | "live" | "played" | "void";

export function fixtureDisplayKind(
  fixture: Pick<WeekendFixture, "status" | "kickoffAt">,
  now: number,
): FixtureDisplayKind {
  switch (fixture.status) {
    case "finished":
      return "played";
    case "live":
      return "live";
    case "postponed":
    case "cancelled":
    case "abandoned":
      return "void";
    case "scheduled":
      return fixture.kickoffAt <= now ? "started" : "upcoming";
  }
}

/** A player in this fixture is locked once it has kicked off (any non-void
 *  state past kickoff) — mirrors the lock engine's kickoff rule for display. */
export function fixtureLocked(
  fixture: Pick<WeekendFixture, "status" | "kickoffAt">,
  now: number,
): boolean {
  const kind = fixtureDisplayKind(fixture, now);
  return kind === "started" || kind === "live" || kind === "played";
}

/** The scoreline, exactly when the feed carries both goals AND the fixture is
 *  in a state where a score is a fact (live or played) — never for void or
 *  not-yet-started fixtures, never a fabricated 0–0. */
export function fixtureScoreline(
  fixture: Pick<WeekendFixture, "status" | "kickoffAt" | "homeGoals" | "awayGoals">,
  now: number,
): { home: number; away: number } | null {
  const kind = fixtureDisplayKind(fixture, now);
  if (kind !== "live" && kind !== "played") return null;
  if (fixture.homeGoals === null || fixture.awayGoals === null) return null;
  return { home: fixture.homeGoals, away: fixture.awayGoals };
}

export interface FixtureDayGroup<F extends { kickoffAt: number }> {
  /** Local-midnight timestamp of the group's calendar day — a stable key and
   *  the input the component formats its day heading from. */
  dayStart: number;
  fixtures: F[];
}

/** Group fixtures by LOCAL calendar day, days ascending, kickoff ascending
 *  within a day. Timezone comes from the environment (the user's device). */
export function groupFixturesByDay<F extends { kickoffAt: number }>(
  fixtures: ReadonlyArray<F>,
): Array<FixtureDayGroup<F>> {
  const groups = new Map<number, F[]>();
  for (const fixture of fixtures) {
    const day = new Date(fixture.kickoffAt);
    day.setHours(0, 0, 0, 0);
    const key = day.getTime();
    const bucket = groups.get(key) ?? [];
    bucket.push(fixture);
    groups.set(key, bucket);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayStart, dayFixtures]) => ({
      dayStart,
      fixtures: [...dayFixtures].sort((a, b) => a.kickoffAt - b.kickoffAt),
    }));
}

/** The next kickoff still ahead of `now` across playable fixtures (void ones
 *  never count) — the matchday countdown's target. Null once the weekend's
 *  last ball is kicked. */
export function nextKickoffAt(
  fixtures: ReadonlyArray<Pick<WeekendFixture, "status" | "kickoffAt">>,
  now: number,
): number | null {
  let next: number | null = null;
  for (const fixture of fixtures) {
    if (fixture.status !== "scheduled") continue;
    if (fixture.kickoffAt <= now) continue;
    if (next === null || fixture.kickoffAt < next) next = fixture.kickoffAt;
  }
  return next;
}

/** Weekend pulse for the hub: how many fixtures are in play, played, scored,
 *  still to come — the numbers the matchday hero speaks in. */
export function weekendPulse(
  fixtures: ReadonlyArray<Pick<WeekendFixture, "status" | "kickoffAt" | "scored">>,
  now: number,
): { total: number; upcoming: number; inPlay: number; played: number; scored: number } {
  let upcoming = 0;
  let inPlay = 0;
  let played = 0;
  let scored = 0;
  let total = 0;
  for (const fixture of fixtures) {
    const kind = fixtureDisplayKind(fixture, now);
    if (kind === "void") continue;
    total += 1;
    if (kind === "upcoming") upcoming += 1;
    else if (kind === "started" || kind === "live") inPlay += 1;
    else played += 1;
    if (fixture.scored) scored += 1;
  }
  return { total, upcoming, inPlay, played, scored };
}

/** Countdown parts for a target timestamp — clamped at zero, days folded into
 *  hours (a weekend never needs a day column, but Friday-to-Monday windows can
 *  exceed 24h before first kickoff). */
export function countdownParts(
  target: number,
  now: number,
): { hours: number; minutes: number; seconds: number } {
  const left = Math.max(0, target - now);
  return {
    hours: Math.floor(left / 3_600_000),
    minutes: Math.floor((left % 3_600_000) / 60_000),
    seconds: Math.floor((left % 60_000) / 1000),
  };
}
