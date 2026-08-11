/**
 * FW-POLISH O1 — the formation preset catalogue and shape-change planner.
 *
 * The catalogue must agree with the server's structural rule forever, and the
 * planner's promise is D3's: locked slots verbatim, keep every player the
 * shape can hold, displace the rest visibly — never silently.
 */
import { describe, expect, it } from "vitest";
import {
  FORMATION_BOUNDS,
  SLOT_ROLES,
  XI_SIZE,
  type SlotRole,
} from "../../convex/lib/fantasyConstants";
import {
  FORMATION_CATALOGUE,
  currentShape,
  formationsForShape,
  isLegalShape,
  planFormationChange,
  resolveFormation,
  sameShape,
  shapeToFormation,
  type FormationShape,
  type PlannerSlot,
} from "@/lib/weekendFormations";

/** Build a 13-slot squad: XI per shape counts, then two finishers. */
function squad(
  xiRoles: SlotRole[],
  opts: {
    filled?: number[];
    locked?: number[];
    finisherRoles?: [SlotRole, SlotRole];
  } = {},
): PlannerSlot[] {
  const finisherRoles = opts.finisherRoles ?? ["MID", "ATT"];
  const xi = xiRoles.map((role, i) => ({
    slotIndex: i,
    slotRole: role,
    isFinisher: false,
    playerId: opts.filled?.includes(i) ? `p${i}` : null,
    locked: opts.locked?.includes(i) ?? false,
  }));
  const finishers = finisherRoles.map((role, i) => ({
    slotIndex: XI_SIZE + i,
    slotRole: role,
    isFinisher: true,
    playerId: opts.filled?.includes(XI_SIZE + i) ? `p${XI_SIZE + i}` : null,
    locked: opts.locked?.includes(XI_SIZE + i) ?? false,
  }));
  return [...xi, ...finishers];
}

const ROLES_442: SlotRole[] = [
  "GK",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "MID",
  "MID",
  "MID",
  "MID",
  "ATT",
  "ATT",
];

/** Every band count the server's bounds admit, as shapes. */
function allLegalShapes(): FormationShape[] {
  const legal: FormationShape[] = [];
  for (let def = FORMATION_BOUNDS.DEF.min; def <= FORMATION_BOUNDS.DEF.max; def++) {
    for (let mid = FORMATION_BOUNDS.MID.min; mid <= FORMATION_BOUNDS.MID.max; mid++) {
      for (let att = FORMATION_BOUNDS.ATT.min; att <= FORMATION_BOUNDS.ATT.max; att++) {
        if (1 + def + mid + att === XI_SIZE) legal.push({ DEF: def, MID: mid, ATT: att });
      }
    }
  }
  return legal;
}

describe("famous-formation catalogue (FW-POLISH-2 R2)", () => {
  it("is exactly the ruling's list, in the ruling's order", () => {
    expect(FORMATION_CATALOGUE.map((f) => f.name)).toEqual([
      "4-4-2",
      "4-4-1-1",
      "4-1-2-1-2",
      "4-3-3",
      "4-2-3-1",
      "4-5-1",
      "4-1-4-1",
      "4-3-2-1",
      "3-5-2",
      "3-1-4-2",
      "3-4-3",
      "3-4-2-1",
      "5-3-2",
      "5-4-1",
      "5-2-3",
    ]);
  });

  it("maps every entry to a legal band count", () => {
    for (const f of FORMATION_CATALOGUE) {
      expect(isLegalShape(f.shape), f.name).toBe(true);
      const formation = shapeToFormation(f.shape);
      expect(SLOT_ROLES.reduce((sum, r) => sum + formation[r], 0)).toBe(XI_SIZE);
    }
  });

  it("gives every legal band count at least one entry — including 5-2-3", () => {
    for (const shape of allLegalShapes()) {
      const entries = formationsForShape(shape);
      expect(
        entries.length,
        `${shape.DEF}-${shape.MID}-${shape.ATT} has no catalogue entry`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("lays every entry's rows out to the full XI, consistent with its band", () => {
    for (const f of FORMATION_CATALOGUE) {
      const total = f.rows.reduce((sum, r) => sum + r.count, 0);
      expect(total, `${f.name} rows must sum to the XI`).toBe(XI_SIZE);
      // The GK row leads, alone.
      expect(f.rows[0]).toEqual({ role: "GK", count: 1 });
      // Per-role row totals equal the band count the server stores.
      const formation = shapeToFormation(f.shape);
      for (const role of SLOT_ROLES) {
        expect(
          f.rows.filter((r) => r.role === role).reduce((sum, r) => sum + r.count, 0),
          `${f.name} ${role} rows must match the band`,
        ).toBe(formation[role]);
      }
      // Rows keep band order (a MID row never sits behind a DEF row).
      const order = f.rows.map((r) => SLOT_ROLES.indexOf(r.role));
      expect([...order].sort((a, b) => a - b), `${f.name} rows in band order`).toEqual(
        order,
      );
      // No empty rows.
      for (const r of f.rows) expect(r.count, `${f.name} empty row`).toBeGreaterThan(0);
    }
  });

  it("keeps names unique", () => {
    const names = FORMATION_CATALOGUE.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("resolves a stored name while it matches the band, else the band's first entry", () => {
    const shape451: FormationShape = { DEF: 4, MID: 5, ATT: 1 };
    // Remembered same-band choice wins.
    expect(resolveFormation("4-1-4-1", shape451)?.name).toBe("4-1-4-1");
    // A remembered name from ANOTHER band falls back to the first-listed entry.
    expect(resolveFormation("4-4-2", shape451)?.name).toBe("4-2-3-1");
    // Nothing remembered → first-listed too.
    expect(resolveFormation(null, shape451)?.name).toBe("4-2-3-1");
    // Sanity: first-listed entries really share the band.
    for (const shape of allLegalShapes()) {
      const first = resolveFormation(null, shape);
      expect(first).not.toBeNull();
      expect(sameShape(first!.shape, shape)).toBe(true);
    }
  });
});

describe("planFormationChange", () => {
  it("relabels only what the shape demands and touches no finisher", () => {
    const slots = squad(ROLES_442, { filled: [0, 1, 5, 11] });
    const plan = planFormationChange(slots, { DEF: 3, MID: 5, ATT: 2 });
    expect(plan.ok).toBe(true);
    expect(plan.payload).toHaveLength(13);
    expect(plan.changesAnything).toBe(true);
    // Finisher slots pass through verbatim.
    expect(plan.payload[11]).toEqual({ slotIndex: 11, slotRole: "MID", isFinisher: true });
    expect(plan.payload[12]).toEqual({ slotIndex: 12, slotRole: "ATT", isFinisher: true });
    // New XI counts match the target.
    const counts = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    for (const s of plan.payload.filter((s) => !s.isFinisher)) counts[s.slotRole] += 1;
    expect(counts).toEqual({ GK: 1, DEF: 3, MID: 5, ATT: 2 });
  });

  it("keeps every filled slot's role when the shape has room — empties absorb the change", () => {
    // 4-4-2 with the four DEF filled; target 3-5-2 must convert an EMPTY def
    // slot, never a filled one... but four filled DEF into three DEF slots
    // cannot fit — so use three filled DEF and one empty.
    const slots = squad(ROLES_442, { filled: [1, 2, 3, 5, 6] });
    const plan = planFormationChange(slots, { DEF: 3, MID: 5, ATT: 2 });
    expect(plan.ok).toBe(true);
    expect(plan.displaced).toEqual([]);
    // The filled DEF slots (1,2,3) keep DEF; the empty one (4) became MID.
    for (const idx of [1, 2, 3]) {
      expect(plan.payload[idx].slotRole).toBe("DEF");
    }
    expect(plan.payload[4].slotRole).toBe("MID");
  });

  it("displaces the overflow filled slot instead of silently re-labelling it", () => {
    // All four DEF filled, target has three DEF slots: exactly one displaced.
    const slots = squad(ROLES_442, { filled: [1, 2, 3, 4] });
    const plan = planFormationChange(slots, { DEF: 3, MID: 5, ATT: 2 });
    expect(plan.ok).toBe(true);
    expect(plan.displaced).toHaveLength(1);
    expect(plan.displaced[0]).toEqual({ slotIndex: 4, playerId: "p4" });
    // The displaced slot got the leftover role (MID) in the payload.
    expect(plan.payload[4].slotRole).toBe("MID");
  });

  it("keeps locked slots verbatim and refuses shapes their roles overflow", () => {
    // Two locked ATT in a 4-4-2 → any one-ATT shape is unreachable.
    const slots = squad(ROLES_442, { filled: [9, 10], locked: [9, 10] });
    const refused = planFormationChange(slots, { DEF: 4, MID: 5, ATT: 1 });
    expect(refused.ok).toBe(false);
    expect(refused.lockedConflict).toBe("ATT");
    expect(refused.payload).toEqual([]);

    // A two-ATT shape stays reachable and the locked slots are untouched.
    const plan = planFormationChange(slots, { DEF: 3, MID: 5, ATT: 2 });
    expect(plan.ok).toBe(true);
    expect(plan.payload[9]).toEqual({ slotIndex: 9, slotRole: "ATT", isFinisher: false });
    expect(plan.payload[10]).toEqual({ slotIndex: 10, slotRole: "ATT", isFinisher: false });
    expect(plan.displaced).toEqual([]);
  });

  it("reports a no-op when the squad already has the target shape", () => {
    const slots = squad(ROLES_442, { filled: [0, 1] });
    const plan = planFormationChange(slots, { DEF: 4, MID: 4, ATT: 2 });
    expect(plan.ok).toBe(true);
    expect(plan.changesAnything).toBe(false);
    expect(plan.displaced).toEqual([]);
  });

  it("reads the current shape off the XI, ignoring finishers", () => {
    expect(currentShape(squad(ROLES_442))).toEqual({ DEF: 4, MID: 4, ATT: 2 });
  });
});
