/**
 * EYE-TEST-TEN — the vote SESSION's rules, as pure unit tests.
 *
 * The chore this ticket killed had four parts, and each one is a rule with a
 * property worth pinning:
 *
 *   the picker  — serving draws from the games he said he watched, and
 *                 "I watched nothing" is an ANSWER, not an absence
 *   the cascade — a didn't-see retires a FIXTURE, not just a pair, and never
 *                 the other card's fixture when the pair spans two
 *   the ten     — a finishable goal, counted in judgments only
 *   the reveal  — post-vote, honest at the ends, silent below a real sample
 *
 * EYE-TEST-SERVE adds two more, at the bottom of the file:
 *
 *   the ranking — serving orders the eligible set by what a vote is worth to
 *                 the crowd, and ONLY orders it: same voter and same state
 *                 give the same pair, row order cannot move it, and no term
 *                 can add or drop a candidate
 *   the undo    — a didn't-see is takeable back for exactly as long as the
 *                 toast offering it, and restores exactly what it took
 *
 * The serving-eligibility rules are tested here rather than against a
 * database for the same reason the factor rules are: they are arithmetic over
 * sets, and the Convex module is a thin wrapper (lib/fantasyCrowd header).
 */

import { describe, expect, it } from "vitest";

import {
  CROWD_DAY_WINDOW_MAX_MS,
  CROWD_ELO_START,
  CROWD_LIQUIDITY_THRESHOLD,
  CROWD_REVEAL_MIN_VOTES,
  CROWD_SERVE_W_CONTESTED,
  CROWD_SERVE_W_COVERAGE,
  CROWD_SERVE_W_RELEVANCE,
  CROWD_SESSION_GOAL,
  CROWD_UNDO_WINDOW_MS,
  consensusRevealOf,
  contestedValueOf,
  coverageValueOf,
  eligibleForSelection,
  newlyRetiredOf,
  rankForServing,
  relevanceValueOf,
  selectionAfterCascade,
  selectionAfterUndo,
  serveGateOf,
  serveJitterOf,
  serveValueOf,
  todayStartOf,
  todaysTenOf,
  undoWindowOpenAt,
  unseenAfterUndo,
  unseenFixturesOf,
  type ServeCandidate,
} from "../../convex/lib/fantasyCrowd";
import { localDayStart, revealTone, undoToastMs } from "../lib/weekendVoteCard";

const player = (playerId: string, fixtureId: string) => ({ playerId, fixtureId });

// ── the picker gate ──

describe("the fixture picker gate (EYE-TEST-TEN §1)", () => {
  it("distinguishes never-asked from answered-nothing", () => {
    // The whole reason the picker's answer is an ARRAY ON A ROW rather than a
    // nullable field: these two states must not collapse into each other.
    expect(serveGateOf(null).kind).toBe("needs_picker");
    expect(serveGateOf([]).kind).toBe("no_fixtures");
  });

  it("opens serving on a real selection, deduped into a set", () => {
    const gate = serveGateOf(["f1", "f2", "f1"]);
    expect(gate.kind).toBe("ok");
    if (gate.kind !== "ok") throw new Error("unreachable");
    expect(gate.fixtureIds.size).toBe(2);
    expect(gate.fixtureIds.has("f1")).toBe(true);
  });

  it("treats a fully cascaded-away selection as answered-nothing, never as unasked", () => {
    // A voter who picked two games and said "didn't see it" to both must land
    // in the friendly empty state — NOT back at the picker as if he had never
    // answered, which would read as the app forgetting him.
    const after = selectionAfterCascade(["f1", "f2"], ["f1", "f2"]);
    expect(serveGateOf(after).kind).toBe("no_fixtures");
  });
});

// ── serving eligibility ──

describe("serving eligibility (picker × conflicts)", () => {
  const pool = [
    player("p1", "f1"),
    player("p2", "f1"),
    player("p3", "f2"),
    player("p4", "f3"),
  ];

  it("serves only from selected fixtures", () => {
    const eligible = eligibleForSelection(pool, new Set(["f1"]), new Set());
    expect(eligible.map((p) => p.playerId)).toEqual(["p1", "p2"]);
  });

  it("still excludes the user's own players inside a selected fixture", () => {
    // Conflict exclusion is LOCKED and independent of the picker: picking the
    // game you watched must never become a way to vote on your own squad.
    const eligible = eligibleForSelection(pool, new Set(["f1", "f2"]), new Set(["p1"]));
    expect(eligible.map((p) => p.playerId)).toEqual(["p2", "p3"]);
  });

  it("constrains BOTH sides of a cross-fixture pair, not just the target", () => {
    // Pairs may span two fixtures (same-league fallback). Because the filter
    // runs before partner selection, an unselected fixture cannot supply the
    // partner either — the picker is not a half-promise.
    const eligible = eligibleForSelection(pool, new Set(["f1", "f3"]), new Set());
    expect(eligible.map((p) => p.fixtureId).every((f) => f !== "f2")).toBe(true);
    expect(eligible).toHaveLength(3);
  });

  it("leaves fewer than two eligible players when the selection is thin — the exhausted state", () => {
    expect(eligibleForSelection(pool, new Set(["f3"]), new Set()).length).toBeLessThan(2);
  });
});

// ── the cascade ──

describe("the didn't-see cascade (EYE-TEST-TEN §2)", () => {
  it("retires only the named card's fixture when the pair spans two", () => {
    expect(unseenFixturesOf("a", "f1", "f2")).toEqual(["f1"]);
    expect(unseenFixturesOf("b", "f1", "f2")).toEqual(["f2"]);
  });

  it("retires both fixtures on the combined answer", () => {
    expect(unseenFixturesOf("both", "f1", "f2")).toEqual(["f1", "f2"]);
  });

  it("collapses the combined answer to one fixture when both cards share it", () => {
    // The combined button is only OFFERED in this case; retiring "f1, f1"
    // would be harmless but dishonest about what was answered.
    expect(unseenFixturesOf("both", "f1", "f1")).toEqual(["f1"]);
  });

  it("removes the retired fixture from the selection and leaves the rest", () => {
    expect(selectionAfterCascade(["f1", "f2", "f3"], ["f2"])).toEqual(["f1", "f3"]);
  });

  it("is idempotent — re-retiring an already-gone fixture changes nothing", () => {
    expect(selectionAfterCascade(["f1", "f3"], ["f2"])).toEqual(["f1", "f3"]);
  });

  it("survives a picker re-save — a retired game cannot be re-added", () => {
    // The "never again" half of the rule. setWatchedFixturesFor filters the
    // requested selection through the remembered retirements with exactly this
    // operation, so a "+ add games" tap on a game he already answered for is
    // dropped rather than resurrecting its pairs.
    const retired = ["f2"];
    const requestedIncludingRetired = ["f1", "f2", "f3"];
    expect(selectionAfterCascade(requestedIncludingRetired, retired)).toEqual(["f1", "f3"]);
  });

  it("excludes every REMAINING pair from a retired fixture, not just the answered one", () => {
    // The property the cascade exists for: one "didn't see him" must end that
    // game for the weekend, not cost one pair and come straight back.
    const pool = [player("p1", "f1"), player("p2", "f1"), player("p3", "f2")];
    const after = selectionAfterCascade(["f1", "f2"], unseenFixturesOf("a", "f1", "f1"));
    const gate = serveGateOf(after);
    if (gate.kind !== "ok") throw new Error("unreachable");
    expect(eligibleForSelection(pool, gate.fixtureIds, new Set())).toEqual([
      player("p3", "f2"),
    ]);
  });
});

// ── Today's Ten ──

describe("Today's Ten (EYE-TEST-TEN §3)", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const dayStart = 1_755_216_000_000; // an arbitrary midnight

  it("counts only today's votes", () => {
    const progress = todaysTenOf(
      [dayStart - 1, dayStart, dayStart + 1000, dayStart + DAY - 1],
      dayStart,
    );
    expect(progress.voted).toBe(3);
  });

  it("completes at exactly ten and keeps counting past it", () => {
    const ten = Array.from({ length: CROWD_SESSION_GOAL }, (_, i) => dayStart + i);
    expect(todaysTenOf(ten.slice(0, 9), dayStart).complete).toBe(false);
    expect(todaysTenOf(ten, dayStart).complete).toBe(true);
    // Volunteers past the goal are not told their extra work stopped
    // registering — the counter keeps climbing, the goal stays 10.
    const twelve = todaysTenOf([...ten, dayStart + 11, dayStart + 12], dayStart);
    expect(twelve.voted).toBe(12);
    expect(twelve.goal).toBe(CROWD_SESSION_GOAL);
  });

  it("ignores unanswered pairs — a ten made of skips would thank nobody", () => {
    // `undefined` is a still-served pair's votedAt. Skips never reach here at
    // all (the caller filters to status "voted"); this is the belt.
    expect(todaysTenOf([undefined, undefined, dayStart + 1], dayStart).voted).toBe(1);
  });

  it("is never blocked on ten — nine votes is a valid finished set at exhaustion", () => {
    // The done-state at exhaustion is serving's call, not the counter's: the
    // counter must simply report the truth and not pretend nine is complete.
    const nine = todaysTenOf(
      Array.from({ length: 9 }, (_, i) => dayStart + i),
      dayStart,
    );
    expect(nine.complete).toBe(false);
    expect(nine.voted).toBe(9);
  });
});

describe("the day boundary", () => {
  const now = 1_755_260_000_000;
  const utcMidnight = Math.floor(now / 86_400_000) * 86_400_000;

  it("falls back to UTC midnight when the client says nothing", () => {
    expect(todayStartOf(now)).toBe(utcMidnight);
    expect(todayStartOf(now, null)).toBe(utcMidnight);
  });

  it("honours a plausible client-local midnight", () => {
    const localish = now - 10 * 60 * 60 * 1000;
    expect(todayStartOf(now, localish)).toBe(localish);
  });

  it("clamps a future, stale, or non-finite claim back to UTC midnight", () => {
    // Nothing but a counter rides on this, but a claim that would freeze the
    // ten forever ("my day started in 1970") is refused all the same.
    expect(todayStartOf(now, now + 1)).toBe(utcMidnight);
    expect(todayStartOf(now, now - CROWD_DAY_WINDOW_MAX_MS - 1)).toBe(utcMidnight);
    expect(todayStartOf(now, Number.NaN)).toBe(utcMidnight);
    expect(todayStartOf(now, Number.POSITIVE_INFINITY)).toBe(utcMidnight);
  });

  it("accepts the client helper's own output at any timezone offset", () => {
    const start = localDayStart(now);
    expect(todayStartOf(now, start)).toBe(start);
  });
});

// ── the reveal ──

describe("the consensus reveal (EYE-TEST-TEN §4)", () => {
  it("withholds a percentage below the sample threshold", () => {
    const reveal = consensusRevealOf(1, CROWD_REVEAL_MIN_VOTES - 1);
    expect(reveal.lowSample).toBe(true);
    expect(reveal.percent).toBeNull();
    expect(revealTone(reveal)).toBe("first");
  });

  it("shows a percentage at exactly the threshold", () => {
    const reveal = consensusRevealOf(3, CROWD_REVEAL_MIN_VOTES);
    expect(reveal.lowSample).toBe(false);
    expect(reveal.percent).toBe(60);
    expect(revealTone(reveal)).toBe("with");
  });

  it("always speaks the voter's OWN share, majority or not", () => {
    expect(consensusRevealOf(28, 41).percent).toBe(68);
    expect(revealTone(consensusRevealOf(28, 41))).toBe("with");
    expect(consensusRevealOf(13, 41).percent).toBe(32);
    expect(revealTone(consensusRevealOf(13, 41))).toBe("against");
  });

  it("never rounds a dissenter out of existence", () => {
    // 199/200 rounds to 100% and 1/200 to 0% — both erase a vote that is
    // sitting right there in the tally. The ends are clamped instead.
    expect(consensusRevealOf(199, 200).percent).toBe(99);
    expect(consensusRevealOf(1, 200).percent).toBe(1);
    // A genuinely unanimous crowd still reads 100.
    expect(consensusRevealOf(200, 200).percent).toBe(100);
  });

  it("counts the caller inside his own crowd", () => {
    // The reveal is read AFTER the vote lands, so a lone first voter is 1 of
    // 1, never 0 of 0.
    const reveal = consensusRevealOf(1, 1);
    expect(reveal.total).toBe(1);
    expect(reveal.withYou).toBe(1);
    expect(reveal.lowSample).toBe(true);
  });

  it("treats a tally that lost the caller's own vote as a read race, not a fact", () => {
    const reveal = consensusRevealOf(3, 0);
    expect(reveal.total).toBe(3);
    expect(reveal.percent === null || reveal.percent <= 100).toBe(true);
  });

  it("calls a dead-even split a minority — the voter is not told he led it", () => {
    const reveal = consensusRevealOf(5, 10);
    expect(reveal.majority).toBe(false);
    expect(reveal.percent).toBe(50);
    expect(revealTone(reveal)).toBe("against");
  });
});

// ── smart serving (EYE-TEST-SERVE §2) ──

const candidate = (
  playerId: string,
  voteCount: number,
  rating: number = CROWD_ELO_START,
  price: number | null = null,
): ServeCandidate => ({ playerId, voteCount, rating, price });

const MAX_PRICE = 12;
const value = (a: ServeCandidate, b: ServeCandidate | null = null) =>
  serveValueOf(a, b, MAX_PRICE).value;

/** The serve path's own ordering, as the module composes it: value from the
 *  rules, jitter from (voter, player). */
const rankFor = (voter: string, pool: readonly ServeCandidate[]): string[] =>
  rankForServing(
    pool.map((c) => ({
      playerId: c.playerId,
      value: value(c),
      jitter: serveJitterOf(`${voter}:${c.playerId}`),
    })),
  ).map((row) => row.playerId);

describe("the serve ranking's terms", () => {
  it("is a ranking and nothing else — every candidate in, every candidate out", () => {
    // The ticket's hard constraint: serving may reorder the eligible set, never
    // change it. A term that could drop a candidate would be an eligibility
    // rule wearing a weight's clothes.
    const pool = [
      candidate("p1", 0),
      candidate("p2", 99),
      candidate("p3", Number.NaN),
      candidate("p4", 3, 1900, 11),
    ];
    const ranked = rankFor("voter-1", pool);
    expect(ranked).toHaveLength(pool.length);
    expect([...ranked].sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("weights the three terms in the ticket's priority, and stays inside [0,1]", () => {
    expect(
      CROWD_SERVE_W_COVERAGE + CROWD_SERVE_W_CONTESTED + CROWD_SERVE_W_RELEVANCE,
    ).toBeCloseTo(1, 10);
    expect(CROWD_SERVE_W_COVERAGE).toBeGreaterThan(CROWD_SERVE_W_CONTESTED);
    expect(CROWD_SERVE_W_CONTESTED).toBeGreaterThan(CROWD_SERVE_W_RELEVANCE);

    const best = serveValueOf(candidate("a", 0, 1500, 12), candidate("b", 0, 1500, 12), MAX_PRICE);
    const worst = serveValueOf(
      candidate("a", 500, 1000, null),
      candidate("b", 500, 2000, null),
      MAX_PRICE,
    );
    expect(best.value).toBeLessThanOrEqual(1);
    expect(worst.value).toBeGreaterThanOrEqual(0);
    expect(worst.value).toBeLessThan(best.value);
  });

  it("counts coverage against the liquidity threshold — the point votes stop buying a verdict", () => {
    expect(coverageValueOf(0)).toBe(1);
    expect(coverageValueOf(CROWD_LIQUIDITY_THRESHOLD)).toBe(0);
    // Past the threshold there is nothing left to buy; it does not go negative
    // and start bidding against the other terms.
    expect(coverageValueOf(CROWD_LIQUIDITY_THRESHOLD * 4)).toBe(0);
    expect(coverageValueOf(CROWD_LIQUIDITY_THRESHOLD / 2)).toBeCloseTo(0.5, 10);
    // A non-finite count is no evidence of votes (deriveCrowdFactors' rule).
    expect(coverageValueOf(Number.NaN)).toBe(1);
  });

  it("puts an uncovered pair ahead of a saturated one, however contested and dear", () => {
    const uncovered = serveValueOf(candidate("a", 0), candidate("b", 0), MAX_PRICE);
    const saturated = serveValueOf(
      candidate("c", CROWD_LIQUIDITY_THRESHOLD, 1500, 12),
      candidate("d", CROWD_LIQUIDITY_THRESHOLD, 1500, 12),
      MAX_PRICE,
    );
    expect(uncovered.value).toBeGreaterThan(saturated.value);
  });

  it("says nothing about a split that does not exist yet", () => {
    // Two unrated players sit at identical Elo, which LOOKS like a dead heat.
    // It is not one — there is no record. The confidence damp is what stops
    // the contested term inventing a signal out of the start rating.
    expect(contestedValueOf(candidate("a", 0), candidate("b", 0))).toBe(0);
    // One heavy voting record does not make the PAIR's split known.
    expect(
      contestedValueOf(candidate("a", CROWD_LIQUIDITY_THRESHOLD * 2), candidate("b", 0)),
    ).toBe(0);
  });

  it("breaks a coverage tie toward the pair the record calls even", () => {
    const votes = CROWD_LIQUIDITY_THRESHOLD;
    const even = serveValueOf(
      candidate("a", votes, 1500),
      candidate("b", votes, 1520),
      MAX_PRICE,
    );
    const lopsided = serveValueOf(
      candidate("c", votes, 1200),
      candidate("d", votes, 1900),
      MAX_PRICE,
    );
    expect(even.coverage).toBe(lopsided.coverage);
    expect(even.contested).toBeGreaterThan(lopsided.contested);
    expect(even.value).toBeGreaterThan(lopsided.value);
  });

  it("breaks a coverage-and-split tie toward the draft's prominent players", () => {
    const votes = CROWD_LIQUIDITY_THRESHOLD;
    const dear = serveValueOf(
      candidate("a", votes, 1500, 12),
      candidate("b", votes, 1500, 11),
      MAX_PRICE,
    );
    const cheap = serveValueOf(
      candidate("c", votes, 1500, 4),
      candidate("d", votes, 1500, 4),
      MAX_PRICE,
    );
    expect(dear.contested).toBe(cheap.contested);
    expect(dear.value).toBeGreaterThan(cheap.value);
  });

  it("scores an unpriced player 0 relevance rather than an invented middle", () => {
    expect(relevanceValueOf(null, MAX_PRICE)).toBe(0);
    expect(relevanceValueOf(0, MAX_PRICE)).toBe(0);
    expect(relevanceValueOf(Number.NaN, MAX_PRICE)).toBe(0);
    // A pool with no prices at all cannot rank by price; it must not divide by
    // zero into an infinity that swamps the other two terms.
    expect(relevanceValueOf(6, 0)).toBe(0);
    expect(relevanceValueOf(6, MAX_PRICE)).toBeCloseTo(0.5, 10);
    expect(relevanceValueOf(MAX_PRICE * 2, MAX_PRICE)).toBe(1);
  });

  it("holds the three terms apart — relevance can never outrank coverage", () => {
    // The priority is a claim about magnitudes, not just about weights: the
    // dearest possible pair, fully saturated, must still lose to an unvoted
    // pair nobody can field.
    const dearAndSaturated = serveValueOf(
      candidate("a", CROWD_LIQUIDITY_THRESHOLD, 1500, MAX_PRICE),
      candidate("b", CROWD_LIQUIDITY_THRESHOLD, 1500, MAX_PRICE),
      MAX_PRICE,
    );
    const unvotedAndWorthless = serveValueOf(
      candidate("c", 0, 1500, null),
      candidate("d", 0, 1500, null),
      MAX_PRICE,
    );
    expect(unvotedAndWorthless.value).toBeGreaterThan(dearAndSaturated.value);
  });
});

describe("the serve ranking's determinism (EYE-TEST-SERVE §3)", () => {
  const pool = [
    candidate("p1", 0, 1500, 8),
    candidate("p2", 4, 1520, 11),
    candidate("p3", 4, 1480, null),
    candidate("p4", CROWD_LIQUIDITY_THRESHOLD, 1700, 12),
    candidate("p5", 0, 1500, 8),
    candidate("p6", 12, 1450, 5),
  ];

  it("returns the same order for the same voter and the same state", () => {
    // The property Math.random() cost us: one voter's next pair is now a
    // FUNCTION of stored rows, which is what makes serving testable at all.
    expect(rankFor("voter-1", pool)).toEqual(rankFor("voter-1", pool));
  });

  it("does not depend on the order the rows arrived in", () => {
    // The database is free to return the same rows in any order. A ranking
    // that shifted with it would be reproducible only by accident.
    const shuffled = [pool[3], pool[0], pool[5], pool[2], pool[4], pool[1]];
    expect(rankFor("voter-1", shuffled)).toEqual(rankFor("voter-1", pool));
    expect(rankFor("voter-1", [...pool].reverse())).toEqual(rankFor("voter-1", pool));
  });

  it("still de-synchronizes voters across a tie", () => {
    // What the random jitter was FOR: an all-tied field must not send every
    // voter at the same under-voted head in lockstep. Determinism per voter,
    // divergence across voters.
    const tied = ["a", "b", "c", "d", "e", "f"].map((id) => candidate(id, 0));
    const orders = new Set(
      Array.from({ length: 8 }, (_, i) => rankFor(`voter-${i}`, tied).join(",")),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("ranks by value first and only then by the jitter", () => {
    // The tie-break must stay a tie-break: no seed may lift a saturated
    // candidate over an unvoted one.
    for (let i = 0; i < 16; i += 1) {
      const ranked = rankFor(`voter-${i}`, pool);
      expect(ranked[ranked.length - 1]).toBe("p4");
    }
  });

  it("gives a total order — equal values and colliding jitter still settle", () => {
    const rows = [
      { playerId: "z", value: 0.5, jitter: 0.5 },
      { playerId: "a", value: 0.5, jitter: 0.5 },
    ];
    expect(rankForServing(rows).map((r) => r.playerId)).toEqual(["a", "z"]);
    expect(rankForServing([...rows].reverse()).map((r) => r.playerId)).toEqual(["a", "z"]);
  });

  it("keeps the jitter inside [0,1) so it can never swamp a value gap", () => {
    for (const seed of ["", "a", "voter-1:p1", "🙂", "x".repeat(200)]) {
      const jitter = serveJitterOf(seed);
      expect(jitter).toBeGreaterThanOrEqual(0);
      expect(jitter).toBeLessThan(1);
    }
  });
});

// ── the undo (EYE-TEST-SERVE §1) ──

describe("the didn't-see undo window", () => {
  const votedAt = 1_755_216_000_000;

  it("is open for exactly the toast's five seconds", () => {
    expect(undoWindowOpenAt(votedAt, votedAt)).toBe(true);
    expect(undoWindowOpenAt(votedAt, votedAt + CROWD_UNDO_WINDOW_MS)).toBe(true);
    expect(undoWindowOpenAt(votedAt, votedAt + CROWD_UNDO_WINDOW_MS + 1)).toBe(false);
  });

  it("is permanent after it — the EYE-TEST-TEN cascade is not reopened by a late tap", () => {
    expect(undoWindowOpenAt(votedAt, votedAt + 60_000)).toBe(false);
    expect(undoWindowOpenAt(votedAt, votedAt + 86_400_000)).toBe(false);
  });

  it("refuses an answer with no stamp at all", () => {
    expect(undoWindowOpenAt(undefined, votedAt)).toBe(false);
    expect(undoWindowOpenAt(null, votedAt)).toBe(false);
    expect(undoWindowOpenAt(Number.NaN, votedAt)).toBe(false);
  });

  it("fails toward the voter on a backwards clock step", () => {
    expect(undoWindowOpenAt(votedAt, votedAt - 1)).toBe(true);
  });

  it("never outlives the server's offer on the client", () => {
    const expiresAt = votedAt + CROWD_UNDO_WINDOW_MS;
    // The round trip has already spent part of the window.
    expect(undoToastMs(expiresAt, votedAt + 800)).toBe(CROWD_UNDO_WINDOW_MS - 800);
    // A dead offer shows no toast at all rather than an Undo the server refuses.
    expect(undoToastMs(expiresAt, expiresAt)).toBe(0);
    expect(undoToastMs(expiresAt, expiresAt + 5_000)).toBe(0);
    // A skewed client cannot leave the button up longer than the window.
    expect(undoToastMs(expiresAt, votedAt - 60_000)).toBe(CROWD_UNDO_WINDOW_MS);
    expect(undoToastMs(Number.NaN, votedAt)).toBe(0);
  });
});

describe("what an undo restores", () => {
  it("puts back exactly what the cascade took — selection and ledger both", () => {
    const selection = ["f1", "f2", "f3"];
    const retired = unseenFixturesOf("a", "f2", "f2");
    const taken = newlyRetiredOf(retired, selection, []);
    const afterCascade = selectionAfterCascade(selection, retired);
    const afterUndo = selectionAfterUndo(afterCascade, taken);

    expect(afterCascade).toEqual(["f1", "f3"]);
    expect([...afterUndo].sort()).toEqual([...selection].sort());
    expect(unseenAfterUndo(taken, taken)).toEqual([]);
  });

  it("restores both fixtures of a combined didn't-see that spanned two games", () => {
    const selection = ["f1", "f2"];
    const retired = unseenFixturesOf("both", "f1", "f2");
    const taken = newlyRetiredOf(retired, selection, []);
    expect(taken).toEqual(["f1", "f2"]);
    expect([...selectionAfterUndo(selectionAfterCascade(selection, retired), taken)].sort()).toEqual(
      ["f1", "f2"],
    );
  });

  it("offers nothing back when the answer changed nothing", () => {
    // A pair served BEFORE an earlier didn't-see can still be answered after
    // it. Undoing that answer must not reopen the game the EARLIER tap closed
    // — it retired nothing, so there is nothing to offer, and no toast.
    expect(newlyRetiredOf(["f2"], ["f1"], ["f2"])).toEqual([]);
    // A game the voter dropped himself through the picker is not handed back
    // by an undo either.
    expect(newlyRetiredOf(["f2"], ["f1", "f3"], [])).toEqual([]);
  });

  it("un-retires only its own game, leaving other retirements standing", () => {
    const unseen = ["f1", "f2"];
    expect(unseenAfterUndo(unseen, ["f2"])).toEqual(["f1"]);
  });

  it("never duplicates a fixture already back on the list", () => {
    // Belt for a double-apply: the row's stamp refuses the second undo, and
    // the arithmetic would be harmless anyway.
    expect(selectionAfterUndo(["f1", "f2"], ["f2"])).toEqual(["f1", "f2"]);
  });

  it("leaves a re-add refusable again once the game is retired for good", () => {
    // After the window closes the retirement stands, and the durable half of
    // the cascade still refuses a picker re-add.
    const unseen = ["f2"];
    expect(selectionAfterCascade(["f1", "f2", "f3"], unseen)).toEqual(["f1", "f3"]);
  });
});
