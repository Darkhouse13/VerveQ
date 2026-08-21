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
  FAVORITE_CLUB_CAP,
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
 *
 * ── Grandfathering (FW-T1, owner ruling R2) ──
 *
 * Clubs MOVE under a squad now that transfer ingestion updates players'
 * clubs: a squad built legally can wake up holding 4 from one club without
 * any edit having happened. The ruling: "a transfer that pushes a squad over
 * the club cap does NOT invalidate it; the cap applies at mutation time
 * only." `grandfathered` carries the PRE-EDIT per-club counts, and a club's
 * allowance is max(cap, its pre-edit count) — so an edit may never RAISE an
 * over-cap club's count (a new 4th-from-one-club is still blocked, and a 4th
 * of the grandfathered club would be a 5th, also blocked), while an edit that
 * leaves it alone, or reduces it, passes. Without the baseline (createSquad,
 * and every caller predating FW-T1) the strict cap binds unchanged.
 */
export function validateClubCap(
  slots: readonly SlotSnapshot[],
  playersById: ReadonlyMap<string, PlayerSnapshot>,
  favoriteClub: string | null,
  grandfathered?: ReadonlyMap<string, number>,
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
    const isFavorite = favoriteClub !== null && clubId === favoriteClub;
    const cap = isFavorite ? FAVORITE_CLUB_CAP : PER_CLUB_CAP;
    const allowed = Math.max(cap, grandfathered?.get(clubId) ?? 0);
    if (count > allowed) {
      violations.push({
        code: "club_cap",
        // The builder parses this sentence (BudgetSquadScreen clubCapToast) —
        // keep the "At most N players from <which> club (<id> has M)" shape.
        message: isFavorite
          ? `At most ${FAVORITE_CLUB_CAP} players from your favorite club (${clubId} has ${count}).`
          : `At most ${PER_CLUB_CAP} players from one club (${clubId} has ${count}). Your favorite club gets ${FAVORITE_CLUB_CAP}.`,
      });
    }
  }

  return violations.length === 0 ? OK : { ok: false, violations };
}

/**
 * The pre-edit per-club counts `validateClubCap` grandfathers against.
 *
 * A prior slot whose player row is missing from `playersById` contributes
 * nothing: the baseline is a tolerance, and the safe failure is LESS
 * tolerance, not a thrown error on data the edit never touched.
 */
export function clubCountsOf(
  slots: readonly SlotSnapshot[],
  playersById: ReadonlyMap<string, PlayerSnapshot>,
): Map<string, number> {
  const perClub = new Map<string, number>();
  for (const slot of slots) {
    if (slot.playerId === null) continue;
    const player = playersById.get(slot.playerId);
    if (player === undefined) continue;
    perClub.set(player.clubId, (perClub.get(player.clubId) ?? 0) + 1);
  }
  return perClub;
}

// ── budget ──

export interface BudgetBreakdown {
  readonly committed: number;
  readonly live: number;
  readonly total: number;
  readonly limit: number;
  /**
   * What this squad is actually held to: `max(limit, pre-edit total)`. Equal to
   * `limit` for every squad that was under budget when the edit began, and
   * above it only for a squad grandfathered by FW-REPRICE R1.
   */
  readonly allowance: number;
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
 *
 * ── Grandfathering (FW-REPRICE, owner ruling R1) ──
 *
 * PRICES MOVE under a squad now that repricing is a thing the project does: a
 * squad built legally at 90.5 can wake up costing 92.0 without any edit having
 * happened, exactly as a squad can wake up holding four players from one club
 * after a transfer. The ruling is the club cap's, word for word in shape: "any
 * squad whose 13 now cost over 91.0 stays legal ... pre-edit basis; adding cost
 * above the cap still blocked."
 *
 * So `grandfatheredTotal` carries the PRE-EDIT cost and the allowance is
 * `max(limit, grandfatheredTotal)`. An edit that leaves an over-budget squad
 * alone, or makes it cheaper, passes; one that makes it MORE expensive is
 * blocked even when it stays under the grandfathered total's own ceiling —
 * because the ceiling moves down with it, never up. Without the baseline
 * (createSquad, and every caller predating this ticket) the strict limit binds
 * unchanged.
 */
export function validateBudget(
  slots: readonly SlotSnapshot[],
  playersById: ReadonlyMap<string, PlayerSnapshot>,
  isLocked: (slot: SlotSnapshot) => boolean,
  limit: number = SQUAD_BUDGET,
  grandfatheredTotal?: number,
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
  // Rounded to the half point the prices themselves live on: summing 13 floats
  // can leave 91.000000000000014, and a squad must not be rejected by binary
  // representation. Prices are all multiples of 0.5, so any real overspend is
  // at least 0.5 and survives the rounding.
  const allowance = Math.round(Math.max(limit, grandfatheredTotal ?? 0) * 2) / 2;
  const breakdown: BudgetBreakdown = { committed, live, total, limit, allowance };

  if (Math.round(total * 2) / 2 > allowance) {
    return {
      ok: false,
      breakdown,
      violations: [
        {
          code: "budget_exceeded",
          message:
            allowance > limit
              ? `Squad costs ${total.toFixed(1)}. Repricing left it above the ${limit.toFixed(1)} budget, so it stays legal at ${allowance.toFixed(1)}, but a change cannot make it cost more.`
              : `Squad costs ${total.toFixed(1)} of a ${limit.toFixed(1)} budget (${committed.toFixed(1)} already committed to locked slots).`,
        },
      ],
    };
  }

  return { ok: true, violations: [], breakdown };
}

/**
 * The pre-edit total cost `validateBudget` grandfathers against — the budget
 * sibling of `clubCountsOf`, and tolerant in the same direction. A prior slot
 * whose player row is missing, or who has no price, contributes nothing: the
 * baseline is a tolerance, and the safe failure is LESS tolerance rather than
 * a thrown error on data the edit never touched.
 */
export function totalCostOf(
  slots: readonly SlotSnapshot[],
  playersById: ReadonlyMap<string, PlayerSnapshot>,
  isLocked: (slot: SlotSnapshot) => boolean,
): number {
  let total = 0;
  for (const slot of slots) {
    if (slot.playerId === null) continue;
    const player = playersById.get(slot.playerId);
    if (player === undefined) continue;
    const price = isLocked(slot) ? (slot.committedPrice ?? player.price) : player.price;
    if (price === null) continue;
    total += price;
  }
  return total;
}

// ── whole-squad gate ──

/**
 * Every invariant that must hold after any mutation. The mutations call this
 * on the POST-EDIT slot set, so an edit is accepted only if the squad it
 * produces is legal — there is no such thing as a transiently illegal squad.
 *
 * `priorSlots` is the PRE-EDIT slot set, and exists for exactly two rules: the
 * club-cap grandfather (FW-T1 R2 — see validateClubCap) and the budget
 * grandfather (FW-REPRICE R1 — see validateBudget). Callers validating a squad
 * that has no prior state (createSquad) omit it and get both strict limits.
 * `playersById` must then cover the players of BOTH sets — a swap's outgoing
 * player is part of the baseline even though no post-edit slot names him.
 */
export function validateSquad(args: {
  slots: readonly SlotSnapshot[];
  playersById: ReadonlyMap<string, PlayerSnapshot>;
  favoriteClub: string | null;
  context: SquadContext;
  isLocked: (slot: SlotSnapshot) => boolean;
  budgetLimit?: number;
  priorSlots?: readonly SlotSnapshot[];
}): RuleResult {
  const { slots, playersById, favoriteClub, context, isLocked, budgetLimit, priorSlots } = args;

  const structural = combine(
    validateSquadShape(slots),
    validateSlotFormation(slots),
    validateClubCap(
      slots,
      playersById,
      favoriteClub,
      priorSlots === undefined ? undefined : clubCountsOf(priorSlots, playersById),
    ),
  );

  // Crew rooms have no budget at all (DRAFT_ROOM §Room parameters), so an
  // unpriced player is legal there — do not even look at prices.
  if (context === "crew") return structural;

  return combine(
    structural,
    validateBudget(
      slots,
      playersById,
      isLocked,
      budgetLimit,
      priorSlots === undefined ? undefined : totalCostOf(priorSlots, playersById, isLocked),
    ),
  );
}

/** Render violations into one thrown-error sentence. */
export function describeViolations(result: RuleResult): string {
  return result.violations.map((v) => v.message).join(" ");
}
