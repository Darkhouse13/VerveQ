/**
 * Weekend Fantasy — the player detail sheet's read surface (FW-SCOUT).
 *
 * One query, everything the sheet shows, all of it traceable to a table we
 * own: identity + pool provenance (fantasyPlayers, fantasyDraftPoolMeta),
 * this weekend's matchup (fantasyFixtures via the lock engine's
 * fixture-for-club rule), season lines (fantasyPlayerSeasonStats — the
 * FW-SCOUT L1 seed and L3 refresh), gameweek-wide ownership (our own squad
 * tables, both contexts), and VerveQ score history (fantasyPlayerScores,
 * derived with the ONE crowd-application rule, no new scoring logic).
 *
 * PRODUCT LAW (FW-SCOUT): stats, never a recommendation. Nothing here
 * returns a rating, rank, pick-score or composite — the pool meta's `proxy`
 * scalar is deliberately NOT exposed. "The crowd rates the players, not an
 * algorithm." And no invented facts: a stat we do not hold is null/absent,
 * never 0 (the FW-4 absence rule, schema L1888).
 *
 * Read-only and public (the fantasyMarket precedent: the card is identical
 * for every user; nothing user-specific is served). Lock semantics stay
 * with the lock engine — `kickoffAt` is raw and the client's clock only
 * greys, never enforces.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { findOpenGameweek } from "./fantasyDraftRooms";
import { fixtureForClub } from "./fantasyLocks";
import { applyCrowdFactor } from "./lib/fantasyScoring";

/**
 * Ownership honesty floor: below this many squads in the gameweek (both
 * contexts combined), "in N% of squads" is noise about a handful of people,
 * not a crowd fact — the sheet hides the line entirely (FW-SCOUT: hide
 * below a floor rather than show noise).
 */
const OWNERSHIP_FLOOR_SQUADS = 10;
/**
 * Live-computation guard: ownership is counted by walking the gameweek's
 * squads. Bounded today (tens of squads); above this many squads the walk
 * would make every sheet open expensive, so the count degrades to ABSENT —
 * visible, honest — rather than slow or sampled. At that scale ownership
 * belongs in a stamped rollup (the finalScore precedent); parked in
 * DECISIONS_NEEDED.md.
 */
const OWNERSHIP_MAX_SQUADS = 2_000;

/** clubId → display label via a bounded walk (getWeekendFixtures precedent):
 *  a few active players of the club, first labelled pool-meta row wins.
 *  Null when no labelled player exists — degraded loudly, never invented. */
async function clubLabel(ctx: QueryCtx, clubId: string): Promise<string | null> {
  const candidates = await ctx.db
    .query("fantasyPlayers")
    .withIndex("by_active_club", (q) => q.eq("active", true).eq("clubId", clubId))
    .take(6);
  for (const player of candidates) {
    const meta = await ctx.db
      .query("fantasyDraftPoolMeta")
      .withIndex("by_player", (q) => q.eq("playerId", player._id))
      .first();
    if (meta?.clubName !== undefined) return meta.clubName;
  }
  return null;
}

export const getPlayerCard = query({
  args: { playerId: v.id("fantasyPlayers") },
  handler: async (ctx, { playerId }) => {
    const player = await ctx.db.get(playerId);
    if (player === null) return null;

    const meta = await ctx.db
      .query("fantasyDraftPoolMeta")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .first();

    // ---- this weekend: the lock-relevant fixture for the player's club ----
    const gameweek = await findOpenGameweek(ctx);
    let weekend: {
      gameweekId: Id<"fantasyGameweeks">;
      gwNumber: number;
      kickoffAt: number;
      fixtureStatus: string;
      opponentName: string | null;
      isHome: boolean;
    } | null = null;
    if (gameweek !== null) {
      const fixture = await fixtureForClub(ctx, gameweek._id, player.clubId);
      if (fixture !== null) {
        const isHome = fixture.homeClubId === player.clubId;
        const opponentClubId = isHome ? fixture.awayClubId : fixture.homeClubId;
        weekend = {
          gameweekId: gameweek._id,
          gwNumber: gameweek.gwNumber,
          kickoffAt: fixture.kickoffAt,
          fixtureStatus: fixture.status,
          opponentName: await clubLabel(ctx, opponentClubId),
          isHome,
        };
      }
    }

    // ---- season lines (L1 seed + L3 refresh; raw totals, per-90 client-side) ----
    const seasonRows = await ctx.db
      .query("fantasyPlayerSeasonStats")
      .withIndex("by_player_season", (q) => q.eq("providerPlayerId", player.providerPlayerId))
      .collect();
    const seasons = seasonRows
      .sort((a, b) => (a.season < b.season ? 1 : -1))
      .map((row) => ({
        season: row.season,
        source: row.source,
        pulledAt: row.pulledAt,
        leagueLabel: row.leagueLabel,
        line: row.line,
        partial: row.partial ?? null,
      }));

    // ---- ownership: this gameweek's squads, both contexts ----
    let ownership: { totalSquads: number; inSquads: number | null } | null = null;
    if (gameweek !== null) {
      const squads = await ctx.db
        .query("fantasySquads")
        .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
        .collect();
      const total = squads.length;
      if (total < OWNERSHIP_FLOOR_SQUADS || total > OWNERSHIP_MAX_SQUADS) {
        // Below the floor: a percentage of a handful is noise — hidden.
        // Above the guard: counting would cost too much per open — absent.
        ownership = { totalSquads: total, inSquads: null };
      } else {
        let inSquads = 0;
        for (const squad of squads) {
          const slots = await ctx.db
            .query("fantasySquadSlots")
            .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
            .collect();
          if (slots.some((slot) => slot.playerId === playerId)) inSquads += 1;
        }
        ownership = { totalSquads: total, inSquads };
      }
    }

    // ---- VerveQ score history: current-version rows, grouped by gameweek ----
    // R5 derivation via the one exported rule; the player-centric cell is his
    // VERDICT position as starter — "as played", no fielded-slot mismatch.
    // A null verdict is a 0-minute line (schema L1936): the engine scored 0
    // before any template, so every grid cell agrees and starter.GK is fine.
    const scoreRows = await ctx.db
      .query("fantasyPlayerScores")
      .withIndex("by_player", (q) => q.eq("providerPlayerId", player.providerPlayerId))
      .collect();
    const current = scoreRows.filter((row) => row.supersededByVersion === undefined);
    const byGameweek = new Map<Id<"fantasyGameweeks">, typeof current>();
    for (const row of current) {
      const list = byGameweek.get(row.gameweekId) ?? [];
      list.push(row);
      byGameweek.set(row.gameweekId, list);
    }
    const history: {
      gameweekId: Id<"fantasyGameweeks">;
      season: string;
      gwNumber: number;
      points: number;
      state: "provisional" | "final";
      /** Null when the gameweek held more than one appearance (FW-EXPAND U1
       *  double windows) — the factor is per-appearance and a single number
       *  would misattribute; absent beats invented. */
      crowdFactor: number | null;
      appearances: number;
    }[] = [];
    for (const [gameweekId, rows] of byGameweek) {
      const gw = (await ctx.db.get(gameweekId)) as Doc<"fantasyGameweeks"> | null;
      if (gw === null) continue;
      let points = 0;
      let provisional = false;
      for (const row of rows) {
        const verdict = row.verdictPosition ?? "GK";
        points += applyCrowdFactor(row.baseScores.starter[verdict], row.crowdFactor);
        if (row.state === "provisional") provisional = true;
      }
      history.push({
        gameweekId,
        season: gw.season,
        gwNumber: gw.gwNumber,
        points,
        state: provisional ? "provisional" : "final",
        crowdFactor: rows.length === 1 ? rows[0].crowdFactor : null,
        appearances: rows.length,
      });
    }
    history.sort((a, b) => (a.season === b.season ? b.gwNumber - a.gwNumber : a.season < b.season ? 1 : -1));

    return {
      playerId: player._id,
      providerPlayerId: player.providerPlayerId,
      name: player.name,
      position: player.feedPosition,
      clubId: player.clubId,
      clubName: meta?.clubName ?? (await clubLabel(ctx, player.clubId)),
      leagueId: player.leagueId,
      price: player.price,
      active: player.active,
      /** Pool provenance for the honesty line ("priced from Eredivisie
       *  form" / "no season data — floor priced"). The meta's proxy scalar
       *  is NOT served — product law. */
      pool: meta?.pool ?? null,
      weekend,
      seasons,
      ownership,
      history,
    };
  },
});
