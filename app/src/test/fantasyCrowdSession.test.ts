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
 * The serving-eligibility rules are tested here rather than against a
 * database for the same reason the factor rules are: they are arithmetic over
 * sets, and the Convex module is a thin wrapper (lib/fantasyCrowd header).
 */

import { describe, expect, it } from "vitest";

import {
  CROWD_DAY_WINDOW_MAX_MS,
  CROWD_REVEAL_MIN_VOTES,
  CROWD_SESSION_GOAL,
  consensusRevealOf,
  eligibleForSelection,
  selectionAfterCascade,
  serveGateOf,
  todayStartOf,
  todaysTenOf,
  unseenFixturesOf,
} from "../../convex/lib/fantasyCrowd";
import { localDayStart, revealTone } from "../lib/weekendVoteCard";

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
