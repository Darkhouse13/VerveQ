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
  BUDGET_LIMIT,
  FAVORITE_CLUB_COOLDOWN_GAMEWEEKS,
  FINALITY_TIME_ZONE,
  PER_CLUB_CAP,
  PLACEHOLDER_PENDING_PRICING_PASS,
  SQUAD_SIZE,
  finalityAtOrAfter,
  zonedWallClockToEpochMs,
  type SlotRole,
} from "../../convex/lib/fantasyConstants";
import {
  formationOf,
  validateBudget,
  validateClubCap,
  validateFormation,
  validateSquad,
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

  it("exempts the favorite without limit (all 13 from one club)", () => {
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) => ({ ...s, playerId: `all${i}` }));
    const allPool = poolOf(
      ...Array.from({ length: SQUAD_SIZE }, (_, i) => player({ _id: `all${i}`, clubId: "BIG_CLUB" })),
    );
    expect(validateClubCap(slots, allPool, "BIG_CLUB").ok).toBe(true);
    expect(validateClubCap(slots, allPool, null).ok).toBe(false);
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

// ── budget ──

describe("budget invariant (BUDGET_MODE v1.0 §Deadlines & editing)", () => {
  it("uses the placeholder constant pending the pricing pass", () => {
    expect(BUDGET_LIMIT).toBe(PLACEHOLDER_PENDING_PRICING_PASS);
    expect(PLACEHOLDER_PENDING_PRICING_PASS).toBe(100.0);
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

describe("favorite-club 4-gameweek cooldown (DRAFT_ROOM v1.0 ledger 7)", () => {
  it("applies the first-ever favorite immediately (FW-1 ruling S2)", () => {
    const patch = planFavoriteClubChange({}, 3, "ARSENAL");
    expect(patch.favoriteClub).toBe("ARSENAL");
    expect(patch.favoriteClubPending).toBeUndefined();
    expect(resolveFavoriteClub(patch, 3)).toBe("ARSENAL");
  });

  it("a change made in GW3 does not apply until GW7 (= GW+4)", () => {
    const before = { favoriteClub: "ARSENAL" };
    const patch = planFavoriteClubChange(before, 3, "SPURS");

    expect(patch.favoriteClubEffectiveFrom).toBe(3 + FAVORITE_CLUB_COOLDOWN_GAMEWEEKS);
    expect(patch.favoriteClubEffectiveFrom).toBe(7);

    // Inert for GW3, 4, 5, 6 — the old club is still the one in force (S1).
    for (const gw of [3, 4, 5, 6]) {
      expect(resolveFavoriteClub(patch, gw)).toBe("ARSENAL");
    }
    // Live from GW7 onward.
    for (const gw of [7, 8, 99]) {
      expect(resolveFavoriteClub(patch, gw)).toBe("SPURS");
    }
  });

  it("the exemption follows the club in force, not the queued one", () => {
    const patch = planFavoriteClubChange({ favoriteClub: "ARSENAL" }, 3, "SPURS");
    const slots = squadOf(FOUR_FOUR_TWO).map((s, i) =>
      i < 4 ? { ...s, playerId: `s${i}` } : s,
    );
    const pool = poolOf(...[0, 1, 2, 3].map((i) => player({ _id: `s${i}`, clubId: "SPURS" })));

    // Four Spurs players in GW4: the change has not landed, so no exemption.
    expect(validateClubCap(slots, pool, resolveFavoriteClub(patch, 4)).ok).toBe(false);
    // The same squad in GW7: Spurs is now the favorite, so it is legal.
    expect(validateClubCap(slots, pool, resolveFavoriteClub(patch, 7)).ok).toBe(true);
  });

  it("reverting to the club already in force cancels the queued change", () => {
    const queued = planFavoriteClubChange({ favoriteClub: "ARSENAL" }, 3, "SPURS");
    const reverted = planFavoriteClubChange(queued, 4, "ARSENAL");
    expect(reverted.favoriteClub).toBe("ARSENAL");
    expect(reverted.favoriteClubPending).toBeUndefined();
    expect(resolveFavoriteClub(reverted, 99)).toBe("ARSENAL");
  });

  it("a second change queues off the settled club, restarting the cooldown", () => {
    const first = planFavoriteClubChange({ favoriteClub: "ARSENAL" }, 3, "SPURS");
    // By GW7 Spurs has landed; changing again then runs to GW11.
    const second = planFavoriteClubChange(first, 7, "CHELSEA");
    expect(second.favoriteClub).toBe("SPURS");
    expect(second.favoriteClubEffectiveFrom).toBe(11);
    expect(resolveFavoriteClub(second, 10)).toBe("SPURS");
    expect(resolveFavoriteClub(second, 11)).toBe("CHELSEA");
  });

  it("returns null when no favorite was ever set", () => {
    expect(resolveFavoriteClub({}, 5)).toBeNull();
  });
});

// ── finality ──

describe("finality cut: Tuesday 23:59 Europe/Paris (FW-1 STOP-5)", () => {
  /**
   * "Tue 23:59" in Paris. Built from formatToParts rather than format() so the
   * assertion pins the wall clock and not an ICU version's comma placement.
   */
  const partsInParis = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: FINALITY_TIME_ZONE,
      hourCycle: "h23",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(t));
    const at = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${at("weekday")} ${at("hour")}:${at("minute")}`;
  };

  it("lands on Tuesday 23:59 Paris time in winter (CET, UTC+1)", () => {
    const janSaturday = Date.UTC(2027, 0, 9, 12, 0); // Sat 2027-01-09
    const finality = finalityAtOrAfter(janSaturday);
    expect(partsInParis(finality)).toBe("Tue 23:59");
    // 23:59 CET == 22:59Z
    expect(new Date(finality).toISOString()).toBe("2027-01-12T22:59:00.000Z");
  });

  it("lands on Tuesday 23:59 Paris time in summer (CEST, UTC+2)", () => {
    const augSaturday = Date.UTC(2026, 7, 15, 12, 0); // Sat 2026-08-15
    const finality = finalityAtOrAfter(augSaturday);
    expect(partsInParis(finality)).toBe("Tue 23:59");
    // 23:59 CEST == 21:59Z — an hour earlier in UTC than the winter cut. A
    // fixed UTC+1 would have put this at 22:59Z, i.e. 00:59 local Wednesday.
    expect(new Date(finality).toISOString()).toBe("2026-08-18T21:59:00.000Z");
  });

  it("is the same local wall clock on both sides of the DST switch", () => {
    // Paris springs forward 2027-03-28; these two weekends straddle it.
    const before = finalityAtOrAfter(Date.UTC(2027, 2, 20, 12, 0));
    const after = finalityAtOrAfter(Date.UTC(2027, 2, 30, 12, 0));
    expect(partsInParis(before)).toBe("Tue 23:59");
    expect(partsInParis(after)).toBe("Tue 23:59");
    // …but a different UTC offset, which is exactly what "wall clock" means.
    expect(new Date(before).getUTCHours()).toBe(22);
    expect(new Date(after).getUTCHours()).toBe(21);
  });

  it("rolls to next Tuesday once this week's cut has passed", () => {
    const cut = finalityAtOrAfter(Date.UTC(2026, 7, 15, 12, 0));
    const justAfter = finalityAtOrAfter(cut + 60_000);
    expect(justAfter - cut).toBe(7 * 86_400_000);
    expect(partsInParis(justAfter)).toBe("Tue 23:59");
  });

  it("returns the cut itself when asked at exactly that instant", () => {
    const cut = finalityAtOrAfter(Date.UTC(2026, 7, 15, 12, 0));
    expect(finalityAtOrAfter(cut)).toBe(cut);
  });

  it("round-trips a wall clock through the DST gap without drifting a day", () => {
    // 2027-03-28 02:30 Paris does not exist (clocks jump 02:00 -> 03:00).
    // The resolver must still land on that morning, not the previous day.
    const resolved = zonedWallClockToEpochMs(2027, 3, 28, 2, 30);
    expect(new Date(resolved).toISOString().slice(0, 10)).toBe("2027-03-28");
  });
});
