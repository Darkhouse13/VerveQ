/**
 * Weekend Fantasy — favorite-club resolution under the 4-gameweek cooldown.
 *
 * DRAFT_ROOM_SPEC v1.0 §Favorite-club exemption + ledger items 7 and 8:
 *   "each user logs ONE favorite club at profile level. The 3-per-club cap
 *    doesn't apply to it. Anti-gaming: favorite changes take effect after a
 *    4-gameweek cooldown, and the favorite in force when the room arms is the
 *    one that counts — never changeable mid-draft. Exemption applies
 *    identically in budget mode."
 *
 * PURE — no Convex, no clock. The user doc is passed in as a plain snapshot so
 * every rule below is a unit test, not an integration test.
 *
 * ── TWO SPEC SILENCES, ruled here and flagged in the FW-1 ledger ──
 *
 * S1. During a cooldown, is the OLD club still in force, or is the user left
 *     with no favorite at all? Ruled: the old club stays in force. "Changes
 *     take effect after a cooldown" describes when the NEW club starts, and
 *     leaving a user exemption-less for four weekends would be a punishment
 *     the spec never asks for.
 *
 * S2. Is the FIRST-EVER set also delayed? Ruled: no, it applies immediately.
 *     The spec's cooldown is explicitly on "favorite changes", and a first set
 *     is not a change — there is no prior club to game against, so the
 *     anti-gaming rationale has nothing to bite on.
 *
 * Both are isolated in this file; if the owner rules the other way, only
 * `resolveFavoriteClub` and `planFavoriteClubChange` move.
 */

import { FAVORITE_CLUB_COOLDOWN_GAMEWEEKS } from "./fantasyConstants";

/** The favorite-club fields of a user doc, as plain data. */
export interface FavoriteClubState {
  readonly favoriteClub?: string | null;
  readonly favoriteClubPending?: string | null;
  readonly favoriteClubEffectiveFrom?: number | null;
}

/** A patch to apply to the user doc. `null` means "clear this field". */
export interface FavoriteClubPatch {
  favoriteClub?: string;
  favoriteClubPending?: string | undefined;
  favoriteClubEffectiveFrom?: number | undefined;
}

/**
 * Fold a queued change into the in-force club if it has come due by
 * `gwNumber`. This is the one place the cooldown comparison is written.
 *
 * Note the boundary: `gwNumber >= effectiveFrom`. A change queued during GW n
 * gets effectiveFrom = n + 4, so it is inert for GW n, n+1, n+2 and n+3, and
 * live from GW n+4 — "does not apply until GW+4", exactly.
 */
function settle(
  state: FavoriteClubState,
  gwNumber: number,
): { inForce: string | null; pending: string | null; effectiveFrom: number | null } {
  const current = state.favoriteClub ?? null;
  const pending = state.favoriteClubPending ?? null;
  const effectiveFrom = state.favoriteClubEffectiveFrom ?? null;

  if (pending !== null && effectiveFrom !== null && gwNumber >= effectiveFrom) {
    return { inForce: pending, pending: null, effectiveFrom: null };
  }
  return { inForce: current, pending, effectiveFrom };
}

/**
 * The club whose players are exempt from the per-club cap for a squad built in
 * `gwNumber`. Returns null when the user has never set one.
 *
 * Callers must resolve this ONCE, at squad-build / room-arm time, and snapshot
 * it onto the squad (fantasySquads.favoriteClubAtBuild). Re-resolving it later
 * against a live user doc would let a favorite change alter an existing
 * squad's legality, which §Favorite-club exemption forbids.
 */
export function resolveFavoriteClub(
  state: FavoriteClubState,
  gwNumber: number,
): string | null {
  return settle(state, gwNumber).inForce;
}

/** Whether a queued change is still waiting at `gwNumber`. */
export function hasPendingFavoriteChange(
  state: FavoriteClubState,
  gwNumber: number,
): boolean {
  return settle(state, gwNumber).pending !== null;
}

/** The gameweek a queued change becomes live, or null if nothing is queued. */
export function pendingFavoriteEffectiveFrom(
  state: FavoriteClubState,
  gwNumber: number,
): number | null {
  return settle(state, gwNumber).effectiveFrom;
}

/**
 * Build the user-doc patch for setting the favorite club to `nextClub` during
 * `gwNumber`.
 *
 * Four cases:
 *  - no club ever set        ⇒ immediate (S2)
 *  - set to the club already in force ⇒ cancels any queued change; the user is
 *    reverting, and making a revert wait four weekends would be perverse
 *  - a due change exists     ⇒ settled first, then the new change queued off it
 *  - otherwise               ⇒ queued for gwNumber + 4, old club stays (S1)
 */
export function planFavoriteClubChange(
  state: FavoriteClubState,
  gwNumber: number,
  nextClub: string,
): FavoriteClubPatch {
  const { inForce } = settle(state, gwNumber);

  if (inForce === null) {
    return {
      favoriteClub: nextClub,
      favoriteClubPending: undefined,
      favoriteClubEffectiveFrom: undefined,
    };
  }

  if (inForce === nextClub) {
    return {
      favoriteClub: inForce,
      favoriteClubPending: undefined,
      favoriteClubEffectiveFrom: undefined,
    };
  }

  return {
    favoriteClub: inForce,
    favoriteClubPending: nextClub,
    favoriteClubEffectiveFrom: gwNumber + FAVORITE_CLUB_COOLDOWN_GAMEWEEKS,
  };
}
