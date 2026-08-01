/**
 * Weekend Fantasy FW-LAUNCH O4 — tie-break ladders (DRAFT_ROOM ledger 5), as
 * pure unit tests. Each rung decides alone; the exhausted ladder stays a tie.
 */

import { describe, expect, it } from "vitest";

import {
  compareWeekendResult,
  orderTiedGroup,
  type WeekendComparable,
} from "../../convex/lib/fantasyTieBreaks";

function weekend(over: Partial<WeekendComparable> = {}): WeekendComparable {
  return { points: 50, topPlayerScore: 12, autoPicks: 0, ...over };
}

describe("weekend ladder (points → top single player → fewest auto-picks → shared)", () => {
  it("rung 1: points decide", () => {
    expect(compareWeekendResult(weekend({ points: 51 }), weekend({ points: 50 }))).toBeGreaterThan(0);
    expect(compareWeekendResult(weekend({ points: 49 }), weekend({ points: 50 }))).toBeLessThan(0);
  });

  it("rung 2: equal points, the higher single-player score decides", () => {
    expect(
      compareWeekendResult(weekend({ topPlayerScore: 15 }), weekend({ topPlayerScore: 12 })),
    ).toBeGreaterThan(0);
  });

  it("rung 3: equal points and top score, FEWER auto-picks decides", () => {
    expect(
      compareWeekendResult(weekend({ autoPicks: 1 }), weekend({ autoPicks: 4 })),
    ).toBeGreaterThan(0);
  });

  it("rung 4: exhausted ladder is shared", () => {
    expect(compareWeekendResult(weekend(), weekend())).toBe(0);
  });

  it("abstains rather than guesses when data is missing", () => {
    // Null points on either side: the weekend decides nothing.
    expect(compareWeekendResult(weekend({ points: null }), weekend())).toBe(0);
    // Null on a lower rung falls through to the next one.
    expect(
      compareWeekendResult(
        weekend({ topPlayerScore: null, autoPicks: 1 }),
        weekend({ topPlayerScore: 15, autoPicks: 3 }),
      ),
    ).toBeGreaterThan(0);
  });
});

describe("crew-table ladder (equal cumulative → head-to-head weekend wins)", () => {
  it("breaks a cumulative tie by head-to-head wins", () => {
    // Equal season sums (25 each), but A took two of the three weekends.
    const result = orderTiedGroup([
      {
        key: "A",
        weekends: new Map([
          ["r1", weekend({ points: 10 })],
          ["r2", weekend({ points: 10 })],
          ["r3", weekend({ points: 5 })],
        ]),
      },
      {
        key: "B",
        weekends: new Map([
          ["r1", weekend({ points: 9 })],
          ["r2", weekend({ points: 9 })],
          ["r3", weekend({ points: 7 })],
        ]),
      },
    ]);
    expect(result.map((r) => r.key)).toEqual(["A", "B"]);
    expect(result[0]).toMatchObject({ h2hWins: 2, subRank: 0, stillTied: false });
    expect(result[1]).toMatchObject({ h2hWins: 1, subRank: 1, stillTied: false });
  });

  it("uses the weekend ladder's lower rungs inside a head-to-head weekend", () => {
    // Same points every weekend; A's top player outscored B's in r1.
    const result = orderTiedGroup([
      { key: "A", weekends: new Map([["r1", weekend({ topPlayerScore: 15 })]]) },
      { key: "B", weekends: new Map([["r1", weekend({ topPlayerScore: 12 })]]) },
    ]);
    expect(result[0].key).toBe("A");
    expect(result[0].stillTied).toBe(false);
  });

  it("stays a displayed tie when the ladder exhausts", () => {
    const result = orderTiedGroup([
      { key: "A", weekends: new Map([["r1", weekend()]]) },
      { key: "B", weekends: new Map([["r1", weekend()]]) },
    ]);
    expect(result.every((r) => r.stillTied)).toBe(true);
    expect(result.every((r) => r.subRank === 0)).toBe(true);
  });

  it("stays a displayed tie when every deciding input is null (all-null cluster)", () => {
    // Ladder exhausted with no facts at all: every rung abstains, nothing
    // separates the members, and the shared rank must still read as tied.
    const nothing = weekend({ points: null, topPlayerScore: null, autoPicks: null });
    const result = orderTiedGroup([
      { key: "A", weekends: new Map([["r1", nothing]]) },
      { key: "B", weekends: new Map([["r1", nothing]]) },
    ]);
    expect(result.every((r) => r.h2hWins === 0)).toBe(true);
    expect(result.every((r) => r.subRank === 0)).toBe(true);
    expect(result.every((r) => r.stillTied)).toBe(true);
  });

  it("only compares weekends both members contested", () => {
    const result = orderTiedGroup([
      {
        key: "A",
        weekends: new Map([
          ["r1", weekend({ points: 100 })], // B absent — decides nothing
          ["r2", weekend({ points: 10 })],
        ]),
      },
      { key: "B", weekends: new Map([["r2", weekend({ points: 12 })]]) },
    ]);
    expect(result[0].key).toBe("B");
    expect(result[0].h2hWins).toBe(1);
    expect(result[1].h2hWins).toBe(0);
  });

  it("extends to a three-way tie by total wins within the group", () => {
    // A beats B, B beats C, A beats C: A 2, B 1, C 0.
    const result = orderTiedGroup([
      {
        key: "A",
        weekends: new Map([
          ["r1", weekend({ points: 10 })],
          ["r2", weekend({ points: 10 })],
        ]),
      },
      {
        key: "B",
        weekends: new Map([
          ["r1", weekend({ points: 9 })],
          ["r3", weekend({ points: 10 })],
        ]),
      },
      {
        key: "C",
        weekends: new Map([
          ["r2", weekend({ points: 9 })],
          ["r3", weekend({ points: 9 })],
        ]),
      },
    ]);
    expect(result.map((r) => r.key)).toEqual(["A", "B", "C"]);
    expect(result.map((r) => r.h2hWins)).toEqual([2, 1, 0]);
    expect(result.every((r) => !r.stillTied)).toBe(true);
  });
});
