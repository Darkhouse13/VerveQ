/**
 * Weekend Fantasy — FW-3/FW-3R DEV simulation gates. NOT part of the product.
 *
 * `simulateDraft` runs a whole N-drafter draft against live DEV data through
 * the REAL write path, then replays its own draft log through
 * lib/fantasyDraftEngine.reconstructDraft and ASSERTS the reconstruction:
 * dense seq, seed regenerates the snake, the arm-time seat table, provider
 * ids, exclusivity, bank arithmetic, full pick count. It returns a normalized
 * digest of the log, so two runs with the same `salt` demonstrating identical
 * digests is the deterministic-replay gate on real data.
 *
 * ── What FW-3R item 9 changed ──
 *
 * The FW-3 sim inserted a room already in `drafting` and FABRICATED its auto
 * flags (`auto: seatIndex === snakeOrder[3 % drafters]`), so the gate proved
 * nothing about the arm gates, the timeout path, or the zero-bank chain —
 * precisely the machinery findings F2 and F3 concerned. It now:
 *
 *   • drives the real lobby: createCrewFor → joinCrewFor → createRoomFor →
 *     joinRoomFor → setSeatReadyFor → armDraftFor → runBeginDrafting →
 *     makePickFor → completion → runMaterializeRoomSquads. Every gate the
 *     product enforces (all-ready, creator-only, 2–8 seats, seat freeze,
 *     club cap, exclusivity, hindsight) is enforced on this run too.
 *   • never writes an `auto` flag. Every auto-pick in the log is one the
 *     ENGINE produced, via the timeout path or the R2 zero-bank chain.
 *   • offers mode "timeout", where the seat in snake position 0 stops acting
 *     at `silentFromRound`: its remaining bank drains to zero through
 *     `runTurnTimeout` (the real timeout path), and every later turn of that
 *     seat is auto-picked instantly inside another seat's mutation (the real
 *     R2 zero-bank chain). See `silentFromRound` for why it is not round 1.
 *
 * Two seams remain, both narrow and deliberate:
 *   1. Users are inserted directly — the sim has no sessions to authenticate,
 *      so it calls the `…For(ctx, userId, …)` cores the public mutations
 *      delegate to rather than the mutations themselves. The authorization
 *      wrappers are the only thing not exercised.
 *   2. Scheduled hops (beginDrafting, materializeRoomSquads) are driven
 *      inline, because a mutation cannot await its own scheduled jobs. The
 *      functions driven are exactly the ones the scheduler drives.
 *
 * ── Determinism, and why the digest is keyed on snake POSITION ──
 *
 * The sim arms for real, so the seed is a genuine
 * hashString(roomId:crewCode:now) and the snake order differs between runs.
 * That is the point: the arm path is under test. The draft is nonetheless
 * fully deterministic in SNAKE-POSITION space — every seat runs the same
 * best-available strategy, so the player taken at pick k, the clock it
 * spends, and the bank it leaves depend only on k and on the position of the
 * seat picking, never on which seat index happens to sit there. Keying the
 * digest on `snakeOrder.indexOf(seatIndex)` is therefore the exact
 * invariance the replay gate is claiming, with no seed-pinning fiction.
 *
 * Everything it creates is tagged (usernames `simdrafter_*`, crew name
 * `FW-3 SIM`); `purgeSimData` removes all of it, dropTestPurge-style.
 *
 * Run:  npx convex run fantasyDraftSim:simulateDraft '{"salt":"gate-1"}'
 *       npx convex run fantasyDraftSim:simulateDraft '{"salt":"gate-1","mode":"timeout"}'
 *       npx convex run fantasyDraftSim:purgeSimData
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { DRAFT_BANK_MS, SQUAD_SIZE } from "./lib/fantasyConstants";
import {
  hashString,
  reconstructDraft,
  seatIndexForPick,
  selectAutoPickWithRung,
  totalPicks,
} from "./lib/fantasyDraftEngine";
import {
  armDraftFor,
  clubCountsFor,
  createCrewFor,
  createRoomFor,
  joinCrewFor,
  joinRoomFor,
  loadPool,
  makePickFor,
  pickEntries,
  runBeginDrafting,
  runMaterializeRoomSquads,
  runTurnTimeout,
  setSeatReadyFor,
} from "./fantasyDraftRooms";

const SIM_CREW_NAME = "FW-3 SIM";

/**
 * Usernames must satisfy lib/usernames.USERNAME_RE (`^[a-z0-9_]{3,24}$`) —
 * the FW-3 sim's `sim-drafter-…` handles did not, and only passed because it
 * inserted crew rows directly. Driving the real lobby means passing the real
 * `assertUsernameRequiredUser`, which is exactly the kind of gate item 9
 * wanted exercised.
 */
const SIM_USERNAME_PREFIX = "simdrafter_";

function simUsername(salt: string, index: number): string {
  const tag = salt.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 10) || "gate";
  return `${SIM_USERNAME_PREFIX}${tag}_${index}`.slice(0, 24);
}

/** One virtual second per deliberate pick — deterministic, and far enough
 *  inside a 390s bank that a scripted seat never times out by accident. */
const SIM_PICK_ELAPSED_MS = 1_000;

export const simulateDraft = internalMutation({
  args: {
    drafters: v.optional(v.number()),
    salt: v.optional(v.string()),
    /**
     * "human": every pick is a deliberate makePickFor; no auto-picks at all.
     * "timeout": snake position 0 stops acting at `silentFromRound` — its
     * bank drains to zero through the real timeout path, and every later turn
     * of that seat is auto-picked instantly by the R2 zero-bank chain.
     */
    mode: v.optional(v.union(v.literal("human"), v.literal("timeout"))),
    /**
     * The round the silent seat stops acting in (timeout mode).
     *
     * Default 12 for a READ-BUDGET reason, not a rule one. The sim runs a
     * whole draft inside ONE transaction, and every auto-pick re-reads the
     * pool (~5.8k docs: players + pool meta + fixtures) exactly as it does in
     * production. Convex caps a single function execution at 32k document
     * reads, so a seat going silent at round 1 would want ~13 pool loads and
     * blow the cap. Production never approaches it: there, each pick is its
     * own mutation with one pool load. Lower this to widen the chain when
     * running against a small deployment.
     */
    silentFromRound: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { drafters = 4, salt = "gate", mode = "human", silentFromRound = 12 },
  ) => {
    if (drafters < 2 || drafters > 8) throw new Error("2–8 drafters.");
    if (silentFromRound < 1 || silentFromRound > SQUAD_SIZE) {
      throw new Error(`silentFromRound is 1–${SQUAD_SIZE}.`);
    }

    // The whole run shares one virtual clock. Convex freezes the wall clock
    // inside a transaction, so a 390s bank could not otherwise be drained in
    // one; every core function takes `now` as a parameter for exactly this.
    const t0 = Date.now();
    let clock = t0;

    // ── the cast (seam 1: no sessions, so users are inserted directly) ──
    const userIds: Id<"users">[] = [];
    for (let i = 0; i < drafters; i += 1) {
      userIds.push(await ctx.db.insert("users", { username: simUsername(salt, i) }));
    }

    // ── the real lobby ──
    const { crewId, code } = await createCrewFor(ctx, userIds[0], SIM_CREW_NAME);
    for (const userId of userIds.slice(1)) {
      await joinCrewFor(ctx, userId, code);
    }
    const { roomId } = await createRoomFor(ctx, userIds[0], crewId);
    for (const userId of userIds.slice(1)) {
      await joinRoomFor(ctx, userId, roomId);
    }
    for (const userId of userIds) {
      await setSeatReadyFor(ctx, userId, roomId, true);
    }

    const { seed, snakeOrder } = await armDraftFor(ctx, userIds[0], roomId, clock);
    if ((await ctx.db.get(roomId))!.status !== "order_reveal") {
      throw new Error("ASSERT: arm did not reach order_reveal.");
    }
    // Seam 2: the reveal hop, driven inline.
    await runBeginDrafting(ctx, roomId, clock);
    const drafting = (await ctx.db.get(roomId))!;
    if (drafting.status !== "drafting") throw new Error("ASSERT: reveal did not begin drafting.");
    const gameweekId = drafting.gameweekId;

    // Snake position is the digest's seat key — see the header note.
    const snakePosOf = new Map<number, number>();
    snakeOrder.forEach((seatIndex, position) => snakePosOf.set(seatIndex, position));
    const silentSeat = mode === "timeout" ? snakeOrder[0] : -1;

    const { pool, playersById } = await loadPool(ctx, gameweekId);
    const total = totalPicks(drafters);
    const rungsUsed: Record<number, number> = {};
    let timeoutsFired = 0;

    for (let guard = 0; guard <= total + 2; guard += 1) {
      const room = (await ctx.db.get(roomId))!;
      if (room.status === "completed") break;
      if (room.status !== "drafting") {
        throw new Error(`SIM STOP: room left drafting with status ${room.status}.`);
      }
      const pickIndex = room.currentPickIndex!;
      const seatIndex = seatIndexForPick(snakeOrder, pickIndex);
      const seat = room.seats[seatIndex];
      const round = Math.floor(pickIndex / drafters) + 1;

      // The silent seat stops acting at `silentFromRound`. That turn burns
      // its whole remaining bank through the real timeout path; every later
      // turn of the same seat is chained instantly by the applier inside
      // another seat's mutation, and never reaches this loop.
      if (seatIndex === silentSeat && round >= silentFromRound && seat.bankMs > 0) {
        clock = Math.max(clock, room.turnStartedAt ?? clock) + seat.bankMs + 1;
        await runTurnTimeout(ctx, room, pickIndex, clock);
        timeoutsFired += 1;
        continue;
      }

      const picks = await pickEntries(ctx, roomId);
      const picked = new Set(
        picks.map((p) => p.playerId as string).filter((id) => id !== undefined),
      );
      const choice = selectAutoPickWithRung(pool, {
        pickedPlayerIds: picked,
        clubCounts: clubCountsFor(seatIndex, picks, playersById),
        favoriteClub: seat.favoriteClubAtArm ?? null,
        now: clock,
      });
      if (choice === null) throw new Error("SIM STOP: pool exhausted.");
      rungsUsed[choice.rung] = (rungsUsed[choice.rung] ?? 0) + 1;

      clock += SIM_PICK_ELAPSED_MS;
      const result = await makePickFor(
        ctx,
        seat.userId,
        roomId,
        choice.player._id as Id<"fantasyPlayers">,
        clock,
      );
      if (result.auto) {
        throw new Error(`SIM STOP: deliberate pick ${pickIndex} was taken by the clock.`);
      }
    }

    // ── completion + the scheduled sheet handoff, driven inline (seam 2) ──
    const room = (await ctx.db.get(roomId))!;
    if (room.status !== "completed") throw new Error("ASSERT: room not completed.");
    if (room.sheetsMaterializedAt !== undefined) {
      throw new Error("ASSERT: sheets materialized inside the pick transaction (F3a regression).");
    }
    const handoff = await runMaterializeRoomSquads(ctx, roomId, clock);
    if (handoff.skipped !== null) throw new Error(`ASSERT: handoff skipped (${handoff.skipped}).`);
    if ((await ctx.db.get(roomId))!.sheetsMaterializedAt === undefined) {
      throw new Error("ASSERT: sheet handoff left no stamp.");
    }

    // ── the asserts ──
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
        seats: e.seats,
        pickNumber: e.pickNumber,
        round: e.round,
        seatIndex: e.seatIndex,
        playerId: e.playerId,
        providerPlayerId: e.providerPlayerId,
        auto: e.auto,
        elapsedMs: e.elapsedMs,
        bankAfterMs: e.bankAfterMs,
      })),
      DRAFT_BANK_MS,
    );
    if (!reconstruction.ok) {
      throw new Error(`ASSERT: log does not reconstruct: ${reconstruction.problems.join("; ")}`);
    }
    if (reconstruction.seats.length !== drafters) {
      throw new Error("ASSERT: seed entry does not carry the full seat table (item 5a).");
    }
    const pickRows = entries.filter((e) => e.entryType === "pick");
    if (pickRows.length !== total) {
      throw new Error(`ASSERT: log holds ${pickRows.length} picks, expected ${total}.`);
    }
    if (pickRows.some((e) => e.providerPlayerId === undefined)) {
      throw new Error("ASSERT: a pick row carries no providerPlayerId (item 5b).");
    }

    const autoRows = pickRows.filter((e) => e.auto === true);
    if (mode === "human" && autoRows.length !== 0) {
      throw new Error(`ASSERT: human mode produced ${autoRows.length} auto-picks.`);
    }
    if (mode === "timeout") {
      if (timeoutsFired !== 1) throw new Error(`ASSERT: ${timeoutsFired} timeouts, expected 1.`);

      // The silent seat acted deliberately for silentFromRound-1 rounds, then
      // timed out once, then chained every remaining round.
      const expectedChained = SQUAD_SIZE - silentFromRound;
      if (autoRows.length !== expectedChained + 1) {
        throw new Error(
          `ASSERT: ${autoRows.length} auto-picks, expected ${expectedChained + 1}.`,
        );
      }
      // The timeout pick spent the seat's whole REMAINING bank (not the full
      // 390s — it had been picking), and every chained pick after it spent
      // nothing at all (R2: "no grace").
      const bankAtTimeout = DRAFT_BANK_MS - (silentFromRound - 1) * SIM_PICK_ELAPSED_MS;
      const drainer = autoRows.filter((e) => e.elapsedMs === bankAtTimeout);
      const chained = autoRows.filter((e) => e.elapsedMs === 0);
      if (drainer.length !== 1 || chained.length !== expectedChained) {
        throw new Error(
          `ASSERT: expected 1 timeout (${bankAtTimeout}ms) + ${expectedChained} chained, got ` +
            `${drainer.length} + ${chained.length}.`,
        );
      }
      if (autoRows.some((e) => e.seatIndex !== silentSeat)) {
        throw new Error("ASSERT: an auto-pick landed on a seat that was picking for itself.");
      }
      if (autoRows.some((e) => (e.bankAfterMs ?? -1) !== 0)) {
        throw new Error("ASSERT: an auto-pick left bank on the clock.");
      }
      // The silent seat's own deliberate picks are still flagged human.
      const silentHuman = pickRows.filter(
        (e) => e.seatIndex === silentSeat && e.auto !== true,
      );
      if (silentHuman.length !== silentFromRound - 1) {
        throw new Error(
          `ASSERT: silent seat has ${silentHuman.length} deliberate picks, ` +
            `expected ${silentFromRound - 1}.`,
        );
      }
    }

    for (const userId of userIds) {
      const squad = await ctx.db
        .query("fantasySquads")
        .withIndex("by_user_gameweek_contextKey", (q) =>
          q.eq("userId", userId).eq("gameweekId", gameweekId).eq("contextKey", `crew:${roomId}`),
        )
        .first();
      if (squad === null) throw new Error("ASSERT: seat has no materialized squad.");
      if (squad.arrangedByUser !== false) {
        throw new Error("ASSERT: a freshly materialized sheet is not marked unarranged (item 6).");
      }
      const slots = await ctx.db
        .query("fantasySquadSlots")
        .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
        .collect();
      if (slots.length !== SQUAD_SIZE || slots.some((s) => s.playerId === undefined)) {
        throw new Error("ASSERT: materialized sheet is not 13 filled slots.");
      }
    }

    // Environment-independent digest: provider ids (never Convex ids), and
    // snake POSITION rather than seat index, which is the space the draft is
    // deterministic in once the arm is real. Clock facts are relative to the
    // arm instant so a different wall-clock start does not move the digest.
    const normalized = pickRows
      .map((e) =>
        [
          e.pickNumber,
          e.round,
          snakePosOf.get(e.seatIndex ?? -1) ?? "?",
          e.providerPlayerId ?? "?",
          e.auto ? 1 : 0,
          e.elapsedMs,
          e.bankAfterMs,
        ].join("|"),
      )
      .join("\n");

    return {
      mode,
      silentFromRound: mode === "timeout" ? silentFromRound : null,
      roomId,
      seed,
      snakeOrder,
      picks: pickRows.length,
      autoPicks: autoRows.length,
      timeoutsFired,
      rungsUsed,
      reconstruction: "ok",
      seatTableRows: reconstruction.seats.length,
      logDigest: hashString(normalized),
      /** Every engine-produced auto-pick, so the gate's own output shows the
       *  timeout and the chain rather than asking a reader to trust them. */
      autoExcerpt: autoRows.map(
        (e) =>
          `#${e.pickNumber} r${e.round} pos${snakePosOf.get(e.seatIndex ?? -1)} ${
            (e.playerId !== undefined && playersById.get(e.playerId)?.name) || "?"
          } [AUTO ${e.elapsedMs === 0 ? "chain" : "timeout"}] ${e.elapsedMs}ms bank=${
            e.bankAfterMs
          }`,
      ),
      logExcerpt: entries.slice(0, 6).map((e) =>
        e.entryType === "seed"
          ? `#0 seed=${e.seed} order=[${(e.snakeOrder ?? []).join(",")}] seats=${
              (e.seats ?? []).length
            }`
          : `#${e.pickNumber} r${e.round} pos${snakePosOf.get(e.seatIndex ?? -1)} ${
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
