/**
 * Weekend Fantasy — favorite-club resolution under the 28-day cooldown.
 *
 * DRAFT_ROOM_SPEC v1.0.2 §Favorite-club exemption + ledger items 7 and 8:
 *   "each user logs ONE favorite club at profile level. The 3-per-club cap
 *    doesn't apply to it. Anti-gaming: favorite changes take effect 28 days
 *    after the change, and the favorite in force when the room arms is the
 *    one that counts — never changeable mid-draft. Exemption applies
 *    identically in budget mode."
 *
 * ── The cooldown is measured in TIME, not gameweeks (STOP-F) ──
 *
 * FW-1 implemented this as "gwNumber + 4" and stored a gameweek ordinal in
 * `users.favoriteClubEffectiveFrom`. The owner's STOP-F ruling, re-issued at
 * the FW-2-RUN closeout (2026-07-29), fixes it at **28 calendar days** held as
 * an epoch-millisecond timestamp.
 *
 * The two are not interchangeable, which is why this is a rewrite rather than a
 * renamed constant: once midweek gameweeks exist — and FW-2 bootstrapped a
 * season with 13 of them in 49 — four gameweeks can elapse in as little as
 * about two calendar weeks. A user could pick a congested stretch of the
 * fixture list and halve their own anti-gaming cooldown, which is exactly the
 * behaviour the rule exists to stop.
 *
 * Every function below therefore takes `now` (epoch ms) where it used to take
 * `gwNumber`. The parameter is passed in rather than read from the clock so the
 * module stays pure and every rule is a unit test.
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

import { FAVORITE_CLUB_COOLDOWN_MS } from "./fantasyConstants";

/** The favorite-club fields of a user doc, as plain data. */
export interface FavoriteClubState {
  readonly favoriteClub?: string | null;
  readonly favoriteClubPending?: string | null;
  /** Epoch ms the queued change becomes live. Was a gwNumber before v1.0.2. */
  readonly favoriteClubEffectiveFrom?: number | null;
}

/** A patch to apply to the user doc. `null` means "clear this field". */
export interface FavoriteClubPatch {
  favoriteClub?: string;
  favoriteClubPending?: string | undefined;
  favoriteClubEffectiveFrom?: number | undefined;
}

/**
 * Fold a queued change into the in-force club if it has come due at `now`.
 * This is the one place the cooldown comparison is written.
 *
 * Note the boundary: `now >= effectiveFrom`. A change made at instant t gets
 * effectiveFrom = t + 28 days, so it is inert for the whole 28 days and live
 * from the first millisecond of day 29 — "takes effect 28 days after the
 * change", exactly.
 */
function settle(
  state: FavoriteClubState,
  now: number,
): { inForce: string | null; pending: string | null; effectiveFrom: number | null } {
  const current = state.favoriteClub ?? null;
  const pending = state.favoriteClubPending ?? null;
  const effectiveFrom = state.favoriteClubEffectiveFrom ?? null;

  if (pending !== null && effectiveFrom !== null && now >= effectiveFrom) {
    return { inForce: pending, pending: null, effectiveFrom: null };
  }
  return { inForce: current, pending, effectiveFrom };
}

/**
 * The club whose players are exempt from the per-club cap for a squad built at
 * `now`. Returns null when the user has never set one.
 *
 * Callers must resolve this ONCE, at squad-build / room-arm time, and snapshot
 * it onto the squad (fantasySquads.favoriteClubAtBuild). Re-resolving it later
 * against a live user doc would let a favorite change alter an existing
 * squad's legality, which §Favorite-club exemption forbids.
 */
export function resolveFavoriteClub(
  state: FavoriteClubState,
  now: number,
): string | null {
  return settle(state, now).inForce;
}

/** Whether a queued change is still waiting at `now`. */
export function hasPendingFavoriteChange(
  state: FavoriteClubState,
  now: number,
): boolean {
  return settle(state, now).pending !== null;
}

/** The instant (epoch ms) a queued change becomes live, or null if none is queued. */
export function pendingFavoriteEffectiveFrom(
  state: FavoriteClubState,
  now: number,
): number | null {
  return settle(state, now).effectiveFrom;
}

/**
 * Build the user-doc patch for setting the favorite club to `nextClub` at
 * instant `now`.
 *
 * Four cases:
 *  - no club ever set        ⇒ immediate (S2)
 *  - set to the club already in force ⇒ cancels any queued change; the user is
 *    reverting, and making a revert wait 28 days would be perverse
 *  - a due change exists     ⇒ settled first, then the new change queued off it
 *  - otherwise               ⇒ queued for now + 28 days, old club stays (S1)
 */
export function planFavoriteClubChange(
  state: FavoriteClubState,
  now: number,
  nextClub: string,
): FavoriteClubPatch {
  const { inForce } = settle(state, now);

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
    favoriteClubEffectiveFrom: now + FAVORITE_CLUB_COOLDOWN_MS,
  };
}
