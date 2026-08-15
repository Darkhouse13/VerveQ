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

// ── the undo window (EYE-TEST-SERVE) ──

/**
 * How long a didn't-see can be taken back. Five seconds is the length of the
 * toast that offers it — the window and the affordance are the same object,
 * and nothing may undo a retirement the voter can no longer see offered.
 *
 * After it closes the retirement is PERMANENT, per the EYE-TEST-TEN cascade
 * ruling: "never serves them a pair from an unseen fixture again" was read
 * strictly, and a late escape hatch would quietly unread it. The undo is the
 * mis-tap remedy, not a second opinion.
 */
export const CROWD_UNDO_WINDOW_MS = 5_000;

/**
 * Is the retirement still takeable back? `votedAt` is the didn't-see's own
 * server stamp, so this is a server clock compared against itself: a missing
 * or non-finite stamp is not a window, and a stamp in the future (only
 * reachable by a clock stepping backwards mid-flight) is treated as open
 * rather than as instantly expired — the mis-tap remedy fails toward the
 * voter, never toward the ledger.
 */
export function undoWindowOpenAt(votedAt: number | undefined | null, now: number): boolean {
  if (votedAt === undefined || votedAt === null || !Number.isFinite(votedAt)) return false;
  if (now < votedAt) return true;
  return now - votedAt <= CROWD_UNDO_WINDOW_MS;
}

/**
 * The selection an undo restores: the fixtures put back, appended to what is
 * there now, never duplicated. Appending rather than re-inserting at the old
 * index is deliberate — the picker renders by kickoff day, not by array
 * order, so position carries no meaning worth reconstructing.
 */
export function selectionAfterUndo(
  selection: readonly string[],
  restored: readonly string[],
): string[] {
  const present = new Set(selection);
  const next = [...selection];
  for (const fixtureId of restored) {
    if (present.has(fixtureId)) continue;
    present.add(fixtureId);
    next.push(fixtureId);
  }
  return next;
}

/** The retirement ledger an undo clears — the durable half of the cascade,
 *  un-remembered for exactly the fixtures this one didn't-see retired. */
export function unseenAfterUndo(
  unseen: readonly string[],
  restored: readonly string[],
): string[] {
  const drop = new Set(restored);
  return unseen.filter((fixtureId) => !drop.has(fixtureId));
}

/**
 * What a didn't-see ACTUALLY took away: the fixtures it removed from the
 * selection AND newly wrote to the retirement ledger. Both conditions,
 * because the undo has to be an exact inverse of this one answer:
 *
 *   already retired  — an earlier didn't-see closed it; this tap changed
 *                      nothing, and taking THIS tap back must not reopen THAT
 *                      one's game.
 *   not selected     — the voter had already dropped it through the picker;
 *                      restoring it would hand him back a game he removed
 *                      himself, which is not what the button says.
 *
 * An empty result means the answer moved nothing, and nothing is offered
 * back — an "Undo" on a no-op is a lie about what just happened.
 */
export function newlyRetiredOf(
  retired: readonly string[],
  selection: readonly string[],
  alreadyUnseen: readonly string[],
): string[] {
  const selected = new Set(selection);
  const known = new Set(alreadyUnseen);
  const fresh: string[] = [];
  for (const fixtureId of retired) {
    if (known.has(fixtureId) || !selected.has(fixtureId)) continue;
    known.add(fixtureId);
    fresh.push(fixtureId);
  }
  return fresh;
}

// ── smart serving (EYE-TEST-SERVE) ──

/**
 * Serving is a RANKING, never a filter. Everything below decides which of the
 * pairs a voter is already eligible for he sees FIRST; nothing here can add a
 * pair to that set or remove one from it. The eligibility rules — the picker's
 * selection, serve-time conflict exclusion, single-use pairs, same-fixture
 * then same-league, never cross-league, the gameweek cap — are untouched and
 * live above this section.
 *
 * The crowd is a scarce resource: a gameweek has thousands of comparable pairs
 * and only so many eyes. Three things make one pair worth more than another,
 * in this priority (the ticket's, kept as the weights' order):
 *
 *   1. COVERAGE (0.60) — a player below the liquidity threshold has no crowd
 *      factor at all. Votes spent on him buy a verdict that does not yet
 *      exist; votes spent on a player already past the threshold only sharpen
 *      one. This is the same liquidity targeting serving always did, now
 *      expressed as a bounded term rather than a sort key.
 *   2. CONTESTED (0.25) — a pair the running record calls even is where a vote
 *      carries the most information. Elo IS that running split: the
 *      expectation between two ratings is what the crowd's votes so far say
 *      the next vote will do, so 0.5 is a dead heat and 0.9 is a settled
 *      question. Damped by the thinner side's evidence, so a pair of unrated
 *      players scores 0 here rather than a spurious "even" — before there are
 *      votes there is no split to be near.
 *   3. RELEVANCE (0.15) — a verdict on a player the draft actually uses is
 *      worth more than one on a player nobody can field. Price is the
 *      prominence signal that exists today; crowd-wide ownership would be the
 *      better one and is not computable per serve (no ownership rollup —
 *      OWNER DECISION 2, FW-SCOUT), so the term reads price alone and any
 *      unpriced player scores 0 rather than an invented middle.
 *
 * Weights sum to 1 and each term is in [0,1], so the value is in [0,1] and the
 * ordering is a TRADE-OFF, not a lexicographic cascade: a well-covered pair
 * that is genuinely contested can outrank a barely-covered one that is not.
 * That is the intent — the priority is which term moves the needle hardest,
 * not which term speaks first.
 */
export const CROWD_SERVE_W_COVERAGE = 0.6;
export const CROWD_SERVE_W_CONTESTED = 0.25;
export const CROWD_SERVE_W_RELEVANCE = 0.15;

/**
 * How many candidates the relevance term is allowed to cost a price lookup
 * for, in coverage order. NOT a cap on eligibility or on serving — every
 * eligible player is still rankable and still servable; those past the cap
 * simply score 0 relevance, and they are by construction the best-covered
 * ones, which the coverage term has already sunk. A voter who picked a normal
 * handful of games sits far under it and is fully priced.
 */
export const CROWD_SERVE_PRICE_LOOKUP_MAX = 120;

/** One player as the ranking sees him — his standing in the crowd's ledger,
 *  plus the one draft signal. `price` is null when unpriced or unlooked-up. */
export interface ServeCandidate {
  readonly playerId: string;
  readonly voteCount: number;
  readonly rating: number;
  readonly price: number | null;
}

/** The value breakdown, kept whole so a probe can say WHY a pair won. */
export interface ServeValue {
  readonly coverage: number;
  readonly contested: number;
  readonly relevance: number;
  readonly value: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * 1 at no votes, falling linearly to 0 at the liquidity threshold and staying
 * there. The threshold is the right anchor because it is exactly where votes
 * stop buying a verdict and start refining one; a non-finite count is no
 * evidence of votes, so it reads as unvoted (deriveCrowdFactors' rule).
 */
export function coverageValueOf(voteCount: number): number {
  if (!Number.isFinite(voteCount)) return 1;
  return clamp01(1 - voteCount / CROWD_LIQUIDITY_THRESHOLD);
}

/**
 * 1 when the running record says the pair is a coin flip, 0 when it says one
 * man is a lock — scaled by how much record there is. The confidence factor is
 * the THINNER side's vote count against the same threshold: one heavily-voted
 * player paired with a fresh one has no split between them yet, however
 * confident his own rating looks.
 */
export function contestedValueOf(a: ServeCandidate, b: ServeCandidate): number {
  const ratingA = Number.isFinite(a.rating) ? a.rating : CROWD_ELO_START;
  const ratingB = Number.isFinite(b.rating) ? b.rating : CROWD_ELO_START;
  const evenness = 1 - 2 * Math.abs(eloExpectation(ratingA, ratingB) - 0.5);
  const thinner = Math.min(
    Number.isFinite(a.voteCount) ? a.voteCount : 0,
    Number.isFinite(b.voteCount) ? b.voteCount : 0,
  );
  return clamp01(evenness) * clamp01(thinner / CROWD_LIQUIDITY_THRESHOLD);
}

/**
 * The player's price against the dearest in the ranked pool — a relative
 * prominence, so it means the same thing in a cheap league and an expensive
 * one. Unpriced is 0 (the fail-closed reading FW-1 STOP-4 gave a null price),
 * never an invented midpoint.
 */
export function relevanceValueOf(price: number | null, maxPrice: number): number {
  if (price === null || !Number.isFinite(price) || price <= 0) return 0;
  if (!Number.isFinite(maxPrice) || maxPrice <= 0) return 0;
  return clamp01(price / maxPrice);
}

/**
 * The value of serving this pair — or, with `partner` null, of the target
 * alone (contested is a property of two players and is 0 for one). Pair terms
 * average the two sides: a pair is worth what it does for BOTH players'
 * verdicts, and a needy player paired with a saturated one is worth less than
 * two needy ones.
 */
export function serveValueOf(
  target: ServeCandidate,
  partner: ServeCandidate | null,
  maxPrice: number,
): ServeValue {
  const coverage =
    partner === null
      ? coverageValueOf(target.voteCount)
      : (coverageValueOf(target.voteCount) + coverageValueOf(partner.voteCount)) / 2;
  const contested = partner === null ? 0 : contestedValueOf(target, partner);
  const relevance =
    partner === null
      ? relevanceValueOf(target.price, maxPrice)
      : (relevanceValueOf(target.price, maxPrice) +
          relevanceValueOf(partner.price, maxPrice)) /
        2;
  return {
    coverage,
    contested,
    relevance,
    value:
      CROWD_SERVE_W_COVERAGE * coverage +
      CROWD_SERVE_W_CONTESTED * contested +
      CROWD_SERVE_W_RELEVANCE * relevance,
  };
}

/**
 * A stable per-seed number in [0,1) — FNV-1a, so it is arithmetic rather than
 * entropy.
 *
 * Serving used `Math.random()` to keep every voter from hammering the same
 * under-voted head in lockstep. That property is worth keeping and randomness
 * is the wrong way to buy it: seeded with `${userId}:${playerId}` this
 * de-synchronizes voters exactly as well — two users rank the same tied
 * candidates differently — while making one user's serve a FUNCTION of stored
 * state, which is what lets the ranking be tested at all.
 */
export function serveJitterOf(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0x1_0000_0000;
}

export interface ServeRankable {
  readonly playerId: string;
  readonly value: number;
  readonly jitter: number;
}

/**
 * Rank by value, break ties on the per-user jitter, break jitter collisions on
 * the player id. The last key makes the order TOTAL: the result is a function
 * of the set of rows, not of the order they arrived in, so a ranking cannot
 * shift because the database returned the same rows in a different sequence.
 */
export function rankForServing<T extends ServeRankable>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      b.value - a.value ||
      a.jitter - b.jitter ||
      (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0),
  );
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
