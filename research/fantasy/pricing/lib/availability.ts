/**
 * MISSION FW-REPRICE — availability, the fact the old prices did not price.
 *
 * The old signal was per-90 with shrinkage toward the position median. That
 * asks "how good is he per minute?" and never "does he play?", so four FC
 * Porto keepers priced 6.0 when only Diogo Costa starts: the compressed GK
 * band mashed all four into the ceiling, and shrinkage actively pulled the
 * three who never play UP toward the median. Availability is the missing term.
 *
 * ── What availability is ──
 *
 *   availability = min(minutes / seasonMinutes, 1)
 *
 * MINUTES ONLY. It is the sole availability fact the feed gives us; no injury
 * narrative, no expected-return date, nothing invented. A player who did not
 * play is priced as a player who did not play, whatever the reason was.
 *
 * ── The denominator (owner ruling, position-aware) ──
 *
 * The ruling reads: "a GK's availability = his share of his club's GK minutes;
 * outfield = minutes relative to a full season (~3,420'), capped at 1." Those
 * two definitions CONVERGE on one formula, and saying so plainly is more
 * honest than writing two code paths that compute the same number:
 *
 *   - A club plays exactly one keeper at a time, so its GK minutes over a
 *     season ARE `matches × 90`. A keeper's share of them is his minutes over
 *     `matches × 90`.
 *   - "A full season" for an outfielder is likewise `matches × 90` — the most
 *     minutes one player could possibly take.
 *
 * So both positions divide by `matches × 90`, for different reasons. The
 * ruling's `~3,420'` is the 38-match case; it is written with a tilde and only
 * four of our twelve leagues play 38. Using each league's own season length is
 * the faithful reading of "a full season", not a departure from it — a
 * Bundesliga season is 34 matches, and holding its players to a 3,420' bar
 * would price every one of them as 10% less available than an identical
 * Premier League player. The Championship's 46 cuts the other way.
 *
 * MEASURED CHECK (2026-08-13), summed club GK minutes ÷ (matches × 90) over
 * the 152 clubs we hold both figures for: median 1.000, p90 1.003 — the
 * identity holds. It fails low for 52 clubs (min 0.033) because our universe
 * is the CURRENT squad list and does not contain every keeper who played last
 * season. That is exactly why the denominator is `matches × 90` and not the
 * summed figure: dividing by an incomplete sum would report a keeper who
 * played half his club's matches as 100% available.
 *
 * ── Why the LEAGUE's modal season length, not the club's own `played` ──
 *
 * Club `fixtures.played.total` is unusable raw, on measured evidence:
 *   - Five clubs report 1-3 matches in a top-five or Primeira season (Red Star
 *     1, Rodez 2, Paderborn 2, Torreense 2, Saint Etienne 3) — partial rows for
 *     clubs that were not really season members. A 90-minute denominator makes
 *     every one of their players 100% available on a single appearance.
 *   - Play-offs inflate others past the league's round count (Championship 46
 *     league matches, but 48 and 49 appear; Segunda 42, but 44 and 46 appear).
 * The modal value across a league's clubs is the round count, is robust to
 * both, and is asserted into a sane range before use.
 *
 * A player who moved mid-season gets a minutes-weighted denominator across the
 * (club, league) pairs he actually played in — the same weighting the proxy
 * already uses for club rate expectations.
 */

import { n, type Raw } from './proxyEngine.ts';

/** Sanity bounds on a league's round count. Outside these we do not guess. */
const MIN_SEASON_MATCHES = 30;
const MAX_SEASON_MATCHES = 48;

export interface SeasonLengths {
  /** leagueId -> modal matches played across that league's clubs */
  readonly byLeague: ReadonlyMap<number, number>;
}

/**
 * The modal `fixtures.played.total` per league, i.e. its round count.
 * Throws if a league's mode falls outside the sane range — a silently wrong
 * denominator would silently mis-price a whole league.
 */
export function seasonLengths(teamStatRows: Raw[]): SeasonLengths {
  const perLeague = new Map<number, Map<number, number>>();
  for (const t of teamStatRows) {
    const played = n(t?.fixtures?.played?.total);
    const leagueId = n(t?.league?.id);
    if (played <= 0 || leagueId === 0) continue;
    const counts = perLeague.get(leagueId) ?? new Map<number, number>();
    counts.set(played, (counts.get(played) ?? 0) + 1);
    perLeague.set(leagueId, counts);
  }

  const byLeague = new Map<number, number>();
  for (const [leagueId, counts] of perLeague) {
    // most frequent; ties break to the larger count of matches, which is the
    // full season rather than a truncated row
    const mode = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    if (mode < MIN_SEASON_MATCHES || mode > MAX_SEASON_MATCHES) {
      throw new Error(
        `STOP: league ${leagueId} has a modal season length of ${mode} matches, outside ${MIN_SEASON_MATCHES}-${MAX_SEASON_MATCHES}. Refusing to guess a denominator.`,
      );
    }
    byLeague.set(leagueId, mode);
  }
  return { byLeague };
}

export interface Availability {
  /** min(minutes / seasonMinutes, 1) */
  readonly value: number;
  readonly minutes: number;
  /** the minutes-weighted full-season minutes he was measured against */
  readonly seasonMinutes: number;
  /** minutes played in a (club, league) whose league we hold no season length for */
  readonly unratedMinutes: number;
}

/**
 * Availability from a player's season entries.
 *
 * `entries` must already be scoped to the league set he is priced in — the
 * cross-league ban is a pricing rule and this function does not police it.
 */
export function availabilityOf(entries: Raw[], lengths: SeasonLengths): Availability {
  let minutes = 0;
  let unrated = 0;
  let weightedDen = 0;

  for (const s of entries) {
    const m = n(s.games?.minutes);
    if (m <= 0) continue;
    minutes += m;
    const matches = lengths.byLeague.get(n(s.league?.id));
    if (matches === undefined) {
      unrated += m;
      continue;
    }
    weightedDen += m * matches * 90;
  }

  const ratedMinutes = minutes - unrated;
  const seasonMinutes = ratedMinutes > 0 ? weightedDen / ratedMinutes : 0;
  const value = seasonMinutes > 0 ? Math.min(minutes / seasonMinutes, 1) : 0;
  return { value, minutes, seasonMinutes, unratedMinutes: unrated };
}
