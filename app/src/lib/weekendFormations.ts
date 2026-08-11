/**
 * THE WEEKEND — formation presets and the shape-change planner (FW-POLISH O1).
 *
 * Football players think in shapes, not steppers (owner ruling D3). This
 * module owns the two client-side facts that follow from that:
 *
 *  1. The preset catalogue: every XI shape a normal person would name that is
 *     legal under FORMATION_BOUNDS (GK 1 / DEF 3-5 / MID 2-5 / ATT 1-3).
 *     The server keeps enforcing the structural rule — these chips are a
 *     rendering of it, and `presetsAreLegal` proves the catalogue against the
 *     bounds in the test suite so the two can never drift.
 *
 *  2. `planFormationChange`: given the current 13 slots and a target shape,
 *     the single setFormation payload that reaches it. Locked slots keep
 *     their (role, isFinisher) verbatim — the server rejects anything else —
 *     and every filled slot keeps its role when the target shape has room.
 *     Filled slots that cannot keep their role are DISPLACED: the caller
 *     clears them and holds the players in a visible tray (D3: "never
 *     silently drops a pick"). Crew sheets pass `playersFixed`, where
 *     clearing is illegal (the 13 are the 13, FW-3): there the same slots
 *     come back as `outOfRole` instead, for an explicit confirmation.
 *
 * Pure module: no Convex, no clock, no React.
 */
import {
  FORMATION_BOUNDS,
  SLOT_ROLES,
  XI_SIZE,
  type SlotRole,
} from "../../convex/lib/fantasyConstants";

export interface FormationShape {
  readonly DEF: number;
  readonly MID: number;
  readonly ATT: number;
}

/** D3's chip list, in the ruling's order. */
export const FORMATION_PRESETS: ReadonlyArray<{
  label: string;
  shape: FormationShape;
}> = [
  { label: "4-4-2", shape: { DEF: 4, MID: 4, ATT: 2 } },
  { label: "4-3-3", shape: { DEF: 4, MID: 3, ATT: 3 } },
  { label: "3-5-2", shape: { DEF: 3, MID: 5, ATT: 2 } },
  { label: "3-4-3", shape: { DEF: 3, MID: 4, ATT: 3 } },
  { label: "5-3-2", shape: { DEF: 5, MID: 3, ATT: 2 } },
  { label: "4-5-1", shape: { DEF: 4, MID: 5, ATT: 1 } },
  { label: "5-4-1", shape: { DEF: 5, MID: 4, ATT: 1 } },
];

/** "4-4-2"-style label for any XI role count (works for non-preset shapes). */
export function shapeLabel(shape: FormationShape): string {
  return `${shape.DEF}-${shape.MID}-${shape.ATT}`;
}

export function shapeToFormation(shape: FormationShape): Record<SlotRole, number> {
  return { GK: 1, DEF: shape.DEF, MID: shape.MID, ATT: shape.ATT };
}

/** Structural legality against FORMATION_BOUNDS + the XI size. */
export function isLegalShape(shape: FormationShape): boolean {
  const formation = shapeToFormation(shape);
  return (
    SLOT_ROLES.every(
      (role) =>
        formation[role] >= FORMATION_BOUNDS[role].min &&
        formation[role] <= FORMATION_BOUNDS[role].max,
    ) && SLOT_ROLES.reduce((sum, role) => sum + formation[role], 0) === XI_SIZE
  );
}

/** The minimal slot facts the planner reads — structural over both the budget
 *  squad payload and a crew sheet. */
export interface PlannerSlot {
  slotIndex: number;
  slotRole: SlotRole;
  isFinisher: boolean;
  playerId: string | null;
  locked: boolean;
}

// Plain shape rather than a discriminated union — the project compiles with
// strictNullChecks off, where `{ ok: true } | { ok: false }` does not narrow
// (the passwordPolicy.ts precedent).
export interface FormationPlan {
  ok: boolean;
  /** When not ok: the role whose locked slots alone overflow the target shape. */
  lockedConflict: SlotRole | null;
  /** Full 13-slot setFormation payload (finishers pass through untouched).
   *  Empty when not ok. */
  payload: Array<{ slotIndex: number; slotRole: SlotRole; isFinisher: boolean }>;
  /** Filled slots whose role changed — budget mode clears these into the
   *  tray; crew mode confirms them as out-of-role. Empty when the shape
   *  fits everyone. */
  displaced: Array<{ slotIndex: number; playerId: string }>;
  /** True when the payload differs from the current arrangement. */
  changesAnything: boolean;
}

/**
 * Plan the role relabelling that takes the XI to `shape`.
 *
 * Assignment order (deterministic, slotIndex-ascending within each pass):
 *   locked slots keep everything → filled unlocked slots keep their role
 *   while the shape has room → empty slots keep their role while it has room
 *   → leftover roles go to the remaining slots, empty slots first, so a
 *   filled slot only changes role when the shape truly cannot hold it.
 */
export function planFormationChange(
  slots: ReadonlyArray<PlannerSlot>,
  shape: FormationShape,
): FormationPlan {
  const target = shapeToFormation(shape);
  const xi = slots.filter((s) => !s.isFinisher);

  // Locked XI slots are immovable facts — subtract them from the capacity.
  const capacity: Record<SlotRole, number> = { ...target };
  for (const slot of xi) {
    if (!slot.locked) continue;
    capacity[slot.slotRole] -= 1;
    if (capacity[slot.slotRole] < 0) {
      return {
        ok: false,
        lockedConflict: slot.slotRole,
        payload: [],
        displaced: [],
        changesAnything: false,
      };
    }
  }

  const assigned = new Map<number, SlotRole>();
  const unassigned: PlannerSlot[] = [];

  // Keep-your-role passes: filled slots outrank empty ones for the capacity.
  for (const filledPass of [true, false]) {
    for (const slot of xi) {
      if (slot.locked || assigned.has(slot.slotIndex)) continue;
      if ((slot.playerId !== null) !== filledPass) continue;
      if (capacity[slot.slotRole] > 0) {
        capacity[slot.slotRole] -= 1;
        assigned.set(slot.slotIndex, slot.slotRole);
      } else if (!filledPass) {
        unassigned.push(slot);
      }
    }
  }
  // Filled slots that couldn't keep their role join the pool AFTER empty ones
  // so leftover roles land on empty slots first.
  for (const slot of xi) {
    if (!slot.locked && !assigned.has(slot.slotIndex) && slot.playerId !== null) {
      unassigned.push(slot);
    }
  }
  // Empty-first ordering: `unassigned` currently holds empties (push order of
  // the second pass) followed by filled leftovers — hand out roles in order.
  const leftoverRoles: SlotRole[] = [];
  for (const role of SLOT_ROLES) {
    for (let i = 0; i < capacity[role]; i += 1) leftoverRoles.push(role);
  }
  const displaced: Array<{ slotIndex: number; playerId: string }> = [];
  unassigned.forEach((slot, i) => {
    const role = leftoverRoles[i];
    assigned.set(slot.slotIndex, role);
    if (slot.playerId !== null && role !== slot.slotRole) {
      displaced.push({ slotIndex: slot.slotIndex, playerId: slot.playerId });
    }
  });

  const payload = slots
    .slice()
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((slot) => ({
      slotIndex: slot.slotIndex,
      slotRole: slot.isFinisher ? slot.slotRole : (assigned.get(slot.slotIndex) ?? slot.slotRole),
      isFinisher: slot.isFinisher,
    }));

  const changesAnything = payload.some((next) => {
    const prev = slots.find((s) => s.slotIndex === next.slotIndex)!;
    return prev.slotRole !== next.slotRole || prev.isFinisher !== next.isFinisher;
  });

  return { ok: true, lockedConflict: null, payload, displaced, changesAnything };
}

/** The XI's current shape, read off the slots. */
export function currentShape(slots: ReadonlyArray<PlannerSlot>): FormationShape {
  const counts = { DEF: 0, MID: 0, ATT: 0 };
  for (const slot of slots) {
    if (slot.isFinisher || slot.slotRole === "GK") continue;
    counts[slot.slotRole] += 1;
  }
  return counts;
}
