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
    // Earliest fixture per club — the lock-relevant one when a window holds
    // two (FW-EXPAND U1) — with the matchup facts the fixture row already
    // carries: who the opponent is, and which side is home.
    const matchupByClub = new Map<
      string,
      { kickoffAt: number; opponentClubId: string; isHome: boolean }
    >();
    for (const fixture of fixtures) {
      for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
        const isHome = clubId === fixture.homeClubId;
        const seen = matchupByClub.get(clubId);
        if (seen === undefined || fixture.kickoffAt < seen.kickoffAt) {
          matchupByClub.set(clubId, {
            kickoffAt: fixture.kickoffAt,
            opponentClubId: isHome ? fixture.awayClubId : fixture.homeClubId,
            isHome,
          });
        }
      }
    }

    // clubId → display name, inverted from the per-player pool meta (the one
    // denormalized club label in the schema — there is deliberately no clubs
    // table). Any club with at least one labelled player resolves.
    const clubNameById = new Map<string, string>();
    for (const player of players) {
      if (clubNameById.has(player.clubId)) continue;
      const label = clubNameByPlayer.get(player._id);
      if (label !== undefined) clubNameById.set(player.clubId, label);
    }

    const market = players
      .filter((player: Doc<"fantasyPlayers">) => player.active)
      .map((player) => {
        const matchup = matchupByClub.get(player.clubId);
        return {
          playerId: player._id,
          name: player.name,
          clubId: player.clubId,
          leagueId: player.leagueId,
          clubName: clubNameByPlayer.get(player._id) ?? null,
          /** Nominal feed position — a browsing hint, never a build constraint
           *  (all-positions-eligible; the mismatch rule prices the risk). */
          position: player.feedPosition,
          price: player.price,
          kickoffAt: matchup?.kickoffAt ?? null,
          /** U1 matchup line: the earliest fixture's opponent and venue.
           *  Null exactly when kickoffAt is null (the NO FIXTURE case). */
          opponentName:
            matchup === undefined
              ? null
              : (clubNameById.get(matchup.opponentClubId) ?? null),
          isHome: matchup?.isHome ?? null,
        };
      });

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
 * Which leagues actually play in the open gameweek — presentation data for
 * D4 (FW-POLISH): partial gameweeks are the NORMAL state early in the
 * season, and the surfaces must say "this weekend: Ligue 1 + Premier League"
 * rather than looking broken. Derived from the fixture rows, never from a
 * hardcoded schedule; a fixture that will not be played (postponed/cancelled)
 * does not make its league "playing". Read-only, additive.
 */
export const getWeekendLeagues = query({
  args: {},
  handler: async (ctx) => {
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return null;
    const fixtures = await ctx.db
      .query("fantasyFixtures")
      .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
      .collect();
    const fixturesByLeague = new Map<number, number>();
    for (const fixture of fixtures) {
      if (fixture.status === "postponed" || fixture.status === "cancelled") continue;
      fixturesByLeague.set(fixture.leagueId, (fixturesByLeague.get(fixture.leagueId) ?? 0) + 1);
    }
    return {
      gameweekId: gameweek._id,
      gwNumber: gameweek.gwNumber,
      leagues: [...fixturesByLeague.entries()]
        .map(([leagueId, fixtureCount]) => ({ leagueId, fixtureCount }))
        .sort((a, b) => b.fixtureCount - a.fixtureCount || a.leagueId - b.leagueId),
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
