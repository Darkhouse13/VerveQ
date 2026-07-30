/**
 * Weekend Fantasy — budget-mode market reads (O1, FW-LAUNCH).
 *
 * Two public read surfaces the budget build UI needs and FW-1 never shipped:
 * the open gameweek (the weekend at hand) and the priced player market.
 * Read-only; every write path stays in fantasySquads.ts under its full
 * validation chain.
 *
 * Spec: BUDGET_MODE_SPEC.md v1.1.1.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { findOpenGameweek } from "./fantasyDraftRooms";
import { fixtureForClub } from "./fantasyLocks";

/**
 * The gameweek a budget squad builds for: the open (upcoming or live)
 * gameweek with the earliest finality cut — the same rule draft rooms use
 * (fantasyDraftRooms.findOpenGameweek). Null when no board is open.
 */
export const getOpenGameweek = query({
  args: {},
  handler: async (ctx) => {
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return null;
    return {
      gameweekId: gameweek._id,
      season: gameweek.season,
      gwNumber: gameweek.gwNumber,
      status: gameweek.status,
      finalityAt: gameweek.finalityAt,
    };
  },
});

/**
 * The full player market for a gameweek: every active player, joined with
 * the pool meta's club label and the gameweek's earliest kickoff per club.
 *
 * Deliberately mirrors fantasyDraftRooms.loadPool (full collect + meta join)
 * rather than paginating: the pool is ~2.9k rows of small fields, identical
 * for every user within a gameweek, and the draft pool already ships this
 * way. Filtering (position/club/price) is client-side over one load.
 *
 * Unpriced players are INCLUDED with `price: null` — the build surface must
 * say "unavailable" rather than silently hide them (fail-closed pricing,
 * FW-1 STOP-4: an unpriced player is rejected from a budget squad).
 * Kickoff state is returned as `kickoffAt`, not a computed boolean, so the
 * client's clock decides what to grey out while the server keeps enforcing
 * the hindsight rule on every write.
 */
export const getMarket = query({
  args: {},
  handler: async (ctx) => {
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return null;

    const players = await ctx.db.query("fantasyPlayers").collect();
    const metaRows = await ctx.db.query("fantasyDraftPoolMeta").collect();
    const clubNameByPlayer = new Map<string, string>();
    for (const meta of metaRows) {
      if (meta.clubName !== undefined) {
        clubNameByPlayer.set(meta.playerId, meta.clubName);
      }
    }

    const fixtures = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
      .collect();
    const kickoffByClub = new Map<string, number>();
    for (const fixture of fixtures) {
      for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
        const seen = kickoffByClub.get(clubId);
        if (seen === undefined || fixture.kickoffAt < seen) {
          kickoffByClub.set(clubId, fixture.kickoffAt);
        }
      }
    }

    const market = players
      .filter((player: Doc<"fantasyPlayers">) => player.active)
      .map((player) => ({
        playerId: player._id,
        name: player.name,
        clubId: player.clubId,
        clubName: clubNameByPlayer.get(player._id) ?? null,
        /** Nominal feed position — a browsing hint, never a build constraint
         *  (all-positions-eligible; the mismatch rule prices the risk). */
        position: player.feedPosition,
        price: player.price,
        kickoffAt: kickoffByClub.get(player.clubId) ?? null,
      }));

    return {
      gameweekId: gameweek._id,
      season: gameweek.season,
      gwNumber: gameweek.gwNumber,
      finalityAt: gameweek.finalityAt,
      players: market,
    };
  },
});

/**
 * The open gameweek's fixture id for a club (earliest kickoff — the same
 * rule the lock engine uses). The court's file-a-claim flow resolves a
 * player's fixture through this; the filing mutation re-validates it.
 */
export const getFixtureForClub = query({
  args: { clubId: v.string() },
  handler: async (ctx, { clubId }) => {
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return null;
    const fixture = await fixtureForClub(ctx, gameweek._id, clubId);
    return fixture?._id ?? null;
  },
});
