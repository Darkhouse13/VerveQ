/**
 * One-off ops: undo the 2026-09-05 manual squad batch (ESPN + Transfermarkt)
 * that stood in for the API-Football transfer sweep while the account was
 * suspended, so the real sweep can be applied on top of the pre-batch state.
 *
 * What the batch wrote (see app/scripts/squad-batch-2026-09-05/README.md):
 *  - fantasyTransferEvents rows keyed `manual:2026-09-05:*` — these DATE 09-05
 *    and would make applyTransferChunk's out-of-order guard supersede every
 *    real transfer dated earlier, so they must go before the API sweep runs;
 *  - incoming_known: player rows moved to a new club (clubId/leagueId, active);
 *  - outgoing: player rows deactivated (active:false, departedAt);
 *  - incoming_new: 531 rows inserted with synthetic `tm:<id>` provider ids
 *    (+ a flagged fantasyDraftPoolMeta row each) — never scoreable;
 *  - fantasyPlayerAvailability rows for GW4 with rawType `tm:*`.
 *
 * Every step is idempotent: events are deleted as they are reverted, so a
 * re-run finds fewer of them. Run inspect → revertChunk (until 0) → finish.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const MANUAL_KEY_PREFIX = "manual:2026-09-05:";
const MANUAL_KEY_END = "manual:2026-09-05;"; // ':' + 1 — exclusive upper bound
const TM_PREFIX = "tm:";
const TM_END = "tm;";

export const inspect = internalQuery({
  args: { gameweekId: v.optional(v.id("fantasyGameweeks")) },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("fantasyTransferEvents")
      .withIndex("by_key", (q) =>
        q.gte("providerTransferKey", MANUAL_KEY_PREFIX).lt("providerTransferKey", MANUAL_KEY_END),
      )
      .collect();
    const byClass: Record<string, number> = {};
    for (const e of events) byClass[e.classification] = (byClass[e.classification] ?? 0) + 1;

    const tmPlayers = await ctx.db
      .query("fantasyPlayers")
      .withIndex("by_providerPlayerId", (q) =>
        q.gte("providerPlayerId", TM_PREFIX).lt("providerPlayerId", TM_END),
      )
      .collect();
    const referenced: { name: string; providerPlayerId: string; squadSlots: number }[] = [];
    for (const p of tmPlayers) {
      const slots = await ctx.db
        .query("fantasySquadSlots")
        .withIndex("by_player", (q) => q.eq("playerId", p._id))
        .collect();
      if (slots.length > 0) {
        referenced.push({ name: p.name, providerPlayerId: p.providerPlayerId, squadSlots: slots.length });
      }
    }
    const tmIds = new Set(tmPlayers.map((p) => p._id));
    const queues = await ctx.db.query("fantasyDraftQueues").collect();
    const queuedTm = queues.filter((q) => q.playerIds.some((id) => tmIds.has(id))).length;

    let availabilityTm = 0;
    if (args.gameweekId !== undefined) {
      const rows = await ctx.db
        .query("fantasyPlayerAvailability")
        .withIndex("by_gameweek", (q) => q.eq("gameweekId", args.gameweekId!))
        .collect();
      availabilityTm = rows.filter((r) => r.rawType.startsWith(TM_PREFIX)).length;
    }

    return {
      manualEvents: events.length,
      byClass,
      tmPlayers: tmPlayers.length,
      tmPlayersInSquadSlots: referenced,
      draftQueuesHoldingTm: queuedTm,
      availabilityTmRows: availabilityTm,
    };
  },
});

const clubValidator = v.object({ clubId: v.string(), leagueId: v.number(), name: v.string() });

export const revertChunk = internalMutation({
  args: {
    limit: v.number(),
    clubs: v.array(clubValidator),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { limit, clubs, dryRun }) => {
    const clubById = new Map(clubs.map((c) => [c.clubId, c]));
    const events = await ctx.db
      .query("fantasyTransferEvents")
      .withIndex("by_key", (q) =>
        q.gte("providerTransferKey", MANUAL_KEY_PREFIX).lt("providerTransferKey", MANUAL_KEY_END),
      )
      .take(limit);

    const counts = { movedBack: 0, reactivated: 0, deletedNew: 0, keptNewReferenced: 0, eventsDeleted: 0, skipped: 0 };
    const notes: string[] = [];
    const write = dryRun !== true;

    for (const event of events) {
      const player = await ctx.db
        .query("fantasyPlayers")
        .withIndex("by_providerPlayerId", (q) => q.eq("providerPlayerId", event.providerPlayerId))
        .first();

      switch (event.classification) {
        case "incoming_known": {
          const from = event.rawFromClubId === null ? undefined : clubById.get(event.rawFromClubId);
          if (player === null || from === undefined) {
            counts.skipped += 1;
            notes.push(`skip ${event.playerName} (${event.providerPlayerId}): ${player === null ? "no player row" : `unknown from-club ${event.rawFromClubId}`}`);
            continue;
          }
          if (write) {
            await ctx.db.patch(player._id, {
              clubId: from.clubId,
              leagueId: from.leagueId,
              active: true,
              departedAt: undefined,
            });
            const meta = await ctx.db
              .query("fantasyDraftPoolMeta")
              .withIndex("by_player", (q) => q.eq("playerId", player._id))
              .first();
            if (meta !== null && meta.clubName !== from.name) await ctx.db.patch(meta._id, { clubName: from.name });
          }
          counts.movedBack += 1;
          break;
        }
        case "outgoing": {
          if (player === null) {
            counts.skipped += 1;
            notes.push(`skip outgoing ${event.playerName} (${event.providerPlayerId}): no player row`);
            continue;
          }
          if (write && (!player.active || player.departedAt !== undefined)) {
            await ctx.db.patch(player._id, { active: true, departedAt: undefined });
          }
          counts.reactivated += 1;
          break;
        }
        case "incoming_new": {
          if (player === null) {
            // Already removed on an earlier pass; only the event remains.
            break;
          }
          if (!player.providerPlayerId.startsWith(TM_PREFIX)) {
            counts.skipped += 1;
            notes.push(`skip new ${event.playerName}: row ${player.providerPlayerId} is not synthetic`);
            continue;
          }
          const slots = await ctx.db
            .query("fantasySquadSlots")
            .withIndex("by_player", (q) => q.eq("playerId", player._id))
            .collect();
          if (slots.length > 0) {
            counts.keptNewReferenced += 1;
            notes.push(`KEPT ${player.name} (${player.providerPlayerId}) @ ${player.clubId}: in ${slots.length} squad slot(s)`);
            continue; // event kept too, so this player stays traceable
          }
          if (write) {
            const meta = await ctx.db
              .query("fantasyDraftPoolMeta")
              .withIndex("by_player", (q) => q.eq("playerId", player._id))
              .collect();
            for (const m of meta) await ctx.db.delete(m._id);
            const avail = await ctx.db
              .query("fantasyPlayerAvailability")
              .withIndex("by_player", (q) => q.eq("playerId", player._id))
              .collect();
            for (const a of avail) await ctx.db.delete(a._id);
            await ctx.db.delete(player._id);
          }
          counts.deletedNew += 1;
          break;
        }
        default: {
          counts.skipped += 1;
          notes.push(`skip ${event.classification} ${event.playerName}`);
          continue;
        }
      }
      if (write) await ctx.db.delete(event._id);
      counts.eventsDeleted += 1;
    }
    return { examined: events.length, counts, notes, dryRun: !write };
  },
});

export const finish = internalMutation({
  args: {
    sweepId: v.id("fantasyTransferSweeps"),
    gameweekId: v.id("fantasyGameweeks"),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { sweepId, gameweekId, dryRun }) => {
    const write = dryRun !== true;
    const sweep = await ctx.db.get(sweepId);
    if (sweep === null) throw new Error("sweep row not found");
    if (write && sweep.status !== "failed") {
      await ctx.db.patch(sweepId, {
        status: "failed",
        error:
          "reverted 2026-09-07: manual ESPN/Transfermarkt batch undone once API-Football was reinstated (opsManualBatchRevert)",
      });
    }
    const rows = await ctx.db
      .query("fantasyPlayerAvailability")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweekId))
      .collect();
    let cleared = 0;
    for (const r of rows) {
      if (!r.rawType.startsWith(TM_PREFIX)) continue;
      if (write) await ctx.db.delete(r._id);
      cleared += 1;
    }
    return { sweepWasStatus: sweep.status, availabilityCleared: cleared, dryRun: !write };
  },
});

/** Synthetic `tm:` players still present (after a revert kept the referenced ones). */
export const listTmPlayers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("fantasyPlayers")
      .withIndex("by_providerPlayerId", (q) =>
        q.gte("providerPlayerId", TM_PREFIX).lt("providerPlayerId", TM_END),
      )
      .collect();
    return rows.map((p) => ({ id: p._id as Id<"fantasyPlayers">, name: p.name, clubId: p.clubId, leagueId: p.leagueId, position: p.feedPosition, active: p.active }));
  },
});

/**
 * 2026-09-07 aftermath: a sync run under the reverted (pre-bfae951) constitution
 * re-created thin midweek gameweek rows. The ones holding fixtures fold back via
 * fantasyIngest:absorbThinMidweekGameweeks; rows the sync created OUTSIDE its
 * write window hold nothing and that migration refuses them — this deletes
 * exactly those, and only when they are provably empty and unbound.
 */
export const deleteEmptyGameweeks = internalMutation({
  args: { gameweekIds: v.array(v.id("fantasyGameweeks")), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { gameweekIds, dryRun }) => {
    const out: { id: string; gwNumber: number; action: string }[] = [];
    for (const id of gameweekIds) {
      const gw = await ctx.db.get(id);
      if (gw === null) { out.push({ id, gwNumber: 0, action: "missing" }); continue; }
      const fixture = await ctx.db.query("fantasyFixtures").withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", id)).first();
      const squad = await ctx.db.query("fantasySquads").withIndex("by_gameweek", (q) => q.eq("gameweekId", id)).first();
      const scoring = await ctx.db.query("fantasyGameweekScoring").withIndex("by_gameweek", (q) => q.eq("gameweekId", id)).first();
      const reason = fixture !== null ? "holds fixtures" : squad !== null ? "has squads" : scoring !== null ? "has a scoring row" : gw.status !== "upcoming" ? `status ${gw.status}` : null;
      if (reason !== null) { out.push({ id, gwNumber: gw.gwNumber, action: `REFUSED: ${reason}` }); continue; }
      if (dryRun !== true) await ctx.db.delete(id);
      out.push({ id, gwNumber: gw.gwNumber, action: dryRun === true ? "would delete" : "deleted" });
    }
    return out;
  },
});

/**
 * 2026-09-07: GW3 settled with 69 of 82 fixtures unscored (provider account
 * suspended). After the catch-up scoring pass (scoreDueFixtures with
 * rescoreGameweekId) wrote provisional rows past the cut, this hands the
 * gameweek back to the settlement cron: state final → provisional, status →
 * settling. The cron then re-runs finalize/stamp/percentiles, all idempotent.
 */
export const reopenGameweekSettlement = internalMutation({
  args: { gameweekId: v.id("fantasyGameweeks"), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { gameweekId, dryRun }) => {
    const gw = await ctx.db.get(gameweekId);
    if (gw === null) throw new Error("gameweek not found");
    const scoring = await ctx.db
      .query("fantasyGameweekScoring")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweekId))
      .first();
    if (scoring === null) throw new Error("no scoring row — nothing settled here");
    const provisionalRows = await ctx.db
      .query("fantasyPlayerScores")
      .withIndex("by_gameweek_state", (q) => q.eq("gameweekId", gameweekId).eq("state", "provisional"))
      .collect();
    const pending = provisionalRows.filter((r) => r.supersededByVersion === undefined).length;
    if (dryRun !== true) {
      await ctx.db.patch(scoring._id, { state: "provisional", finalizedAt: undefined });
      if (gw.status === "final") await ctx.db.patch(gameweekId, { status: "settling" });
    }
    return { gwNumber: gw.gwNumber, wasState: scoring.state, wasStatus: gw.status, provisionalRowsPending: pending, dryRun: dryRun === true };
  },
});
