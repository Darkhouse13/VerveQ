/**
 * Weekend Fantasy FW-3 — the draft engine's pure rules.
 *
 * DRAFT_ROOM_SPEC v1.1.0 + FW-3 rulings R1–R7. Everything here runs the real
 * lib/fantasyDraftEngine.ts with no database: snake order across every crew
 * size, chess-clock math, the R1 auto-pick total order and its eligibility
 * ladder, the R6 default sheet (including the no-GK fallback), and draft-log
 * reconstruction/replay determinism.
 */

import { describe, expect, it } from "vitest";

import {
  autoPickComparator,
  bankExhausted,
  clubCapBlocks,
  defaultSheetAssignment,
  elapsedOnTurn,
  hashString,
  reconstructDraft,
  seatIndexForPick,
  selectAutoPick,
  snakeOrderFor,
  totalPicks,
  type AutoPickContext,
  type DefaultSheetSlot,
  type DraftLogEntry,
  type DraftPoolPlayer,
} from "../../convex/lib/fantasyDraftEngine";
import {
  DRAFT_BANK_MS,
  SQUAD_SIZE,
} from "../../convex/lib/fantasyConstants";
import {
  formationOf,
  validateFormation,
  validateSquadShape,
  type SlotSnapshot,
} from "../../convex/lib/fantasySquadRules";

const poolPlayer = (over: Partial<DraftPoolPlayer> & { _id: string }): DraftPoolPlayer => ({
  providerPlayerId: over._id,
  clubId: "club-1",
  price: 5.0,
  active: true,
  pool: "topfive",
  proxy: 5.0,
  hasFixture: true,
  kickoffAt: 10_000_000,
  ...over,
});

// ── snake order (spec §Lifecycle 3: 1→N, N→1, repeat; R4 seeded) ──

describe("snake order", () => {
  it("is a permutation of the seats, deterministic in the seed, for 2–8 drafters", () => {
    for (let n = 2; n <= 8; n += 1) {
      const order = snakeOrderFor(n, `seed-${n}`);
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: n }, (_, i) => i),
      );
      expect(snakeOrderFor(n, `seed-${n}`)).toEqual(order); // same seed, same order
    }

    // Seed-sensitivity, asserted where collisions cannot be legitimate: any
    // single seed pair may collide for small n (n=2 has two permutations —
    // and n=4/n=5 pairs collided in earlier drafts of this test), so instead
    // demand that ten seeds at n=8 (40,320 permutations) produce many
    // distinct orders. A shuffle that ignores its seed produces exactly one.
    const distinct = new Set(
      Array.from({ length: 10 }, (_, i) => snakeOrderFor(8, `spread-${i}`).join(",")),
    );
    expect(distinct.size).toBeGreaterThan(5);
  });

  it("runs 1→N then N→1, for every crew size", () => {
    for (let n = 2; n <= 8; n += 1) {
      const order = snakeOrderFor(n, `snake-${n}`);
      const firstRound = Array.from({ length: n }, (_, i) => seatIndexForPick(order, i));
      const secondRound = Array.from({ length: n }, (_, i) => seatIndexForPick(order, n + i));
      expect(firstRound).toEqual(order);
      expect(secondRound).toEqual([...order].reverse());
      // The seat picking last in round 1 picks first in round 2 ("last picks twice").
      expect(secondRound[0]).toBe(firstRound[n - 1]);
    }
  });

  it("gives every seat exactly 13 picks over the whole draft", () => {
    for (let n = 2; n <= 8; n += 1) {
      const order = snakeOrderFor(n, `full-${n}`);
      const counts = new Map<number, number>();
      for (let p = 0; p < totalPicks(n); p += 1) {
        const seat = seatIndexForPick(order, p);
        counts.set(seat, (counts.get(seat) ?? 0) + 1);
      }
      expect([...counts.values()]).toEqual(Array.from({ length: n }, () => SQUAD_SIZE));
    }
  });
});

// ── chess clock (ledger 6; R2) ──

describe("chess-clock math", () => {
  it("clamps elapsed into [0, bank]", () => {
    expect(elapsedOnTurn(1_000, 900, 30_000)).toBe(0); // scheduler fired early
    expect(elapsedOnTurn(1_000, 11_000, 30_000)).toBe(10_000);
    expect(elapsedOnTurn(1_000, 500_000, 30_000)).toBe(30_000); // never past the bank
  });

  it("declares exhaustion exactly at the bank, not before", () => {
    expect(bankExhausted(0, DRAFT_BANK_MS - 1, DRAFT_BANK_MS)).toBe(false);
    expect(bankExhausted(0, DRAFT_BANK_MS, DRAFT_BANK_MS)).toBe(true);
    expect(bankExhausted(0, 0, 0)).toBe(true); // an empty bank is exhausted now
  });
});

// ── R1 auto-pick order ──

describe("auto-pick total order (R1: price desc → proxy desc → pool → provider id)", () => {
  it("orders by each rung in turn", () => {
    const byPrice = [poolPlayer({ _id: "a", price: 9 }), poolPlayer({ _id: "b", price: 13 })];
    expect(byPrice.sort(autoPickComparator)[0]._id).toBe("b");

    const byProxy = [
      poolPlayer({ _id: "a", proxy: 4.1 }),
      poolPlayer({ _id: "b", proxy: 9.9 }),
    ];
    expect(byProxy.sort(autoPickComparator)[0]._id).toBe("b");

    const byPool = [
      poolPlayer({ _id: "a", pool: "flagged", proxy: null }),
      poolPlayer({ _id: "b", pool: "promoted", proxy: null }),
      poolPlayer({ _id: "c", pool: "topfive", proxy: null }),
    ];
    expect(byPool.sort(autoPickComparator).map((p) => p._id)).toEqual(["c", "b", "a"]);

    // The whole flagged cohort is 4.0 / no proxy — provider id must totalize.
    const flagged = [
      poolPlayer({ _id: "z", providerPlayerId: "900", pool: "flagged", price: 4, proxy: null }),
      poolPlayer({ _id: "y", providerPlayerId: "100", pool: "flagged", price: 4, proxy: null }),
    ];
    expect(flagged.sort(autoPickComparator)[0]._id).toBe("y");
  });

  it("sorts a null proxy below any real proxy, and a missing pool row below flagged", () => {
    const players = [
      poolPlayer({ _id: "noProxy", proxy: null }),
      poolPlayer({ _id: "lowProxy", proxy: 0.01 }),
    ];
    expect(players.sort(autoPickComparator)[0]._id).toBe("lowProxy");

    const pools = [
      poolPlayer({ _id: "noMeta", pool: null, proxy: null }),
      poolPlayer({ _id: "flagged", pool: "flagged", proxy: null }),
    ];
    expect(pools.sort(autoPickComparator)[0]._id).toBe("flagged");
  });
});

describe("auto-pick selection (R1 constraint ladder, R5 fixture skip)", () => {
  const ctx = (over: Partial<AutoPickContext> = {}): AutoPickContext => ({
    pickedPlayerIds: new Set<string>(),
    clubCounts: new Map<string, number>(),
    favoriteClub: null,
    now: 1_000,
    ...over,
  });

  it("takes the best available and skips players already drafted in the room", () => {
    const pool = [
      poolPlayer({ _id: "best", price: 13 }),
      poolPlayer({ _id: "next", price: 12 }),
    ];
    expect(selectAutoPick(pool, ctx())?._id).toBe("best");
    expect(selectAutoPick(pool, ctx({ pickedPlayerIds: new Set(["best"]) }))?._id).toBe("next");
  });

  it("skips no-fixture players (R5) and started fixtures (hindsight rule)", () => {
    const pool = [
      poolPlayer({ _id: "noFixture", price: 13, hasFixture: false, kickoffAt: null }),
      poolPlayer({ _id: "started", price: 12, kickoffAt: 500 }),
      poolPlayer({ _id: "playable", price: 4 }),
    ];
    expect(selectAutoPick(pool, ctx())?._id).toBe("playable");
  });

  it("respects the club cap, exempts the favorite, and relaxes down the ladder", () => {
    const capped = new Map([["club-1", 3]]);
    const pool = [
      poolPlayer({ _id: "cappedClub", price: 13, clubId: "club-1" }),
      poolPlayer({ _id: "otherClub", price: 4, clubId: "club-2" }),
    ];
    expect(selectAutoPick(pool, ctx({ clubCounts: capped }))?._id).toBe("otherClub");
    expect(clubCapBlocks("club-1", capped, null)).toBe(true);
    expect(clubCapBlocks("club-1", capped, "club-1")).toBe(false);
    expect(
      selectAutoPick(pool, ctx({ clubCounts: capped, favoriteClub: "club-1" }))?._id,
    ).toBe("cappedClub");

    // Rung 2: only a no-fixture player remains → still completes the sheet.
    const thin = [poolPlayer({ _id: "benchOnly", hasFixture: false, kickoffAt: null })];
    expect(selectAutoPick(thin, ctx())?._id).toBe("benchOnly");

    // Rung 3: even cap-blocked beats wedging the draft.
    expect(selectAutoPick(pool.slice(0, 1), ctx({ clubCounts: capped }))?._id).toBe("cappedClub");

    expect(selectAutoPick([], ctx())).toBeNull();
  });
});

// ── R6 default sheet ──

describe("default team sheet (R6: 4-4-2 by price, price-based finishers)", () => {
  const player = (
    id: string,
    price: number,
    feedPosition: "GK" | "DEF" | "MID" | "ATT",
  ) => ({ _id: id, providerPlayerId: id, price, feedPosition });

  const naturalSquad = [
    player("gk1", 5.0, "GK"),
    player("gk2", 4.5, "GK"),
    player("d1", 8.0, "DEF"),
    player("d2", 7.5, "DEF"),
    player("d3", 7.0, "DEF"),
    player("d4", 6.5, "DEF"),
    player("m1", 12.0, "MID"),
    player("m2", 11.0, "MID"),
    player("m3", 10.0, "MID"),
    player("m4", 9.0, "MID"),
    player("a1", 13.0, "ATT"),
    player("a2", 12.5, "ATT"),
    player("a3", 4.0, "ATT"),
  ];

  const toSnapshots = (slots: readonly DefaultSheetSlot[]): SlotSnapshot[] =>
    slots.map((s) => ({
      slotIndex: s.slotIndex,
      slotRole: s.slotRole,
      isFinisher: s.isFinisher,
      playerId: s.playerId,
      lockedAt: null,
      committedPrice: null,
    }));

  it("assigns the cheapest nominal GK, the two lowest-priced as finishers, 4-4-2 overall", () => {
    const sheet = defaultSheetAssignment(naturalSquad);
    const byPlayer = new Map(sheet.map((s) => [s.playerId, s]));

    // Cheapest GK (gk2 at 4.5) keeps goal; gk1 does not.
    expect(byPlayer.get("gk2")).toMatchObject({ slotRole: "GK", isFinisher: false, slotIndex: 0 });
    // Two lowest-priced of the rest: a3 (4.0) and gk1 (5.0) are the finishers.
    expect(sheet.filter((s) => s.isFinisher).map((s) => s.playerId).sort()).toEqual(["a3", "gk1"]);
    // The XI is a legal 4-4-2 and the squad shape holds.
    const snapshots = toSnapshots(sheet);
    expect(validateSquadShape(snapshots).ok).toBe(true);
    expect(formationOf(snapshots)).toEqual({ GK: 1, DEF: 4, MID: 4, ATT: 2 });
    // Nominal DEFs fill the DEF line (there are exactly 4).
    for (const id of ["d1", "d2", "d3", "d4"]) {
      expect(byPlayer.get(id)?.slotRole).toBe("DEF");
    }
  });

  it("documents the no-GK fallback: cheapest player overall keeps goal", () => {
    const allOut = naturalSquad.map((p) =>
      p.feedPosition === "GK" ? { ...p, feedPosition: "ATT" as const } : p,
    );
    const sheet = defaultSheetAssignment(allOut);
    // Cheapest overall is a3 at 4.0 → the documented fallback keeper.
    expect(sheet.find((s) => s.slotRole === "GK" && !s.isFinisher)?.playerId).toBe("a3");
    expect(validateFormation(formationOf(toSnapshots(sheet))).ok).toBe(true);
  });

  it("produces a legal 4-4-2 from 13 players of one nominal position", () => {
    const allAtt = Array.from({ length: SQUAD_SIZE }, (_, i) =>
      player(`p${i}`, 4.0 + (i % 5) * 0.5, "ATT"),
    );
    const sheet = defaultSheetAssignment(allAtt);
    const snapshots = toSnapshots(sheet);
    expect(validateSquadShape(snapshots).ok).toBe(true);
    expect(formationOf(snapshots)).toEqual({ GK: 1, DEF: 4, MID: 4, ATT: 2 });
  });

  it("is a pure function of the 13 — identical input, identical sheet", () => {
    const a = defaultSheetAssignment(naturalSquad);
    const b = defaultSheetAssignment([...naturalSquad].reverse());
    expect(a).toEqual(b.sort((x, y) => x.slotIndex - y.slotIndex));
  });

  it("refuses anything but exactly 13 players", () => {
    expect(() => defaultSheetAssignment(naturalSquad.slice(0, 12))).toThrow(/13/);
  });
});

// ── draft-log reconstruction ──

describe("draft-log reconstruction (§Draft log; determinism gate)", () => {
  function scriptedLog(seed: string, drafters: number): DraftLogEntry[] {
    const snakeOrder = snakeOrderFor(drafters, seed);
    const entries: DraftLogEntry[] = [
      { seq: 0, entryType: "seed", seed, snakeOrder },
    ];
    const banks = Array.from({ length: drafters }, () => DRAFT_BANK_MS);
    for (let p = 0; p < totalPicks(drafters); p += 1) {
      const seatIndex = seatIndexForPick(snakeOrder, p);
      const elapsedMs = 1_000;
      banks[seatIndex] -= elapsedMs;
      entries.push({
        seq: p + 1,
        entryType: "pick",
        pickNumber: p + 1,
        round: Math.floor(p / drafters) + 1,
        seatIndex,
        playerId: `player-${p}`,
        auto: p % 7 === 0,
        elapsedMs,
        bankAfterMs: banks[seatIndex],
      });
    }
    return entries;
  }

  it("accepts a well-formed full draft and rebuilds per-seat picks and banks", () => {
    const log = scriptedLog("replay-seed", 4);
    const result = reconstructDraft(log, DRAFT_BANK_MS);
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.seed).toBe("replay-seed");
    expect([...result.picksBySeat.values()].map((l) => l.length)).toEqual([13, 13, 13, 13]);
    for (const bank of result.bankBySeat.values()) {
      expect(bank).toBe(DRAFT_BANK_MS - 13_000);
    }
  });

  it("replay determinism: the same seed scripts the identical log", () => {
    expect(scriptedLog("same-seed", 4)).toEqual(scriptedLog("same-seed", 4));
    expect(hashString(JSON.stringify(scriptedLog("same-seed", 4)))).toBe(
      hashString(JSON.stringify(scriptedLog("same-seed", 4))),
    );
  });

  it("rejects a snake order the seed does not generate", () => {
    const log = scriptedLog("seed-a", 3);
    const forged = [{ ...log[0], snakeOrder: [0, 1, 2] }, ...log.slice(1)];
    // Only forge when the real shuffle differs; [0,1,2] may legitimately occur.
    if (JSON.stringify(snakeOrderFor(3, "seed-a")) !== JSON.stringify([0, 1, 2])) {
      const result = reconstructDraft(forged, DRAFT_BANK_MS);
      expect(result.ok).toBe(false);
      expect(result.problems.join(" ")).toMatch(/snake/i);
    }
  });

  it("rejects duplicate players, wrong seats, and bank drift", () => {
    const log = scriptedLog("seed-b", 2);
    const dup = log.map((e, i) => (i === 3 ? { ...e, playerId: log[2].playerId } : e));
    expect(reconstructDraft(dup, DRAFT_BANK_MS).problems.join(" ")).toMatch(/twice/);

    const wrongSeat = log.map((e, i) =>
      i === 2 ? { ...e, seatIndex: (e.seatIndex! + 1) % 2 } : e,
    );
    expect(reconstructDraft(wrongSeat, DRAFT_BANK_MS).problems.join(" ")).toMatch(/snake demands/);

    const drift = log.map((e, i) => (i === 4 ? { ...e, bankAfterMs: 1 } : e));
    expect(reconstructDraft(drift, DRAFT_BANK_MS).problems.join(" ")).toMatch(/bankAfterMs/);
  });
});
