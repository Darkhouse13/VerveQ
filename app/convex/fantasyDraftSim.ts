/**
 * Weekend Fantasy — FW-3 DEV simulation gates. NOT part of the product.
 *
 * `simulateDraft` runs a whole N-drafter draft through the REAL engine write
 * path (fantasyDraftRooms.applyPickAndAdvance — the same function every human
 * pick and every timeout goes through) against the live DEV data, then
 * replays its own draft log through lib/fantasyDraftEngine.reconstructDraft
 * and ASSERTS the reconstruction: dense seq, seed regenerates the snake,
 * exclusivity, bank arithmetic, full pick count. It returns a normalized
 * digest of the log, so two runs with the same `salt` demonstrating identical
 * digests is the deterministic-replay gate on real data.
 *
 * Ticket gates covered: "a scripted 4-drafter simulated draft runs end-to-end
 * on DEV and its draft log reconstructs the full draft (assert)" and
 * "deterministic replay: same seed + same pick inputs → identical log".
 *
 * Everything it creates is tagged (usernames `sim-drafter-*`, crew name
 * `FW-3 SIM`); `purgeSimData` removes all of it, dropTestPurge-style.
 *
 * Run:  npx convex run fantasyDraftSim:simulateDraft '{"salt":"gate-1"}'
 *       npx convex run fantasyDraftSim:purgeSimData
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  DRAFT_BANK_MS,
  SQUAD_SIZE,
} from "./lib/fantasyConstants";
import {
  hashString,
  reconstructDraft,
  seatIndexForPick,
  selectAutoPick,
  snakeOrderFor,
  totalPicks,
} from "./lib/fantasyDraftEngine";
import {
  applyPickAndAdvance,
  clubCountsFor,
  loadPool,
  pickEntries,
} from "./fantasyDraftRooms";

const SIM_CREW_NAME = "FW-3 SIM";
const SIM_USERNAME_PREFIX = "sim-drafter-";

export const simulateDraft = internalMutation({
  args: {
    drafters: v.optional(v.number()),
    salt: v.optional(v.string()),
  },
  handler: async (ctx, { drafters = 4, salt = "gate" }) => {
    if (drafters < 2 || drafters > 8) throw new Error("2–8 drafters.");
    const now = Date.now();

    // The target gameweek: earliest open one, as createRoom does.
    const gameweeks: Doc<"fantasyGameweeks">[] = [];
    for (const status of ["upcoming", "live"] as const) {
      gameweeks.push(
        ...(await ctx.db
          .query("fantasyGameweeks")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()),
      );
    }
    if (gameweeks.length === 0) throw new Error("No open gameweek on this deployment.");
    const gameweek = gameweeks.reduce((a, b) => (b.finalityAt < a.finalityAt ? b : a));

    // Throwaway cast: users, crew, membership, room — direct inserts standing
    // in for the auth'd lobby mutations, which is the one place the sim
    // bypasses the product path (it has no sessions to authenticate).
    const userIds: Id<"users">[] = [];
    for (let i = 0; i < drafters; i += 1) {
      userIds.push(
        await ctx.db.insert("users", { username: `${SIM_USERNAME_PREFIX}${salt}-${i}` }),
      );
    }
    const crewId = await ctx.db.insert("fantasyCrews", {
      code: `SIM${hashString(salt).slice(0, 3).toUpperCase()}`,
      name: SIM_CREW_NAME,
      createdBy: userIds[0],
      createdAt: now,
    });
    for (const userId of userIds) {
      await ctx.db.insert("fantasyCrewMembers", {
        crewId,
        userId,
        nameSnapshot: String(userId),
        active: true,
        joinedAt: now,
      });
    }
    const roomId = await ctx.db.insert("fantasyDraftRooms", {
      crewId,
      gameweekId: gameweek._id,
      status: "drafting",
      createdBy: userIds[0],
      createdAt: now,
      seats: userIds.map((userId, i) => ({
        userId,
        nameSnapshot: `sim-${i}`,
        ready: true,
        joinedAt: now,
        favoriteClubAtArm: null,
        bankMs: DRAFT_BANK_MS,
      })),
      expiresAt: now,
      seed: undefined,
      snakeOrder: undefined,
      draftStartedAt: now,
      currentPickIndex: 0,
      turnStartedAt: now,
    });

    // Arm facts — seeded from `salt`, NOT the clock, so a same-salt rerun is
    // the same draft (the deterministic-replay gate needs a repeatable seed).
    const seed = hashString(`fw3-sim:${salt}:${drafters}`);
    const snakeOrder = snakeOrderFor(drafters, seed);
    await ctx.db.patch(roomId, { seed, snakeOrder });
    await ctx.db.insert("fantasyDraftLog", {
      roomId,
      seq: 0,
      entryType: "seed",
      at: now,
      seed,
      snakeOrder,
    });

    // Script: every seat drafts best-available under the R1 order (elapsed a
    // deterministic 1s per pick), except seat order position 3's picks, which
    // run as auto-picks — so the log carries both kinds. All through the real
    // applier; scheduled timeouts it emits die on their idempotency guards.
    const { pool, playersById } = await loadPool(ctx, gameweek._id);
    const total = totalPicks(drafters);
    for (let pickIndex = 0; pickIndex < total; pickIndex += 1) {
      const room = (await ctx.db.get(roomId))!;
      if (room.status !== "drafting") {
        throw new Error(`SIM STOP: room left drafting at pick ${pickIndex}.`);
      }
      if (room.currentPickIndex !== pickIndex) {
        throw new Error(
          `SIM STOP: cursor ${room.currentPickIndex} != expected ${pickIndex}.`,
        );
      }
      const seatIndex = seatIndexForPick(snakeOrder, pickIndex);
      const picks = await pickEntries(ctx, roomId);
      const picked = new Set(
        picks.map((p) => p.playerId as string).filter((id) => id !== undefined),
      );
      const choice = selectAutoPick(pool, {
        pickedPlayerIds: picked,
        clubCounts: clubCountsFor(seatIndex, picks, playersById),
        favoriteClub: null,
        now,
      });
      if (choice === null) throw new Error("SIM STOP: pool exhausted.");
      await applyPickAndAdvance(
        ctx,
        (await ctx.db.get(roomId))!,
        {
          seatIndex,
          playerId: choice._id as Id<"fantasyPlayers">,
          auto: seatIndex === snakeOrder[3 % drafters],
          elapsedMs: 1_000,
        },
        now,
      );
    }

    // ── the asserts ──
    const room = (await ctx.db.get(roomId))!;
    if (room.status !== "completed") throw new Error("ASSERT: room not completed.");

    const entries = await ctx.db
      .query("fantasyDraftLog")
      .withIndex("by_room_seq", (q) => q.eq("roomId", roomId))
      .collect();
    const reconstruction = reconstructDraft(
      entries.map((e) => ({
        seq: e.seq,
        entryType: e.entryType,
        seed: e.seed,
        snakeOrder: e.snakeOrder,
        pickNumber: e.pickNumber,
        round: e.round,
        seatIndex: e.seatIndex,
        playerId: e.playerId,
        auto: e.auto,
        elapsedMs: e.elapsedMs,
        bankAfterMs: e.bankAfterMs,
      })),
      DRAFT_BANK_MS,
    );
    if (!reconstruction.ok) {
      throw new Error(`ASSERT: log does not reconstruct: ${reconstruction.problems.join("; ")}`);
    }
    const pickCount = entries.filter((e) => e.entryType === "pick").length;
    if (pickCount !== total) {
      throw new Error(`ASSERT: log holds ${pickCount} picks, expected ${total}.`);
    }
    for (const userId of userIds) {
      const squad = await ctx.db
        .query("fantasySquads")
        .withIndex("by_user_gameweek_contextKey", (q) =>
          q.eq("userId", userId).eq("gameweekId", gameweek._id).eq("contextKey", `crew:${roomId}`),
        )
        .first();
      if (squad === null) throw new Error("ASSERT: seat has no materialized squad.");
      const slots = await ctx.db
        .query("fantasySquadSlots")
        .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
        .collect();
      if (slots.length !== SQUAD_SIZE || slots.some((s) => s.playerId === undefined)) {
        throw new Error("ASSERT: materialized sheet is not 13 filled slots.");
      }
    }

    // Environment-independent digest: provider ids, not convex ids.
    const normalized = entries
      .filter((e) => e.entryType === "pick")
      .map((e) => {
        const player = e.playerId === undefined ? null : playersById.get(e.playerId);
        return [
          e.pickNumber,
          e.round,
          e.seatIndex,
          player?.providerPlayerId ?? "?",
          e.auto ? 1 : 0,
          e.elapsedMs,
          e.bankAfterMs,
        ].join("|");
      })
      .join("\n");

    return {
      roomId,
      seed,
      snakeOrder,
      picks: pickCount,
      autoPicks: entries.filter((e) => e.entryType === "pick" && e.auto === true).length,
      reconstruction: "ok",
      logDigest: hashString(normalized),
      logExcerpt: entries.slice(0, 6).map((e) =>
        e.entryType === "seed"
          ? `#0 seed=${e.seed} order=[${(e.snakeOrder ?? []).join(",")}]`
          : `#${e.pickNumber} r${e.round} seat${e.seatIndex} ${
              (e.playerId !== undefined && playersById.get(e.playerId)?.name) || "?"
            }${e.auto ? " [AUTO]" : ""} ${e.elapsedMs}ms bank=${e.bankAfterMs}`,
      ),
    };
  },
});

/** What would a room created now draft for? Diagnostics for the sim gate:
 *  the target gameweek, its fixture count, and the best-priced players whose
 *  clubs actually play in it (the R5-eligible top of the R1 order). */
export const inspectTargetGameweek = internalQuery({
  args: {},
  handler: async (ctx) => {
    const gameweeks: Doc<"fantasyGameweeks">[] = [];
    for (const status of ["upcoming", "live"] as const) {
      gameweeks.push(
        ...(await ctx.db
          .query("fantasyGameweeks")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()),
      );
    }
    if (gameweeks.length === 0) return null;
    const gameweek = gameweeks.reduce((a, b) => (b.finalityAt < a.finalityAt ? b : a));
    const { pool } = await loadPool(ctx, gameweek._id);
    const playable = pool.filter((p) => p.hasFixture).sort((a, b) => (b.price ?? 4) - (a.price ?? 4));
    const players = await ctx.db.query("fantasyPlayers").collect();
    const nameById = new Map(players.map((p) => [p._id as string, p.name]));
    return {
      gwNumber: gameweek.gwNumber,
      leagueIds: gameweek.leagueIds,
      finalityAt: gameweek.finalityAt,
      fixturedClubs: new Set(playable.map((p) => p.clubId)).size,
      playablePlayers: playable.length,
      topPlayable: playable.slice(0, 5).map((p) => `${nameById.get(p._id)} ${p.price}`),
    };
  },
});

export const purgeSimData = internalMutation({
  args: {},
  handler: async (ctx) => {
    let deleted = 0;
    const crews = await ctx.db.query("fantasyCrews").collect();
    for (const crew of crews) {
      if (crew.name !== SIM_CREW_NAME) continue;
      const rooms = await ctx.db
        .query("fantasyDraftRooms")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .collect();
      for (const room of rooms) {
        const entries = await ctx.db
          .query("fantasyDraftLog")
          .withIndex("by_room_seq", (q) => q.eq("roomId", room._id))
          .collect();
        for (const entry of entries) {
          await ctx.db.delete(entry._id);
          deleted += 1;
        }
        const squads = await ctx.db
          .query("fantasySquads")
          .withIndex("by_gameweek", (q) => q.eq("gameweekId", room.gameweekId))
          .collect();
        for (const squad of squads) {
          if (squad.crewRoomId !== room._id) continue;
          const slots = await ctx.db
            .query("fantasySquadSlots")
            .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
            .collect();
          for (const slot of slots) {
            await ctx.db.delete(slot._id);
            deleted += 1;
          }
          await ctx.db.delete(squad._id);
          deleted += 1;
        }
        await ctx.db.delete(room._id);
        deleted += 1;
      }
      const members = await ctx.db
        .query("fantasyCrewMembers")
        .withIndex("by_crew", (q) => q.eq("crewId", crew._id))
        .collect();
      for (const member of members) {
        const user = await ctx.db.get(member.userId);
        if (user !== null && String(user.username ?? "").startsWith(SIM_USERNAME_PREFIX)) {
          await ctx.db.delete(member.userId);
          deleted += 1;
        }
        await ctx.db.delete(member._id);
        deleted += 1;
      }
      await ctx.db.delete(crew._id);
      deleted += 1;
    }
    return { deleted };
  },
});
