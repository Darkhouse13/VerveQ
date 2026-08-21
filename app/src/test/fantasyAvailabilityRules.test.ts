/**
 * Weekend Fantasy FW-AVAIL — availability classification, as pure unit tests.
 *
 * The row shapes and the reason vocabulary are the measured ones: 899 rows
 * pulled from API-Football's `/injuries` across the eight covered leagues on
 * 2026-08-20. Two facts from that pull drive most of what is asserted here:
 *
 *   - rows are FIXTURE-bound and span several rounds (dates 2026-08-07 through
 *     2026-08-23 in one response), so the gameweek join is load-bearing, not a
 *     tidy-up;
 *   - two of the eight leagues returned zero rows for the whole season, so
 *     "no rows" must never be readable as "everyone is fit".
 */

import { describe, expect, it } from "vitest";

import type { FeedInjuryRow } from "../../convex/fantasyApiFootball";
import { availabilityRecordValidator } from "../../convex/fantasyAvailability";
import {
  categoriseReason,
  collapseForGameweek,
  coverageOf,
  toAvailabilityRecord,
} from "../../convex/lib/fantasyAvailabilityRules";

function row(overrides: {
  playerId?: number | null;
  type?: string | null;
  reason?: string | null;
  teamId?: number | null;
  fixtureId?: number | null;
}): FeedInjuryRow {
  return {
    player: {
      id: overrides.playerId === undefined ? 22090 : overrides.playerId,
      name: "W. Saliba",
      type: overrides.type === undefined ? "Missing Fixture" : overrides.type,
      reason: overrides.reason === undefined ? "Back Injury" : overrides.reason,
    },
    team: { id: overrides.teamId === undefined ? 42 : overrides.teamId, name: "Arsenal" },
    fixture: {
      id: overrides.fixtureId === undefined ? 1557367 : overrides.fixtureId,
      date: "2026-08-21T19:00:00+00:00",
    },
    league: { id: 39, season: 2026 },
  };
}

describe("categoriseReason — the measured vocabulary", () => {
  // Every distinct reason string in the 2026-08-20 pull, with its bucket.
  const CASES: ReadonlyArray<readonly [string, "injury" | "suspension" | "other"]> = [
    ["Knee Injury", "injury"],
    ["Injury", "injury"],
    ["Muscle Injury", "injury"],
    ["Hamstring Injury", "injury"],
    ["Ankle Injury", "injury"],
    ["Groin Injury", "injury"],
    ["Knock", "injury"],
    ["Achilles Tendon Injury", "injury"],
    ["Foot Injury", "injury"],
    ["Thigh Injury", "injury"],
    ["Leg Injury", "injury"],
    ["Broken Leg", "injury"],
    ["Shoulder Injury", "injury"],
    ["Calf Injury", "injury"],
    ["Surgery", "injury"],
    ["Back Injury", "injury"],
    ["Ribs Injury", "injury"],
    ["Hip Injury", "injury"],
    ["Head Injury", "injury"],
    ["Arm Injury", "injury"],
    ["Illness", "injury"],
    ["Health problems", "injury"],
    ["Red Card", "suspension"],
    ["Yellow Cards", "suspension"],
    ["Suspended", "suspension"],
    ["Inactive", "other"],
    ["Lacking Match Fitness", "other"],
    ["Coach's decision", "other"],
  ];

  it.each(CASES)("buckets %j as %s", (reason, expected) => {
    expect(categoriseReason(reason)).toBe(expected);
  });

  it("never guesses at a missing reason", () => {
    expect(categoriseReason(null)).toBe("other");
    expect(categoriseReason("")).toBe("other");
  });

  it("reads a suspension before an injury when the words collide", () => {
    // "Suspended (knee injury pending appeal)" is a suspension, not a knock.
    expect(categoriseReason("Suspended after injury review")).toBe("suspension");
  });
});

describe("toAvailabilityRecord", () => {
  it("maps the two observed types", () => {
    expect(toAvailabilityRecord(row({ type: "Missing Fixture" }))?.status).toBe("out");
    expect(toAvailabilityRecord(row({ type: "Questionable" }))?.status).toBe("doubtful");
  });

  it("degrades an unknown type to the SOFTER claim", () => {
    // Over-stating a doubt as a certainty is the error that costs a transfer.
    expect(toAvailabilityRecord(row({ type: "Probable" }))?.status).toBe("doubtful");
    expect(toAvailabilityRecord(row({ type: null }))?.status).toBe("doubtful");
  });

  it("is case-insensitive about the type, and tolerant of feed whitespace", () => {
    expect(toAvailabilityRecord(row({ type: "  missing fixture " }))?.status).toBe("out");
  });

  it("keeps the provider's own wording verbatim", () => {
    expect(toAvailabilityRecord(row({ reason: "Lacking Match Fitness" }))?.reason).toBe(
      "Lacking Match Fitness",
    );
    expect(toAvailabilityRecord(row({ reason: "  Knee   Injury " }))?.reason).toBe(
      "Knee Injury",
    );
    expect(toAvailabilityRecord(row({ reason: null }))?.reason).toBeNull();
    expect(toAvailabilityRecord(row({ reason: "" }))?.reason).toBeNull();
  });

  it("rejects a row it cannot identify rather than guessing", () => {
    expect(toAvailabilityRecord(row({ playerId: null }))).toBeNull();
    expect(toAvailabilityRecord(row({ fixtureId: null }))).toBeNull();
    expect(toAvailabilityRecord({ player: null, team: null, fixture: null, league: null })).toBeNull();
  });

  it("preserves the raw type so a vocabulary change is visible in data", () => {
    expect(toAvailabilityRecord(row({ type: "Probable" }))?.rawType).toBe("Probable");
  });
});

describe("collapseForGameweek", () => {
  const GAMEWEEK = new Set(["1557367", "1557368"]);

  it("keeps only rows bound to this gameweek's fixtures", () => {
    const result = collapseForGameweek(
      [
        row({ playerId: 1, fixtureId: 1557367 }),
        // Last round's fixture — the feed ships it in the same response.
        row({ playerId: 2, fixtureId: 1550001 }),
        // Next round's.
        row({ playerId: 3, fixtureId: 1557999 }),
      ],
      GAMEWEEK,
    );
    expect(result.records.map((r) => r.providerPlayerId)).toEqual(["1"]);
    // inFeed counts the WHOLE response — it is the coverage signal, not the
    // gameweek slice.
    expect(result.inFeed).toBe(3);
  });

  it("keeps the more severe row on a double gameweek", () => {
    const result = collapseForGameweek(
      [
        row({ playerId: 7, fixtureId: 1557367, type: "Questionable", reason: "Knock" }),
        row({ playerId: 7, fixtureId: 1557368, type: "Missing Fixture", reason: "Red Card" }),
      ],
      GAMEWEEK,
    );
    expect(result.records).toHaveLength(1);
    expect(result.records[0].status).toBe("out");
    expect(result.records[0].category).toBe("suspension");
  });

  it("is order-independent, so a re-sweep cannot flip the stored row", () => {
    const rows = [
      row({ playerId: 7, fixtureId: 1557368, type: "Missing Fixture", reason: "Red Card" }),
      row({ playerId: 7, fixtureId: 1557367, type: "Questionable", reason: "Knock" }),
    ];
    const forward = collapseForGameweek(rows, GAMEWEEK);
    const reversed = collapseForGameweek([...rows].reverse(), GAMEWEEK);
    expect(forward.records).toEqual(reversed.records);
  });

  it("counts unusable rows instead of dropping them silently", () => {
    const result = collapseForGameweek(
      [row({ playerId: null }), row({ fixtureId: null }), row({ playerId: 5 })],
      GAMEWEEK,
    );
    expect(result.unusable).toBe(2);
    expect(result.records).toHaveLength(1);
  });

  it("returns an empty set for an empty feed without inventing anything", () => {
    const result = collapseForGameweek([], GAMEWEEK);
    expect(result).toEqual({ records: [], inFeed: 0, unusable: 0 });
  });
});

describe("coverageOf", () => {
  it("separates 'reported nobody' from 'did not report'", () => {
    // League 39 on the measurement day: 76 rows, only some in our window.
    expect(coverageOf(76)).toBe("reported");
    // Leagues 78 and 94 on the same day: nothing at all, for any round.
    expect(coverageOf(0)).toBe("no-report");
  });
});

describe("the action → mutation wire shape", () => {
  /**
   * Regression guard for the way the first prod sweep failed.
   *
   * `refreshAvailability` hands these records to `applyLeagueAvailability`
   * through `ctx.runMutation`, and Convex validates those arguments at RUNTIME:
   * one extra field rejects the whole chunk. TypeScript cannot see the mismatch,
   * so the shapes are asserted equal here instead. The sweep's fail-soft design
   * meant the live failure wrote nothing and cleared nothing — but every league
   * failed, and the report was empty for an hour.
   */
  it("emits exactly the fields the mutation validator declares", () => {
    const record = toAvailabilityRecord(row({}));
    expect(record).not.toBeNull();
    expect(Object.keys(record!).sort()).toEqual(
      Object.keys(availabilityRecordValidator.fields).sort(),
    );
  });
});
