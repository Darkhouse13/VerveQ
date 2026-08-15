/**
 * Weekend Fantasy — crowd voting rules (CROWD_VOTING_SPEC v1.0.1). PURE.
 *
 * The eye-test instrument: pairwise "who had the better game?" votes become a
 * per-gameweek Elo per player, whose position-group percentile maps onto the
 * crowd factor. Everything rule-shaped lives here, testable without a
 * database; the Convex modules are thin authorized wrappers.
 *
 * Two properties this module is responsible for BY CONSTRUCTION:
 *
 *   1. Every derived factor lies in [−CROWD_FACTOR_MAX, +CROWD_FACTOR_MAX].
 *      The pipeline's ±15% validator is the safety net, never the mechanism
 *      (STANDING RULE 6): nothing this module emits can be out of band,
 *      because the percentile is a bounded quantity mapped linearly onto the
 *      band's exact endpoints.
 *   2. Below the liquidity threshold the factor is exactly 0 and the player
 *      is FLAGGED (insufficient votes) — visible, not silent.
 *
 * Constants marked [placeholder] are the spec's own placeholders, LOCKED as
 * principles with numbers pending live data; they change by owner ticket.
 */

import type { SlotRole } from "./fantasyConstants";

/** Per-gameweek Elo start for every appeared player. */
export const CROWD_ELO_START = 1500;

/** Elo K-factor, one update per vote. */
export const CROWD_ELO_K = 32;

/** Fewer votes than this ⇒ factor 0, "insufficient votes". [placeholder 25] */
export const CROWD_LIQUIDITY_THRESHOLD = 25;

/** Pairs served per user per gameweek. [placeholder 300] */
export const CROWD_SERVE_CAP_PER_GAMEWEEK = 300;

/**
 * TODAY'S TEN (EYE-TEST-TEN). The session's goal — what the surface asks of a
 * voter today. It is NOT a cap: past the tenth the stack keeps serving for
 * volunteers, and CROWD_SERVE_CAP_PER_GAMEWEEK remains the only ceiling.
 * A goal you can finish is the thing that kills the chore; "N / 300" was a
 * progress bar toward exhaustion.
 */
export const CROWD_SESSION_GOAL = 10;

/**
 * Fewer votes than this on a pair and the reveal says "you're one of the
 * first" instead of a percentage. Three votes is not a crowd, and a
 * fake-precise "67%" off two other people is the kind of number the card is
 * banned from arguing with. [placeholder 5]
 */
export const CROWD_REVEAL_MIN_VOTES = 5;

/** The clamp half-width the factor maps onto. SCORING_SPEC v0.5.1 (P7). */
export const CROWD_FACTOR_MAX = 0.15;

// ── Elo ──

/** Standard Elo expectation of A beating B. */
export function eloExpectation(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** One vote's update: `aWon` is the tap. "Didn't watch" never reaches here —
 *  a costless skip produces no update and no penalty (LOCKED). */
export function eloUpdate(
  ratingA: number,
  ratingB: number,
  aWon: boolean,
): { a: number; b: number } {
  const expectedA = eloExpectation(ratingA, ratingB);
  const scoreA = aWon ? 1 : 0;
  const delta = CROWD_ELO_K * (scoreA - expectedA);
  return { a: ratingA + delta, b: ratingB - delta };
}

// ── pair identity ──

/** Canonical pair key: order-independent, so "A vs B" and "B vs A" are the
 *  same single-use pair and the same consensus bucket. */
export function pairKeyOf(playerIdA: string, playerIdB: string): string {
  return playerIdA < playerIdB
    ? `${playerIdA}:${playerIdB}`
    : `${playerIdB}:${playerIdA}`;
}

// ── factor derivation ──

export interface CrowdRatingEntry {
  readonly playerId: string;
  /** The player's verdict position for the gameweek — the group he is
   *  percentiled WITHIN (the spec's "how good was he for his role"). */
  readonly verdictPosition: SlotRole;
  readonly rating: number;
  readonly voteCount: number;
}

export interface CrowdFactorResult {
  readonly playerId: string;
  readonly factor: number;
  /** True when voteCount < CROWD_LIQUIDITY_THRESHOLD or is not a finite
   *  number: factor is 0 and the surface says "insufficient votes" rather
   *  than nothing. */
  readonly insufficientVotes: boolean;
}

/**
 * crowd_factor = linear map of the player's final rating percentile within
 * his verdict-position group onto [−0.15, +0.15], median = 0.
 *
 * Percentile of a group of n: ranks are averaged across rating ties (two
 * equal ratings get equal factors), then rank/(n−1) ∈ [0,1]. A group of one
 * sits at the median (factor 0) rather than at an arbitrary extreme.
 *
 * Only players AT or ABOVE the liquidity threshold enter the percentile
 * population: a below-threshold player neither receives a factor nor drags
 * his neighbours' percentiles — his rating is unconsulted noise by
 * definition of the threshold.
 */
export function deriveCrowdFactors(
  entries: readonly CrowdRatingEntry[],
): CrowdFactorResult[] {
  const results: CrowdFactorResult[] = [];
  const liquid = new Map<SlotRole, CrowdRatingEntry[]>();

  for (const entry of entries) {
    // A non-finite count is not evidence of any votes at all: NaN would slip
    // past `< threshold` (NaN comparisons are false) and Infinity is no count
    // a ballot box can produce — both are below-threshold by definition.
    if (!Number.isFinite(entry.voteCount) || entry.voteCount < CROWD_LIQUIDITY_THRESHOLD) {
      results.push({ playerId: entry.playerId, factor: 0, insufficientVotes: true });
      continue;
    }
    const group = liquid.get(entry.verdictPosition) ?? [];
    group.push(entry);
    liquid.set(entry.verdictPosition, group);
  }

  for (const group of liquid.values()) {
    if (group.length === 1) {
      results.push({ playerId: group[0].playerId, factor: 0, insufficientVotes: false });
      continue;
    }
    const sorted = [...group].sort(
      (a, b) => a.rating - b.rating || (a.playerId < b.playerId ? -1 : 1),
    );
    // Average rank across rating ties: equal performances, equal factors.
    const rankByPlayer = new Map<string, number>();
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1].rating === sorted[i].rating) j += 1;
      const avgRank = (i + j) / 2;
      for (let k = i; k <= j; k += 1) rankByPlayer.set(sorted[k].playerId, avgRank);
      i = j + 1;
    }
    const span = sorted.length - 1;
    for (const entry of group) {
      const percentile = (rankByPlayer.get(entry.playerId) ?? 0) / span;
      // [0,1] → [−MAX,+MAX], exactly; nothing beyond the band is expressible.
      const factor = (percentile - 0.5) * 2 * CROWD_FACTOR_MAX;
      results.push({ playerId: entry.playerId, factor, insufficientVotes: false });
    }
  }

  return results;
}

// ── rater accuracy (the sealed second game) ──

/**
 * The majority direction of one pair's votes, or null on a tie / no votes.
 * Scored only after finality, against these frozen tallies.
 */
export function consensusOf(aVotes: number, bVotes: number): "a" | "b" | null {
  if (aVotes === bVotes) return null;
  return aVotes > bVotes ? "a" : "b";
}

/** The court's vote weight: 0.5 + rolling accuracy, so a coin-flip rater
 *  ≈ 1.0 and the best raters ≈ 1.5. A rater with no scored votes yet weighs
 *  exactly 1.0 — no history is neither trust nor distrust. */
export function raterWeightOf(accurateVotes: number, scoredVotes: number): number {
  if (scoredVotes === 0) return 1.0;
  return 0.5 + accurateVotes / scoredVotes;
}

// ── the card's memory (EYE-TEST-CONTEXT) ──

/** The fixture line the card locates the memory in — stored feed facts only
 *  (fantasyFixtures). Absent goals stay null, never 0. */
export interface ServeCardFixture {
  leagueId: number;
  kickoffAt: number;
  homeClubId: string;
  awayClubId: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

/**
 * Everything EYE-TEST-CONTEXT adds to a served card: where the memory
 * happened (club, opponent, venue, league, day), how much of it there was
 * (minutes), and the factual events (goals, assists, a red). Nothing
 * evaluative — points, ratings, derived metrics are excluded BY RULING
 * (docs/DECISIONS.md): any evaluative number on the card re-anchors the
 * vote to an algorithm. The card locates the memory; it never argues.
 */
export interface ServeCardContext {
  /** The club the player APPEARED for in this fixture — the STAT ROW's
   *  clubId, not the players table's, so a transfer between the appearance
   *  and the serve cannot misattribute the memory. */
  clubId: string;
  clubName: string | null;
  opponentClubId: string;
  opponentName: string | null;
  isHome: boolean;
  minutes: number;
  goals: number;
  assists: number;
  /** A red is shown as a fact, not a count — the feed's redCards collapsed. */
  redCard: boolean;
  fixture: ServeCardFixture;
}

/**
 * Pure card-context mapping for one served player. Orientation keys off the
 * side he appeared FOR: a clubId matching neither fixture side (feed
 * corruption) orients as away, so the opponent shown is the home side — a
 * true fact of the fixture even in the degraded case. Club labels resolve
 * through the passed map; a club without a label stays null (degraded
 * loudly, never invented — the getWeekendFixtures rule).
 */
export function serveCardContextOf(args: {
  appearedClubId: string;
  stats: { minutes: number; goals: number; assists: number; redCards: number };
  fixture: ServeCardFixture;
  clubNames: ReadonlyMap<string, string>;
}): ServeCardContext {
  const { appearedClubId, stats, fixture, clubNames } = args;
  const isHome = appearedClubId === fixture.homeClubId;
  const opponentClubId = isHome ? fixture.awayClubId : fixture.homeClubId;
  return {
    clubId: appearedClubId,
    clubName: clubNames.get(appearedClubId) ?? null,
    opponentClubId,
    opponentName: clubNames.get(opponentClubId) ?? null,
    isHome,
    minutes: stats.minutes,
    goals: stats.goals,
    assists: stats.assists,
    redCard: stats.redCards > 0,
    fixture,
  };
}

// ── the picker + the cascade (EYE-TEST-TEN) ──

/**
 * What the fixture picker recorded for one (user, gameweek).
 *
 *   null  — never asked. The picker is the first screen of the session.
 *   []    — asked and answered "I didn't watch anything this weekend". A
 *           VALID, RECORDED answer, not an error and not an absence: the
 *           difference between the two is exactly why this is an array on a
 *           row rather than a nullable field.
 */
export type WatchedSelection = readonly string[] | null;

export type ServeGate =
  | { kind: "needs_picker" }
  | { kind: "no_fixtures" }
  | { kind: "ok"; fixtureIds: ReadonlySet<string> };

/** The gate every serve passes before a pair is chosen. */
export function serveGateOf(selection: WatchedSelection): ServeGate {
  if (selection === null) return { kind: "needs_picker" };
  const fixtureIds = new Set(selection);
  if (fixtureIds.size === 0) return { kind: "no_fixtures" };
  return { kind: "ok", fixtureIds };
}

/**
 * The voteable population for one user: appeared players from the fixtures he
 * SAID he watched, minus the players he owns this gameweek.
 *
 * Both filters are serve-time (LOCKED for conflicts, new here for the
 * picker). Because it runs before partner selection, a cross-fixture pair can
 * only ever span two SELECTED fixtures — the picker constrains both sides of
 * the pair, not just the one the serve targeted.
 */
export function eligibleForSelection<P extends { playerId: string; fixtureId: string }>(
  players: readonly P[],
  selectedFixtureIds: ReadonlySet<string>,
  conflictedPlayerIds: ReadonlySet<string>,
): P[] {
  return players.filter(
    (p) => selectedFixtureIds.has(p.fixtureId) && !conflictedPlayerIds.has(p.playerId),
  );
}

/** Which side(s) of a pair a didn't-see marks unseen. */
export type UnseenSide = "a" | "b" | "both";

/**
 * The fixtures a didn't-see retires. A pair can span two fixtures (the
 * context cards made that visible), so "didn't see him" is per CARD and
 * retires only that card's fixture; the combined button — offered only when
 * both cards share a fixture — retires the one they share.
 */
export function unseenFixturesOf(
  side: UnseenSide,
  fixtureAId: string,
  fixtureBId: string,
): string[] {
  if (side === "a") return [fixtureAId];
  if (side === "b") return [fixtureBId];
  return fixtureAId === fixtureBId ? [fixtureAId] : [fixtureAId, fixtureBId];
}

/**
 * The cascade: a didn't-see removes that fixture from the user's picker
 * selection, which is what makes "never serve me a pair from that game
 * again" true for the REST of the gameweek rather than just for this pair —
 * serving reads the selection, so retiring the fixture excludes every
 * remaining pair drawn from it in one move.
 */
export function selectionAfterCascade(
  selection: readonly string[],
  retired: readonly string[],
): string[] {
  const drop = new Set(retired);
  return selection.filter((fixtureId) => !drop.has(fixtureId));
}

// ── Today's Ten ──

/** How far back a client-supplied day start is allowed to sit. A local
 *  midnight is at most 26h behind UTC-now (UTC+14 through UTC−12); 36h is
 *  that with room, and anything older is not "today" in any timezone. */
export const CROWD_DAY_WINDOW_MAX_MS = 36 * 60 * 60 * 1000;

/**
 * The instant the voter's "today" began. The client may pass its own LOCAL
 * midnight — it alone knows the device's timezone, and "Today's Ten" should
 * roll over at the voter's midnight, not Greenwich's. The value is clamped,
 * not trusted: a future, non-finite, or stale-beyond-36h claim falls back to
 * UTC midnight.
 *
 * Nothing rides on this but a counter with no reward attached, which is why a
 * client-supplied boundary is safe here and would not be anywhere near the
 * scoring path.
 */
export function todayStartOf(now: number, clientDayStart?: number | null): number {
  const utcMidnight = Math.floor(now / 86_400_000) * 86_400_000;
  if (clientDayStart === undefined || clientDayStart === null) return utcMidnight;
  if (!Number.isFinite(clientDayStart)) return utcMidnight;
  if (clientDayStart > now) return utcMidnight;
  if (now - clientDayStart > CROWD_DAY_WINDOW_MAX_MS) return utcMidnight;
  return clientDayStart;
}

export interface TodaysTenProgress {
  /** Votes cast today. Keeps counting past the goal — volunteers are not
   *  told their extra work stopped registering. */
  voted: number;
  goal: number;
  complete: boolean;
}

/**
 * Today's Ten from the user's own answered pairs. Only VOTES count: a
 * didn't-see is an honest answer but not a judgment, and a ten made of skips
 * would thank the voter for nothing. The exhaustion done-state is serving's
 * job — a voter who picked two games can finish long before ten exist.
 */
export function todaysTenOf(
  votedAtTimes: readonly (number | undefined)[],
  dayStart: number,
): TodaysTenProgress {
  let voted = 0;
  for (const at of votedAtTimes) {
    if (at !== undefined && Number.isFinite(at) && at >= dayStart) voted += 1;
  }
  return { voted, goal: CROWD_SESSION_GOAL, complete: voted >= CROWD_SESSION_GOAL };
}

// ── the consensus reveal ──

export interface ConsensusReveal {
  /** Votes on this pair, the caller's included. */
  total: number;
  /** Votes that went the caller's way, the caller's own included. */
  withYou: number;
  /** The caller's share, 0–100. Null below CROWD_REVEAL_MIN_VOTES — the
   *  surface says "one of the first" rather than inventing precision. */
  percent: number | null;
  lowSample: boolean;
  /** True when the caller is in the larger share. Drives which sentence the
   *  surface speaks, never a different number. */
  majority: boolean;
}

/**
 * The reveal, from the pair's stored votes.
 *
 * Shown ONLY after the vote lands, never before (EYE-TEST-TEN ruling,
 * docs/DECISIONS.md): the card is banned from arguing, and a crowd number in
 * front of the ballot is the loudest argument there is.
 *
 * Rounding is honest at the ends: a lone dissenter caps the display at 99%
 * rather than reading 100%, and a lone agreer floors at 1% rather than 0% —
 * a percentage must never erase a vote that exists.
 */
export function consensusRevealOf(withYou: number, total: number): ConsensusReveal {
  // The caller's own vote is always in the tally; a count that says otherwise
  // is a read race, not a fact about the crowd.
  const safeTotal = Math.max(total, withYou, 1);
  const safeWithYou = Math.max(withYou, 0);
  const lowSample = safeTotal < CROWD_REVEAL_MIN_VOTES;
  let percent: number | null = null;
  if (!lowSample) {
    percent = Math.round((safeWithYou / safeTotal) * 100);
    if (percent === 100 && safeWithYou < safeTotal) percent = 99;
    if (percent === 0 && safeWithYou > 0) percent = 1;
  }
  return {
    total: safeTotal,
    withYou: safeWithYou,
    percent,
    lowSample,
    majority: safeWithYou * 2 > safeTotal,
  };
}
