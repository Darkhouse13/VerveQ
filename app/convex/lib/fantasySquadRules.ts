/**
 * Weekend Fantasy — squad legality, as pure functions over plain snapshots.
 *
 * Every invariant the FW-1 mutations enforce is defined exactly once here, so
 * the rules can be unit tested without a database and so createSquad, setSlot
 * and setFormation cannot drift apart about what "legal" means.
 *
 * Specs: BUDGET_MODE_SPEC.md v1.0 §Squad construction / §Deadlines & editing;
 * DRAFT_ROOM_SPEC.md v1.0 §Room parameters.
 *
 * NOT here (later tickets own them):
 *  - unique player ownership ACROSS a crew room (FW-3 — needs room state)
 *  - the default team sheet (FW-3)
 *  - anything that scores (FS-1 engine / a later scoring ticket)
 */

import {
  FINISHER_COUNT,
  FORMATION_BOUNDS,
  PER_CLUB_CAP,
  SLOT_ROLES,
  SQUAD_BUDGET,
  SQUAD_SIZE,
  XI_SIZE,
  type SlotRole,
} from "./fantasyConstants";

export type SquadContext = "budget" | "crew";

/** A squad slot reduced to the fields the rules care about. */
export interface SlotSnapshot {
  readonly slotIndex: number;
  readonly slotRole: SlotRole;
  readonly isFinisher: boolean;
  readonly playerId: string | null;
  /** Stamped by the sweep; see `effectivelyLocked` for the authoritative test. */
  readonly lockedAt: number | null;
  readonly committedPrice: number | null;
}

/** A player reduced to the fields the rules care about. */
export interface PlayerSnapshot {
  readonly _id: string;
  readonly clubId: string;
  readonly price: number | null;
  readonly active: boolean;
  /** Only ever used to make an error message readable. */
  readonly name?: string;
}

export interface Violation {
  readonly code: string;
  readonly message: string;
}

export interface RuleResult {
  readonly ok: boolean;
  readonly violations: readonly Violation[];
}

const OK: RuleResult = { ok: true, violations: [] };

function fail(...violations: Violation[]): RuleResult {
  return { ok: false, violations };
}

function combine(...results: RuleResult[]): RuleResult {
  const violations = results.flatMap((r) => r.violations);
  return violations.length === 0 ? OK : { ok: false, violations };
}

// ── shape ──

/**
 * SQUAD_SIZE rows, slotIndex 0..12 exactly once each, exactly FINISHER_COUNT
 * finishers and therefore exactly XI_SIZE starters.
 *
 * BUDGET_MODE §Squad construction: "13: XI + 2 finishers | LOCKED".
 */
export function validateSquadShape(slots: readonly SlotSnapshot[]): RuleResult {
  const violations: Violation[] = [];

  if (slots.length !== SQUAD_SIZE) {
    violations.push({
      code: "squad_size",
      message: `A squad has exactly ${SQUAD_SIZE} slots; got ${slots.length}.`,
    });
  }

  const indices = new Set(slots.map((s) => s.slotIndex));
  const indicesValid =
    indices.size === slots.length &&
    slots.every((s) => Number.isInteger(s.slotIndex) && s.slotIndex >= 0 && s.slotIndex < SQUAD_SIZE);
  if (!indicesValid) {
    violations.push({
      code: "slot_index",
      message: `Slot indices must be 0..${SQUAD_SIZE - 1}, each exactly once.`,
    });
  }

  const finishers = slots.filter((s) => s.isFinisher).length;
  if (finishers !== FINISHER_COUNT) {
    violations.push({
      code: "finisher_count",
      message: `A squad has exactly ${FINISHER_COUNT} finishers; got ${finishers}.`,
    });
  }

  const starters = slots.length - finishers;
  if (slots.length === SQUAD_SIZE && finishers === FINISHER_COUNT && starters !== XI_SIZE) {
    violations.push({
      code: "xi_size",
      message: `The XI must hold exactly ${XI_SIZE} slots; got ${starters}.`,
    });
  }

  // A squad may not field the same player twice. This is not a spec clause —
  // it is what "a squad of 13 players" means — but it is enforced here so the
  // omission can never be mistaken for permission.
  const filled = slots.map((s) => s.playerId).filter((id): id is string => id !== null);
  if (new Set(filled).size !== filled.length) {
    violations.push({
      code: "duplicate_player",
      message: "A player may not occupy two slots in the same squad.",
    });
  }

  return violations.length === 0 ? OK : { ok: false, violations };
}

// ── formation ──

export type Formation = Record<SlotRole, number>;

/** The formation a set of slots actually describes: the XI's slotRole counts. */
export function formationOf(slots: readonly SlotSnapshot[]): Formation {
  const counts: Formation = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const slot of slots) {
    if (!slot.isFinisher) counts[slot.slotRole] += 1;
  }
  return counts;
}

/**
 * The formation structural rule — BUDGET_MODE §Squad construction, "Formation
 * structural rule (LOCKED, FW-1 STOP-2 ruling 2026-07-28)": exactly 1 GK,
 * DEF 3–5, MID 2–5, ATT 1–3, total 11.
 *
 * Governs the XI only. Finisher slotRoles are free (FW-1 STOP-3) and are not
 * counted here — that is why `formationOf` skips them.
 */
export function validateFormation(formation: Formation): RuleResult {
  const violations: Violation[] = [];

  for (const role of SLOT_ROLES) {
    const { min, max } = FORMATION_BOUNDS[role];
    const count = formation[role] ?? 0;
    if (count < min || count > max) {
      violations.push({
        code: `formation_${role.toLowerCase()}`,
        message:
          min === max
            ? `A formation needs exactly ${min} ${role}; got ${count}.`
            : `A formation needs ${min}–${max} ${role}; got ${count}.`,
      });
    }
  }

  const total = SLOT_ROLES.reduce((sum, role) => sum + (formation[role] ?? 0), 0);
  if (total !== XI_SIZE) {
    violations.push({
      code: "formation_total",
      message: `A formation must total ${XI_SIZE} outfield+GK slots; got ${total}.`,
    });
  }

  return violations.length === 0 ? OK : { ok: false, violations };
}

/** Convenience: the formation implied by these slots is legal. */
export function validateSlotFormation(slots: readonly SlotSnapshot[]): RuleResult {
  return validateFormation(formationOf(slots));
}

// ── club cap ──

/**
 * Per-club cap of 3, with the favorite club uncapped.
 *
 * DRAFT_ROOM §Room parameters: "max 3 per squad, EXCEPT unlimited from the
 * drafter's favorite club"; ledger item 8 extends it to budget mode, so this
 * function is context-independent.
 *
 * `favoriteClub` MUST be the snapshot taken when the squad was built
 * (fantasySquads.favoriteClubAtBuild), never a freshly-read user doc — see
 * lib/fantasyFavoriteClub.
 *
 * Counts every filled slot, locked or not: the cap is a property of the squad
 * of 13, and a locked slot is still one of the 13.
 */
export function validateClubCap(
  slots: readonly SlotSnapshot[],
  playersById: ReadonlyMap<string, PlayerSnapshot>,
  favoriteClub: string | null,
): RuleResult {
  const perClub = new Map<string, number>();

  for (const slot of slots) {
    if (slot.playerId === null) continue;
    const player = playersById.get(slot.playerId);
    if (player === undefined) {
      return fail({
        code: "unknown_player",
        message: `Slot ${slot.slotIndex} references a player that does not exist.`,
      });
    }
    perClub.set(player.clubId, (perClub.get(player.clubId) ?? 0) + 1);
  }

  const violations: Violation[] = [];
  for (const [clubId, count] of perClub) {
    if (favoriteClub !== null && clubId === favoriteClub) continue; // exempt
    if (count > PER_CLUB_CAP) {
      violations.push({
        code: "club_cap",
        message: `At most ${PER_CLUB_CAP} players from one club (${clubId} has ${count}). Your favorite club is exempt.`,
      });
    }
  }

  return violations.length === 0 ? OK : { ok: false, violations };
}

// ── budget ──

export interface BudgetBreakdown {
  readonly committed: number;
  readonly live: number;
  readonly total: number;
  readonly limit: number;
}

/**
 * The budget invariant — BUDGET_MODE §Deadlines & editing:
 *   "committed (locked) cost + current unlocked selections ≤ budget. Editing
 *    Sunday around a locked Saturday is the intended skill."
 *
 * BUDGET CONTEXT ONLY. DRAFT_ROOM §Room parameters sets "Budget | none" for
 * crew rooms, so callers must not run this on a crew squad.
 *
 * `isLocked` is passed in rather than read off `slot.lockedAt` because the
 * authoritative lock test is live fixture data, not the sweep's stamp (see
 * fantasyLocks.isSlotLocked). A slot whose fixture kicked off a minute ago is
 * locked even though the sweep has not stamped it yet, and this function must
 * price it as committed.
 *
 * For a locked slot the committed price is `committedPrice` when stamped, else
 * the player's current price. The fallback is exact rather than approximate:
 * BUDGET_MODE fixes prices as "static within a gameweek", so the price the
 * sweep would stamp is the price showing now.
 *
 * A null price fails closed (FW-1 STOP-4) — an unpriced player cannot enter a
 * budget squad at all.
 */
export function validateBudget(
  slots: readonly SlotSnapshot[],
  playersById: ReadonlyMap<string, PlayerSnapshot>,
  isLocked: (slot: SlotSnapshot) => boolean,
  limit: number = SQUAD_BUDGET,
): RuleResult & { breakdown?: BudgetBreakdown } {
  let committed = 0;
  let live = 0;

  for (const slot of slots) {
    if (slot.playerId === null) continue; // unfilled costs nothing, scores zero
    const player = playersById.get(slot.playerId);
    if (player === undefined) {
      return fail({
        code: "unknown_player",
        message: `Slot ${slot.slotIndex} references a player that does not exist.`,
      });
    }

    const locked = isLocked(slot);
    const price = locked ? (slot.committedPrice ?? player.price) : player.price;

    if (price === null) {
      return fail({
        code: "unpriced_player",
        message:
          `${player.name ?? player._id} has no editorial price yet and cannot be picked in budget mode. ` +
          "(Pricing pass pending — BUDGET_MODE_SPEC open item 1.)",
      });
    }

    if (locked) committed += price;
    else live += price;
  }

  const total = committed + live;
  const breakdown: BudgetBreakdown = { committed, live, total, limit };

  if (total > limit) {
    return {
      ok: false,
      breakdown,
      violations: [
        {
          code: "budget_exceeded",
          message: `Squad costs ${total.toFixed(1)} of a ${limit.toFixed(1)} budget (${committed.toFixed(1)} already committed to locked slots).`,
        },
      ],
    };
  }

  return { ok: true, violations: [], breakdown };
}

// ── whole-squad gate ──

/**
 * Every invariant that must hold after any mutation. The mutations call this
 * on the POST-EDIT slot set, so an edit is accepted only if the squad it
 * produces is legal — there is no such thing as a transiently illegal squad.
 */
export function validateSquad(args: {
  slots: readonly SlotSnapshot[];
  playersById: ReadonlyMap<string, PlayerSnapshot>;
  favoriteClub: string | null;
  context: SquadContext;
  isLocked: (slot: SlotSnapshot) => boolean;
  budgetLimit?: number;
}): RuleResult {
  const { slots, playersById, favoriteClub, context, isLocked, budgetLimit } = args;

  const structural = combine(
    validateSquadShape(slots),
    validateSlotFormation(slots),
    validateClubCap(slots, playersById, favoriteClub),
  );

  // Crew rooms have no budget at all (DRAFT_ROOM §Room parameters), so an
  // unpriced player is legal there — do not even look at prices.
  if (context === "crew") return structural;

  return combine(structural, validateBudget(slots, playersById, isLocked, budgetLimit));
}

/** Render violations into one thrown-error sentence. */
export function describeViolations(result: RuleResult): string {
  return result.violations.map((v) => v.message).join(" ");
}
