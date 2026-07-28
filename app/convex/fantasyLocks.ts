/**
 * Weekend Fantasy — the per-fixture lock engine (FW-1 Phase 2).
 *
 * BUDGET_MODE_SPEC v1.0 §Deadlines & editing (per-fixture locks, LOCKED):
 *   "Each player locks individually at his fixture's kickoff. Until his lock:
 *    he can be swapped out, moved between XI/finisher, re-slotted, or
 *    repositioned — freely. After his lock: that slot is frozen (player, slot,
 *    position) and his cost is committed."
 *
 * ── The one rule this file exists to enforce ──
 *
 * A slot is mutable IFF its player's fixture kickoff is still in the future.
 * That test is evaluated at mutation time against fixture data, and is NEVER
 * read from the client, never trusted from a cached flag, and never inferred
 * from `lockedAt`.
 *
 * `lockedAt` and `committedPrice` are a RECORD of a lock, written by the
 * sweep. They are not the lock. A slot whose fixture kicked off thirty seconds
 * ago is locked even though no sweep has run — which is precisely what makes
 * the sweep safe to run late, or never, without opening an editing hole.
 *
 * An UNFILLED slot has no player, hence no fixture, hence never locks. It
 * stays editable and scores zero (BUDGET_MODE: "Unfilled slots at their last
 * possible lock simply score zero — no auto-fill in budget mode").
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

export const FIXTURE_MISSING_MESSAGE =
  "That player has no fixture in this gameweek, so he cannot be selected.";

type AnyCtx = QueryCtx | MutationCtx;

/**
 * The fixture a club plays in a gameweek, or null.
 *
 * Two indexed lookups (home, away) rather than a scan. A club plays at most
 * one fixture per gameweek by construction; if ingestion ever produces two,
 * the EARLIER kickoff wins, because that is the instant from which the
 * player's weekend is underway and the conservative choice always locks
 * sooner rather than later.
 */
export async function fixtureForClub(
  ctx: AnyCtx,
  gameweekId: Id<"fantasyGameweeks">,
  clubId: string,
): Promise<Doc<"fantasyFixtures"> | null> {
  const [home, away] = await Promise.all([
    ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_home", (q) =>
        q.eq("gameweekId", gameweekId).eq("homeClubId", clubId),
      )
      .collect(),
    ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_away", (q) =>
        q.eq("gameweekId", gameweekId).eq("awayClubId", clubId),
      )
      .collect(),
  ]);

  const all = [...home, ...away];
  if (all.length === 0) return null;
  return all.reduce((earliest, f) => (f.kickoffAt < earliest.kickoffAt ? f : earliest));
}

/**
 * Has this player's fixture kicked off? The authoritative lock predicate.
 *
 * A player with no fixture in the gameweek is NOT locked — he is unselectable,
 * which is a different failure and is reported separately by the mutations so
 * the user gets "he isn't playing this weekend" rather than "too late".
 */
export async function isPlayerLocked(
  ctx: AnyCtx,
  gameweekId: Id<"fantasyGameweeks">,
  player: Doc<"fantasyPlayers">,
  now: number,
): Promise<boolean> {
  const fixture = await fixtureForClub(ctx, gameweekId, player.clubId);
  if (fixture === null) return false;
  return fixture.kickoffAt <= now;
}

/**
 * The lock boundary, stated once: kickoff has PASSED when now >= kickoffAt.
 *
 * At exactly kickoffAt the slot is locked — an edit landing on the whistle
 * belongs to the match, not to the build. kickoff−1ms is still editable.
 */
export function kickoffHasPassed(kickoffAt: number, now: number): boolean {
  return now >= kickoffAt;
}

/** Resolve the lock state of every slot in a squad in one pass. */
export async function lockStateForSlots(
  ctx: AnyCtx,
  gameweekId: Id<"fantasyGameweeks">,
  slots: readonly Doc<"fantasySquadSlots">[],
  now: number,
): Promise<Map<number, boolean>> {
  const byIndex = new Map<number, boolean>();

  for (const slot of slots) {
    if (slot.playerId === undefined) {
      byIndex.set(slot.slotIndex, false);
      continue;
    }
    // A stamped lock is permanent: once committed the slot never reopens, even
    // if a fixture is later rescheduled to a future kickoff. Cheaper too — no
    // fixture read for slots the sweep has already settled.
    if (slot.lockedAt !== undefined) {
      byIndex.set(slot.slotIndex, true);
      continue;
    }
    const player = await ctx.db.get(slot.playerId);
    if (player === null) {
      byIndex.set(slot.slotIndex, false);
      continue;
    }
    byIndex.set(slot.slotIndex, await isPlayerLocked(ctx, gameweekId, player, now));
  }

  return byIndex;
}

/**
 * lockSweep — stamp `lockedAt` + `committedPrice` on slots whose fixture has
 * kicked off.
 *
 * IDEMPOTENT and LATE-SAFE by construction:
 *  - it only ever writes to slots with `lockedAt === undefined`, so a second
 *    run over the same data writes nothing;
 *  - it stamps `lockedAt` with the FIXTURE'S KICKOFF, not `Date.now()`, so a
 *    sweep that runs three hours late records the same instant a punctual one
 *    would. Re-running after an outage produces byte-identical rows.
 *  - it changes no editing decision. Editability is decided by live fixture
 *    data (see the module header), so a slot the sweep has not reached yet is
 *    already immutable.
 *
 * `committedPrice` freezes the cost of a locked slot for the budget invariant.
 * Prices are "static within a gameweek" (BUDGET_MODE §Squad construction), so
 * the value stamped late equals the value stamped on time. Crew squads carry
 * no budget, so their slots stamp `lockedAt` only.
 *
 * Unregistered in crons.ts by FW-1 ruling STOP-6 — scheduling is FW-2's, which
 * touches crons.ts anyway. Until then: `npx convex run fantasyLocks:lockSweep`.
 */
export const lockSweep = internalMutation({
  args: {
    gameweekId: v.optional(v.id("fantasyGameweeks")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { gameweekId, limit = 500 }) => {
    const now = Date.now();

    const gameweeks: Doc<"fantasyGameweeks">[] = [];
    if (gameweekId !== undefined) {
      const gw = await ctx.db.get(gameweekId);
      if (gw !== null) gameweeks.push(gw);
    } else {
      // A "final" gameweek is past its finality cut and can hold nothing
      // unlocked; "settling" can still be swept in case a sweep was missed.
      for (const status of ["upcoming", "live", "settling"] as const) {
        gameweeks.push(
          ...(await ctx.db
            .query("fantasyGameweeks")
            .withIndex("by_status", (q) => q.eq("status", status))
            .collect()),
        );
      }
    }

    let stamped = 0;
    let scanned = 0;

    for (const gameweek of gameweeks) {
      // Which clubs are already underway, and when each kicked off.
      const kickoffByClub = new Map<string, number>();
      const fixtures = await ctx.db
        .query("fantasyFixtures")
        .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
        .collect();

      for (const fixture of fixtures) {
        if (!kickoffHasPassed(fixture.kickoffAt, now)) continue;
        for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
          const seen = kickoffByClub.get(clubId);
          if (seen === undefined || fixture.kickoffAt < seen) {
            kickoffByClub.set(clubId, fixture.kickoffAt);
          }
        }
      }
      if (kickoffByClub.size === 0) continue;

      const squads = await ctx.db
        .query("fantasySquads")
        .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
        .collect();

      for (const squad of squads) {
        if (stamped >= limit) break;

        const slots = await ctx.db
          .query("fantasySquadSlots")
          .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
          .collect();

        for (const slot of slots) {
          if (stamped >= limit) break;
          scanned += 1;

          if (slot.lockedAt !== undefined) continue; // already stamped — idempotent
          if (slot.playerId === undefined) continue; // unfilled never locks

          const player = await ctx.db.get(slot.playerId);
          if (player === null) continue;

          const kickoffAt = kickoffByClub.get(player.clubId);
          if (kickoffAt === undefined) continue; // his fixture hasn't started

          await ctx.db.patch(slot._id, {
            lockedAt: kickoffAt,
            ...(squad.context === "budget" && player.price !== null
              ? { committedPrice: player.price }
              : {}),
          });
          stamped += 1;
        }
      }
    }

    return { stamped, scanned, gameweeks: gameweeks.length, now };
  },
});
