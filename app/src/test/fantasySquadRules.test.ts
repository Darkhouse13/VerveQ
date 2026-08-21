/**
 * Weekend Fantasy FW-1 — the rule layer, as pure unit tests.
 *
 * Covers the formation structural rule, the finisher-count invariant, the
 * per-club cap with and without the favorite-club exemption, the budget
 * invariant's committed/live split, and the 4-gameweek favorite cooldown.
 *
 * Everything here is a function call — no database, no clock. The handler-level
 * behaviour (locks, mutation rejection) is fantasyLockEngine.test.ts.
 */

import { describe, expect, it } from "vitest";

import {
  FAVORITE_CLUB_COOLDOWN_DAYS,
  FAVORITE_CLUB_COOLDOWN_MS,
  FAVORITE_CLUB_CAP,
  PER_CLUB_CAP,
  SQUAD_BUDGET,
  SQUAD_SIZE,
  zonedWallClockToEpochMs,
  type SlotRole,
} from "../../convex/lib/fantasyConstants";
import {
  formationOf,
  validateBudget,
  validateClubCap,
  validateFormation,
  validateSquad,
  totalCostOf,
  validateSquadShape,
  type PlayerSnapshot,
  type SlotSnapshot,
} from "../../convex/lib/fantasySquadRules";
import {
  planFavoriteClubChange,
  resolveFavoriteClub,
} from "../../convex/lib/fantasyFavoriteClub";

// ── builders ──

let nextId = 0;

function slot(over: Partial<SlotSnapshot> = {}): SlotSnapshot {
  return {
    slotIndex: over.slotIndex ?? nextId++,
    slotRole: over.slotRole ?? "MID",
    isFinisher: over.isFinisher ?? false,
    playerId: over.playerId ?? null,
    lockedAt: over.lockedAt ?? null,
    committedPrice: over.committedPrice ?? null,
  };
}

/** 13 slots in the given XI shape plus two finishers, all empty. */
function squadOf(
  formation: Record<SlotRole, number>,
  finisherRoles: readonly SlotRole[] = ["ATT", "ATT"],
): SlotSnapshot[] {
  const slots: SlotSnapshot[] = [];
  let index = 0;
  for (const role of ["GK", "DEF", "MID", "ATT"] as const) {
    for (let i = 0; i < formation[role]; i += 1) {
      slots.push(slot({ slotIndex: index++, slotRole: role, isFinisher: false }));
    }
  }
  for (const role of finisherRoles) {
    slots.push(slot({ slotIndex: index++, slotRole: role, isFinisher: true }));
  }
  return slots;
}

function player(over: Partial<PlayerSnapshot> & { _id: string }): PlayerSnapshot {
  return {
    clubId: "CLUB_A",
    price: 5.0,
    active: true,
    name: over._id,
    ...over,
  };
}

function poolOf(...players: PlayerSnapshot[]): Map<string, PlayerSnapshot> {
  return new Map(players.map((p) => [p._id, p]));
}

const FOUR_FOUR_TWO = { GK: 1, DEF: 4, MID: 4, ATT: 2 } as Record<SlotRole, number>;
const NEVER_LOCKED = () => false;

// ── formation ──

describe("formation structural rule (BUDGET_MODE v1.0, FW-1 STOP-2)", () => {
  it.each([
    ["4-4-2", { GK: 1, DEF: 4, MID: 4, ATT: 2 }],
    ["4-3-3", { GK: 1, DEF: 4, MID: 3, ATT: 3 }],
    ["3-5-2", { GK: 1, DEF: 3, MID: 5, ATT: 2 }],
    ["5-3-2", { GK: 1, DEF: 5, MID: 3, ATT: 2 }],
    ["4-5-1", { GK: 1, DEF: 4, MID: 5, ATT: 1 }],
    ["3-4-3", { GK: 1, DEF: 3, MID: 4, ATT: 3 }],
    ["5-4-1", { GK: 1, DEF: 5, MID: 4, ATT: 1 }],
  ])("admits %s", (_name, formation) => {
    expect(validateFormation(formation as Record<SlotRole, number>).ok).toBe(true);
  });

  it.each([
    ["no keeper", { GK: 0, DEF: 5, MID: 4, ATT: 2 }, "formation_gk"],
    ["two keepers", { GK: 2, DEF: 4, MID: 3, ATT: 2 }, "formation_gk"],
    ["only 2 DEF", { GK: 1, DEF: 2, MID: 5, ATT: 3 }, "formation_def"],
    ["6 DEF", { GK: 1, DEF: 6, MID: 3, ATT: 1 }, "formation_def"],
    ["only 1 MID", { GK: 1, DEF: 5, MID: 1, ATT: 4 }, "formation_mid"],
    ["no striker", { GK: 1, DEF: 5, MID: 5, ATT: 0 }, "formation_att"],
    ["4 ATT", { GK: 1, DEF: 3, MID: 3, ATT: 4 }, "formation_att"],
  ])("rejects %s", (_name, formation, code) => {
    const result = validateFormation(formation as Record<SlotRole, number>);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain(code);
  });

  it("rejects a shape that satisfies every line bound but not the total of 11", () => {
    // Each line is individually in range; they sum to 12. Without the explicit
    // total check this would pass — which is the whole point of having one.
    const result = validateFormation({ GK: 1, DEF: 5, MID: 5, ATT: 1 } as Record<SlotRole, number>);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("formation_total");
  });

  it("counts the XI only — finisher roles never enter the formation", () => {
    // Two GK finishers on top of a legal 4-4-2 must not read as three keepers.
    const slots = squadOf(FOUR_FOUR_TWO, ["GK", "GK"]);
    expect(formationOf(slots)).toEqual({ GK: 1, DEF: 4, MID: 4, ATT: 2 });
    expect(validateFormation(formationOf(slots)).ok).toBe(true);
  });
});

// ── squad shape / finishers ──

describe("squad shape invariant", () => {
  it("accepts 13 slots with exactly 2 finishers", () => {
    expect(validateSquadShape(squadOf(FOUR_FOUR_TWO)).ok).toBe(true);
  });

  it("rejects a third finisher", () => {
    const slots = squadOf(FOUR_FOUR_TWO);
    const withThree = slots.map((s, i) => (i === 0 ? { ...s, isFinisher: true } : s));
    const result = validateSquadShape(withThree);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("finisher_count");
  });

  it("rejects only one finisher", () => {
    const slots = squadOf(FOUR_FOUR_TWO);
    const withOne = slots.map((s) => (s.slotIndex === 12 ? { ...s, isFinisher: false } : s));
    const result = validateSquadShape(withOne);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("finisher_count");
  });

  it(`rejects a squad that is not ${SQUAD_SIZE} slots`, () => {
    const result = validateSquadShape(squadOf(FOUR_FOUR_TWO).slice(0, 12));
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("squad_size");
  });

  it("rejects the same player in two slots", () => {
    const slots = squadOf(FOUR_FOUR_TWO);
    const dup = slots.map((s, i) => (i < 2 ? { ...s, playerId: "p1" } : s));
    const result = validateSquadShape(dup);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("duplicate_player");
  });
});

// ── club cap ──

describe("per-club cap with favorite-club exemption (DRAFT_ROOM v1.0 ledger 6+8)", () => {
  const fourFromOneClub = () => {
    const slots = squadOf(FOUR_FOUR_TWO);
    return slots.map((s, i) => (i < 4 ? { ...s, playerId: `big${i}` } : s));
  };
  const pool = poolOf(
    ...[0, 1, 2, 3].map((i) => player({ _id: `big${i}`, clubId: "BIG_CLUB" })),
  );

  it(`allows exactly ${PER_CLUB_CAP} from a non-favorite club`, () => {
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) =>
      i < PER_CLUB_CAP ? { ...s, playerId: `big${i}` } : s,
    );
    expect(validateClubCap(slots, pool, null).ok).toBe(true);
  });

  it(`rejects ${PER_CLUB_CAP + 1} from a non-favorite club`, () => {
    const result = validateClubCap(fourFromOneClub(), pool, null);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("club_cap");
  });

  it("rejects it when the favorite is a DIFFERENT club", () => {
    const result = validateClubCap(fourFromOneClub(), pool, "SOME_OTHER_CLUB");
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("club_cap");
  });

  it("allows it when that club IS the favorite — a fan may field his whole back line", () => {
    expect(validateClubCap(fourFromOneClub(), pool, "BIG_CLUB").ok).toBe(true);
  });

  it(`caps the favorite at ${FAVORITE_CLUB_CAP}, not unlimited (owner ruling 2026-08-21)`, () => {
    expect(FAVORITE_CLUB_CAP).toBe(PER_CLUB_CAP + 1);
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) =>
      i < FAVORITE_CLUB_CAP + 1 ? { ...s, playerId: `all${i}` } : s,
    );
    const allPool = poolOf(
      ...Array.from({ length: SQUAD_SIZE }, (_, i) => player({ _id: `all${i}`, clubId: "BIG_CLUB" })),
    );
    const result = validateClubCap(slots, allPool, "BIG_CLUB");
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("club_cap");
    expect(result.violations[0]?.message).toMatch(/from your favorite club/);
  });

  it("caps each non-favorite club independently", () => {
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) =>
      i < 4 ? { ...s, playerId: `a${i}` } : i < 8 ? { ...s, playerId: `b${i}` } : s,
    );
    const mixed = poolOf(
      ...[0, 1, 2, 3].map((i) => player({ _id: `a${i}`, clubId: "CLUB_A" })),
      ...[4, 5, 6, 7].map((i) => player({ _id: `b${i}`, clubId: "CLUB_B" })),
    );
    // Favoring CLUB_A leaves CLUB_B's four still over the cap.
    const result = validateClubCap(slots, mixed, "CLUB_A");
    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toContain("CLUB_B");
  });
});

// ── club-cap grandfathering (FW-T1 ruling R2) ──
//
// Transfer ingestion moves players between clubs under standing squads, so a
// squad built legally can hold 4-from-one-club without any edit. The ruling:
// the squad is NOT invalidated — the cap binds at mutation time only, against
// the pre-edit baseline.

describe("club-cap grandfathering after a transfer (FW-T1 R2)", () => {
  // A squad that WAS legal: big0..big2 from BIG_CLUB plus other3 elsewhere —
  // then a transfer moved other3 to BIG_CLUB. Pre-edit state = 4 from BIG_CLUB.
  const grandfatheredSlots = () =>
    squadOf(FOUR_FOUR_TWO).map((s, i) =>
      i < 3 ? { ...s, playerId: `big${i}` } : i === 3 ? { ...s, playerId: "moved" } : s,
    );
  const postTransferPool = poolOf(
    ...[0, 1, 2].map((i) => player({ _id: `big${i}`, clubId: "BIG_CLUB" })),
    player({ _id: "moved", clubId: "BIG_CLUB" }), // transferred in under the squad
    player({ _id: "elsewhere", clubId: "CLUB_C" }),
    player({ _id: "fourth", clubId: "BIG_CLUB" }),
  );

  it("keeps the transferred-over squad legal for an edit that does not touch the over-cap club", () => {
    const prior = grandfatheredSlots();
    // Edit: fill slot 5 with a CLUB_C player. BIG_CLUB stays at its inherited 4.
    const postEdit = prior.map((s, i) => (i === 5 ? { ...s, playerId: "elsewhere" } : s));
    const result = validateSquad({
      slots: postEdit,
      playersById: postTransferPool,
      favoriteClub: null,
      context: "crew",
      isLocked: NEVER_LOCKED,
      priorSlots: prior,
    });
    expect(result.ok).toBe(true);
  });

  it("still blocks an edit ADDING another player of the over-cap club", () => {
    const prior = grandfatheredSlots();
    const postEdit = prior.map((s, i) => (i === 5 ? { ...s, playerId: "fourth" } : s));
    const result = validateSquad({
      slots: postEdit,
      playersById: postTransferPool,
      favoriteClub: null,
      context: "crew",
      isLocked: NEVER_LOCKED,
      priorSlots: prior,
    });
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("club_cap");
  });

  it("still blocks a NEW 4th-club addition on a club that was never over cap", () => {
    // 3 from CLUB_D already; the baseline for CLUB_D is 3, so a 4th is a plain
    // cap violation — grandfathering tolerates only what a transfer created.
    const prior = squadOf(FOUR_FOUR_TWO).map((s, i) =>
      i < 3 ? { ...s, playerId: `d${i}` } : s,
    );
    const dPool = poolOf(
      ...[0, 1, 2, 3].map((i) => player({ _id: `d${i}`, clubId: "CLUB_D" })),
    );
    const postEdit = prior.map((s, i) => (i === 5 ? { ...s, playerId: "d3" } : s));
    const result = validateClubCap(
      postEdit,
      dPool,
      null,
      new Map([["CLUB_D", 3]]),
    );
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("club_cap");
  });

  it("allows reducing the over-cap club while staying above the cap (5 → 4)", () => {
    const result = validateClubCap(
      grandfatheredSlots(),
      postTransferPool,
      null,
      new Map([["BIG_CLUB", 5]]),
    );
    expect(result.ok).toBe(true);
  });

  it("binds the strict cap when no baseline is given (createSquad path)", () => {
    const result = validateClubCap(grandfatheredSlots(), postTransferPool, null);
    expect(result.ok).toBe(false);
  });
});

// ── budget ──

describe("budget invariant (BUDGET_MODE v1.1.0 §Budget, §Deadlines & editing)", () => {
  it("carries the budget the spec locked, on the price scale's grid", () => {
    expect(SQUAD_BUDGET).toBe(91.0);
    // The budget is spent in 0.5 steps, so a budget off that grid would leave a
    // permanently unspendable remainder.
    expect(SQUAD_BUDGET * 2).toBe(Math.round(SQUAD_BUDGET * 2));
  });

  it("accepts a 13 costing exactly 91.0 at the real limit (O1e boundary)", () => {
    // 13 × 7.0 = 91.0 — the whole budget spent to the last half-step.
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) => ({ ...s, playerId: `p${i}` }));
    const pool = poolOf(
      ...Array.from({ length: SQUAD_SIZE }, (_, i) => player({ _id: `p${i}`, price: 7.0 })),
    );
    const result = validateBudget(slots, pool, NEVER_LOCKED);
    expect(result.ok).toBe(true);
    expect(result.breakdown?.total).toBe(91.0);
    expect(result.breakdown?.limit).toBe(SQUAD_BUDGET);
  });

  it("rejects a 13 costing 91.5 at the real limit (O1e boundary)", () => {
    // One half-step over: twelve at 7.0 plus one at 7.5.
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) => ({ ...s, playerId: `p${i}` }));
    const pool = poolOf(
      ...Array.from({ length: SQUAD_SIZE }, (_, i) =>
        player({ _id: `p${i}`, price: i === 0 ? 7.5 : 7.0 }),
      ),
    );
    const result = validateBudget(slots, pool, NEVER_LOCKED);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("budget_exceeded");
    expect(result.breakdown?.total).toBe(91.5);
  });

  it("sums filled slots and ignores unfilled ones", () => {
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) =>
      i < 3 ? { ...s, playerId: `p${i}` } : s,
    );
    const pool = poolOf(...[0, 1, 2].map((i) => player({ _id: `p${i}`, price: 10 })));
    const result = validateBudget(slots, pool, NEVER_LOCKED, 100);
    expect(result.ok).toBe(true);
    expect(result.breakdown).toMatchObject({ committed: 0, live: 30, total: 30 });
  });

  it("rejects a squad over the limit", () => {
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) => ({ ...s, playerId: `p${i}` }));
    const pool = poolOf(
      ...Array.from({ length: SQUAD_SIZE }, (_, i) => player({ _id: `p${i}`, price: 10 })),
    );
    const result = validateBudget(slots, pool, NEVER_LOCKED, 100);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("budget_exceeded");
    expect(result.breakdown?.total).toBe(130);
  });

  it("splits committed (locked) from live (unlocked) cost", () => {
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) =>
      i < 4 ? { ...s, playerId: `p${i}`, committedPrice: 12 } : { ...s, playerId: `p${i}` },
    );
    const pool = poolOf(
      ...Array.from({ length: SQUAD_SIZE }, (_, i) => player({ _id: `p${i}`, price: 5 })),
    );
    const lockedFirstFour = (s: SlotSnapshot) => s.slotIndex < 4;
    const result = validateBudget(slots, pool, lockedFirstFour, 200);
    // Locked slots price at their COMMITTED 12, not the current 5.
    expect(result.breakdown).toMatchObject({ committed: 48, live: 45, total: 93 });
  });

  it("falls back to the current price for a locked-but-unswept slot", () => {
    // Prices are static within a gameweek, so the sweep would stamp exactly
    // this. Without the fallback a locked slot would price at zero.
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) =>
      i === 0 ? { ...s, playerId: "p0", committedPrice: null } : s,
    );
    const pool = poolOf(player({ _id: "p0", price: 7 }));
    const result = validateBudget(slots, pool, (s) => s.slotIndex === 0, 100);
    expect(result.breakdown).toMatchObject({ committed: 7, live: 0, total: 7 });
  });

  it("fails closed on an unpriced player (FW-1 STOP-4)", () => {
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) =>
      i === 0 ? { ...s, playerId: "np" } : s,
    );
    const pool = poolOf(player({ _id: "np", price: null }));
    const result = validateBudget(slots, pool, NEVER_LOCKED, 100);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("unpriced_player");
  });

  // ── FW-REPRICE R1: repricing grandfathers a standing squad ──
  //
  // The club-cap grandfather's twin. A squad built legally can be pushed over
  // 91.0 by a reprice with no edit having happened; the ruling keeps it legal
  // on a pre-edit basis, and still blocks any edit that adds cost.

  /** 13 players at 7.5 = 97.5 — a squad a reprice pushed 6.5 over budget. */
  const overBudgetSlots = () =>
    squadOf(FOUR_FOUR_TWO).map((s, i) => ({ ...s, playerId: `p${i}` }));
  const overBudgetPool = poolOf(
    ...Array.from({ length: SQUAD_SIZE }, (_, i) => player({ _id: `p${i}`, price: 7.5 })),
    player({ _id: "cheap", price: 5.0 }),
    player({ _id: "dear", price: 9.0 }),
  );

  it("computes the pre-edit basis the grandfather is measured against", () => {
    expect(totalCostOf(overBudgetSlots(), overBudgetPool, NEVER_LOCKED)).toBe(97.5);
  });

  it("keeps a squad the reprice pushed over 91.0 legal, untouched", () => {
    const result = validateBudget(
      overBudgetSlots(),
      overBudgetPool,
      NEVER_LOCKED,
      SQUAD_BUDGET,
      97.5,
    );
    expect(result.ok).toBe(true);
    expect(result.breakdown).toMatchObject({ total: 97.5, limit: 91.0, allowance: 97.5 });
  });

  it("allows an edit that reduces an over-budget squad but stays above 91.0", () => {
    // swap one 7.5 for a 5.0: 97.5 -> 95.0, still over the budget, still legal
    const slots = overBudgetSlots().map((s, i) => (i === 0 ? { ...s, playerId: "cheap" } : s));
    const result = validateBudget(slots, overBudgetPool, NEVER_LOCKED, SQUAD_BUDGET, 97.5);
    expect(result.ok).toBe(true);
    expect(result.breakdown?.total).toBe(95.0);
  });

  it("BLOCKS an edit that makes an over-budget squad cost more", () => {
    // swap one 7.5 for a 9.0: 97.5 -> 99.0. Above the pre-edit basis, so no.
    const slots = overBudgetSlots().map((s, i) => (i === 0 ? { ...s, playerId: "dear" } : s));
    const result = validateBudget(slots, overBudgetPool, NEVER_LOCKED, SQUAD_BUDGET, 97.5);
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("budget_exceeded");
  });

  it("binds the strict 91.0 limit when no baseline is given (createSquad path)", () => {
    const result = validateBudget(overBudgetSlots(), overBudgetPool, NEVER_LOCKED, SQUAD_BUDGET);
    expect(result.ok).toBe(false);
    expect(result.breakdown?.allowance).toBe(SQUAD_BUDGET);
  });

  it("never lowers the allowance below the budget for an under-budget squad", () => {
    // A cheap squad's pre-edit basis must not become its new ceiling: it can
    // still spend up to the full 91.0.
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) => ({ ...s, playerId: `q${i}` }));
    const pool = poolOf(
      ...Array.from({ length: SQUAD_SIZE }, (_, i) => player({ _id: `q${i}`, price: 5.0 })),
    );
    const result = validateBudget(slots, pool, NEVER_LOCKED, SQUAD_BUDGET, 40.0);
    expect(result.ok).toBe(true);
    expect(result.breakdown?.allowance).toBe(SQUAD_BUDGET);
  });

  it("threads the grandfather through validateSquad via priorSlots", () => {
    const prior = overBudgetSlots();
    // identical post-edit squad: legal, because the basis says it already was
    expect(
      validateSquad({
        slots: prior,
        playersById: overBudgetPool,
        favoriteClub: null,
        context: "budget",
        isLocked: NEVER_LOCKED,
        priorSlots: prior,
      }).ok,
    ).toBe(true);
    // the same squad with no baseline is over budget and rejected
    expect(
      validateSquad({
        slots: prior,
        playersById: overBudgetPool,
        favoriteClub: null,
        context: "budget",
        isLocked: NEVER_LOCKED,
      }).ok,
    ).toBe(false);
  });

  it("runs no budget check at all in crew context — unpriced players are legal there", () => {
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) => ({ ...s, playerId: `p${i}` }));
    const pool = poolOf(
      ...Array.from({ length: SQUAD_SIZE }, (_, i) =>
        player({ _id: `p${i}`, price: null, clubId: `C${i}` }),
      ),
    );
    expect(
      validateSquad({
        slots,
        playersById: pool,
        favoriteClub: null,
        context: "crew",
        isLocked: NEVER_LOCKED,
      }).ok,
    ).toBe(true);

    // The identical squad in budget context is rejected for being unpriced.
    expect(
      validateSquad({
        slots,
        playersById: pool,
        favoriteClub: null,
        context: "budget",
        isLocked: NEVER_LOCKED,
      }).ok,
    ).toBe(false);
  });
});

// ── favorite club cooldown ──

describe("favorite-club 28-day cooldown (DRAFT_ROOM v1.0.2 ledger 7 / STOP-F)", () => {
  // A fixed instant, so nothing here reads the wall clock. Sat 2026-08-15 12:00Z.
  const T0 = Date.UTC(2026, 7, 15, 12, 0);
  const DAY = 86_400_000;

  it("holds the cooldown as 28 calendar days", () => {
    expect(FAVORITE_CLUB_COOLDOWN_DAYS).toBe(28);
    expect(FAVORITE_CLUB_COOLDOWN_MS).toBe(28 * DAY);
  });

  it("applies the first-ever favorite immediately (FW-1 ruling S2)", () => {
    const patch = planFavoriteClubChange({}, T0, "ARSENAL");
    expect(patch.favoriteClub).toBe("ARSENAL");
    expect(patch.favoriteClubPending).toBeUndefined();
    expect(resolveFavoriteClub(patch, T0)).toBe("ARSENAL");
  });

  it("a change made at T does not apply until T + 28 days", () => {
    const before = { favoriteClub: "ARSENAL" };
    const patch = planFavoriteClubChange(before, T0, "SPURS");

    expect(patch.favoriteClubEffectiveFrom).toBe(T0 + FAVORITE_CLUB_COOLDOWN_MS);
    expect(patch.favoriteClubEffectiveFrom).toBe(T0 + 28 * DAY);

    // Inert for the whole 28 days — the old club is still in force (S1).
    for (const days of [0, 1, 13, 27]) {
      expect(resolveFavoriteClub(patch, T0 + days * DAY)).toBe("ARSENAL");
    }
    // Live from day 28 onward.
    for (const days of [28, 29, 400]) {
      expect(resolveFavoriteClub(patch, T0 + days * DAY)).toBe("SPURS");
    }
  });

  it("is inert one millisecond before the cut and live exactly on it", () => {
    // The boundary the old gameweek-integer version could not express at all.
    const patch = planFavoriteClubChange({ favoriteClub: "ARSENAL" }, T0, "SPURS");
    const cut = patch.favoriteClubEffectiveFrom as number;
    expect(resolveFavoriteClub(patch, cut - 1)).toBe("ARSENAL");
    expect(resolveFavoriteClub(patch, cut)).toBe("SPURS");
  });

  it("does not shorten across a congested fixture list", () => {
    // The whole reason for STOP-F. Under the old rule four gameweeks could
    // elapse in ~2 calendar weeks when midweek rounds intervene; under this one
    // the elapsed TIME is the only thing that counts, so a busy fortnight
    // changes nothing.
    const patch = planFavoriteClubChange({ favoriteClub: "ARSENAL" }, T0, "SPURS");
    const fourteenDaysAndSixGameweeksLater = T0 + 14 * DAY;
    expect(resolveFavoriteClub(patch, fourteenDaysAndSixGameweeksLater)).toBe("ARSENAL");
  });

  it("the exemption follows the club in force, not the queued one", () => {
    const patch = planFavoriteClubChange({ favoriteClub: "ARSENAL" }, T0, "SPURS");
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) =>
      i < 4 ? { ...s, playerId: `s${i}` } : s,
    );
    const pool = poolOf(...[0, 1, 2, 3].map((i) => player({ _id: `s${i}`, clubId: "SPURS" })));

    // Four Spurs players a week in: the change has not landed, so no exemption.
    expect(validateClubCap(slots, pool, resolveFavoriteClub(patch, T0 + 7 * DAY)).ok).toBe(false);
    // The same squad after the cooldown: Spurs is the favorite, so it is legal.
    expect(validateClubCap(slots, pool, resolveFavoriteClub(patch, T0 + 28 * DAY)).ok).toBe(true);
  });

  it("reverting to the club already in force cancels the queued change", () => {
    const queued = planFavoriteClubChange({ favoriteClub: "ARSENAL" }, T0, "SPURS");
    const reverted = planFavoriteClubChange(queued, T0 + DAY, "ARSENAL");
    expect(reverted.favoriteClub).toBe("ARSENAL");
    expect(reverted.favoriteClubPending).toBeUndefined();
    expect(resolveFavoriteClub(reverted, T0 + 400 * DAY)).toBe("ARSENAL");
  });

  it("a second change queues off the settled club, restarting the cooldown", () => {
    const first = planFavoriteClubChange({ favoriteClub: "ARSENAL" }, T0, "SPURS");
    // By day 28 Spurs has landed; changing again then runs to day 56.
    const second = planFavoriteClubChange(first, T0 + 28 * DAY, "CHELSEA");
    expect(second.favoriteClub).toBe("SPURS");
    expect(second.favoriteClubEffectiveFrom).toBe(T0 + 56 * DAY);
    expect(resolveFavoriteClub(second, T0 + 55 * DAY)).toBe("SPURS");
    expect(resolveFavoriteClub(second, T0 + 56 * DAY)).toBe("CHELSEA");
  });

  it("returns null when no favorite was ever set", () => {
    expect(resolveFavoriteClub({}, T0)).toBeNull();
  });
});

// ── zoned wall clock ──
//
// The "finality cut" suite that used to sit here tested
// fantasyConstants.finalityAtOrAfter, which the owner's STOP-E ruling deleted
// (a fixed Tuesday cannot express a midweek gameweek settling on Friday). Its
// coverage — Paris wall clock, CET vs CEST, both DST switches — moved to
// fantasyGameweekWindows.test.ts, against windowFor().finalityAt.
//
// What remains here is the primitive those tests were really leaning on, and
// which fantasyConstants still owns.

describe("zonedWallClockToEpochMs (FW-1 STOP-5: Europe/Paris wall clock)", () => {
  it("round-trips a wall clock through the DST gap without drifting a day", () => {
    // 2027-03-28 02:30 Paris does not exist (clocks jump 02:00 -> 03:00).
    // The resolver must still land on that morning, not the previous day.
    const resolved = zonedWallClockToEpochMs(2027, 3, 28, 2, 30);
    expect(new Date(resolved).toISOString().slice(0, 10)).toBe("2027-03-28");
  });

  it("resolves the same wall clock to different instants across DST", () => {
    // 23:59 Paris is 22:59Z in winter (CET) and 21:59Z in summer (CEST).
    const winter = zonedWallClockToEpochMs(2027, 1, 12, 23, 59);
    const summer = zonedWallClockToEpochMs(2026, 8, 18, 23, 59);
    expect(new Date(winter).toISOString()).toBe("2027-01-12T22:59:00.000Z");
    expect(new Date(summer).toISOString()).toBe("2026-08-18T21:59:00.000Z");
  });
});
