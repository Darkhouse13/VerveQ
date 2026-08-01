/**
 * Weekend Fantasy — the budget-mode DEV walkthrough (FW-LAUNCH O1, extended
 * by FW-VS1).
 *
 * The O1 DONE gate, as one scripted run against live DEV data through the
 * REAL write path: create → fill 13 → arrange → over-budget and over-cap
 * variants rejected server-side → purge clean.
 *
 * FW-VS1 adds the exact-boundary phase, against a SYNTHETIC world built and
 * purged INSIDE this one transaction (so nothing synthetic is ever visible
 * outside it, whatever `keepData` says):
 *   · a 13 summing exactly 91.0 accepted; the 91.5 variant refused with both
 *     boundary numbers in the server's own message;
 *   · the favorite-club exemption in its POSITIVE direction — a 4th same-club
 *     player accepted with the favorite set (first-ever set: immediate, S2) —
 *     plus the 4th-from-a-non-favorite negative control;
 *   · a kicked-off fixture: the locked slot refuses `setFormation`, and the
 *     kicked-off player refuses to be swapped IN;
 *   · `createSquad`'s F1 argument gate (`context: "crew"`) refused, via the
 *     same exported guard the public wrapper calls first (the auth wrapper
 *     itself is the sim's one standing seam — it has no sessions).
 *
 * Same posture as fantasyDraftSim.ts: internal-only, unreachable from any
 * client, and it drives the shipped cores (`createBudgetSquadFor`,
 * `setSlotFor`, `setFormationFor`) that the public mutations delegate to.
 * Every rule the product enforces (budget, club cap, hindsight, formation,
 * unpriced fail-closed) is enforced on this run too: nothing here is asserted
 * from a reimplementation, every PASS is the server's own acceptance and
 * every REJECTED is the server's own throw.
 *
 * Data contract (FW-VS1, uniform across the fantasy sims): the run KEEPS its
 * live-market rows (user + squad) so a verifier can inspect them —
 * `keepData` is accepted for CLI uniformity and this sim always behaves as
 * `keepData: true`. The named purge is `fantasyBudgetSim:purgeSimBudgetData`,
 * idempotent: run it twice, the second run reports zero deletions.
 *
 * Everything it creates is tagged (username `simbudget_*`) and
 * `purgeSimBudgetData` removes exactly that, dropTestPurge-style: by id,
 * re-validated, never by pattern-delete.
 *
 * Run:  npx convex run fantasyBudgetSim:simulateBudgetBuild '{"salt":"o1"}'
 *       npx convex run fantasyBudgetSim:purgeSimBudgetData
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { PER_CLUB_CAP, SQUAD_BUDGET, SQUAD_SIZE } from "./lib/fantasyConstants";
import {
  assertPublicSquadCreateArgs,
  createBudgetSquadFor,
  setFormationFor,
  setSlotFor,
  CREW_SQUAD_DRAFT_ONLY,
  PLAYER_ALREADY_STARTED,
  SLOT_LOCKED,
} from "./fantasySquads";
import { planFavoriteClubChange } from "./lib/fantasyFavoriteClub";
import { findOpenGameweek } from "./fantasyDraftRooms";
import { kickoffHasPassed } from "./fantasyLocks";

const SIM_USERNAME_PREFIX = "simbudget_";

// ── the FW-VS1 boundary world (synthetic, transaction-local) ──

const BOUNDARY_SEASON = "SYNTH-O1-BOUNDARY";
const BOUNDARY_GW = 906;
const BOUNDARY_LEAGUE = 0;
/** Six clubs across three future fixtures, so a cap-legal 13 exists without
 *  touching the favorite exemption. */
const BOUNDARY_CLUBS = ["SYNTH-O1A", "SYNTH-O1B", "SYNTH-O1C", "SYNTH-O1D", "SYNTH-O1E", "SYNTH-O1F"] as const;

function simUsername(salt: string): string {
  const tag = salt.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 12) || "o1";
  return `${SIM_USERNAME_PREFIX}${tag}`.slice(0, 24);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`WALKTHROUGH FAILED: ${message}`);
}

/** Run `fn` expecting the server to throw; return the message it threw. */
async function expectRejection(
  fn: () => Promise<unknown>,
  mustContain: string,
  label: string,
): Promise<string> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.includes(mustContain),
      `${label}: rejected, but for the wrong reason — "${message}" (wanted "${mustContain}")`,
    );
    return message;
  }
  throw new Error(`WALKTHROUGH FAILED: ${label}: the server ACCEPTED an illegal edit.`);
}

interface SimPlayer {
  id: Id<"fantasyPlayers">;
  clubId: string;
  price: number;
}

/** Active, priced, with a fixture still to kick off — the only players a
 *  budget squad can legally take right now, per the shipped rules. */
async function selectablePlayers(
  ctx: MutationCtx,
  gameweekId: Id<"fantasyGameweeks">,
  now: number,
): Promise<{ selectable: SimPlayer[]; unpricedWithFixture: Doc<"fantasyPlayers"> | null }> {
  const fixtures = await ctx.db
    .query("fantasyFixtures")
    .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweekId))
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

  const players = await ctx.db.query("fantasyPlayers").collect();
  const selectable: SimPlayer[] = [];
  let unpricedWithFixture: Doc<"fantasyPlayers"> | null = null;
  for (const player of players) {
    if (!player.active) continue;
    const kickoff = kickoffByClub.get(player.clubId);
    if (kickoff === undefined || kickoffHasPassed(kickoff, now)) continue;
    if (player.price === null) {
      // A candidate for the fail-closed unpriced check, not for selection.
      unpricedWithFixture ??= player;
      continue;
    }
    selectable.push({ id: player._id, clubId: player.clubId, price: player.price });
  }
  // Deterministic order: price desc, then id — no randomness in the run.
  selectable.sort((a, b) => b.price - a.price || (a.id < b.id ? -1 : 1));
  return { selectable, unpricedWithFixture };
}

/** Greedy fill under the shipped constraints: walk `ordered`, take a player
 *  when the running total stays on budget and his club stays under cap.
 *  Every acceptance goes through the REAL setSlotFor. */
async function fillSlots(
  ctx: MutationCtx,
  userId: Id<"users">,
  squadId: Id<"fantasySquads">,
  ordered: SimPlayer[],
  slotIndices: number[],
): Promise<{ filled: number; spent: number; used: Set<string> }> {
  const clubCounts = new Map<string, number>();
  const used = new Set<string>();
  let spent = 0;
  let filled = 0;
  for (const slotIndex of slotIndices) {
    const candidate = ordered.find(
      (p) =>
        !used.has(p.id) &&
        spent + p.price <= SQUAD_BUDGET &&
        (clubCounts.get(p.clubId) ?? 0) < PER_CLUB_CAP,
    );
    if (candidate === undefined) break;
    await setSlotFor(ctx, userId, { squadId, slotIndex, playerId: candidate.id });
    used.add(candidate.id);
    clubCounts.set(candidate.clubId, (clubCounts.get(candidate.clubId) ?? 0) + 1);
    spent += candidate.price;
    filled += 1;
  }
  return { filled, spent, used };
}

interface BoundaryWorld {
  gameweekId: Id<"fantasyGameweeks">;
  fixtureIds: Id<"fantasyFixtures">[];
  playerIds: Id<"fantasyPlayers">[];
  /** The 13 whose prices sum to exactly SQUAD_BUDGET, in fill order. */
  thirteen: Id<"fantasyPlayers">[];
  /** Priced 0.5 above the 13th's price — the 91.5 swap. */
  bursterId: Id<"fantasyPlayers">;
  /** A 4th player of club A, unused — the kicked-off swap-in probe. */
  lateArrivalId: Id<"fantasyPlayers">;
  /** Four club-F players — the favorite-exemption probe. */
  favoriteFour: Id<"fantasyPlayers">[];
  kickedOffFixtureId: Id<"fantasyFixtures">;
}

/**
 * Build the synthetic boundary world: one SYNTH- gameweek, three future
 * fixtures over six clubs, and 19 active, PRICED synthetic players. The
 * integration sim's precedent covers the activate+price posture; here it is
 * stricter still — the world is deleted before this transaction returns, so
 * no other request can ever observe it.
 *
 * Prices: the 13 boundary players cost 7.0 each — 13 × 7.0 = 91.0, exactly
 * SQUAD_BUDGET — so acceptance of the 13th player IS the boundary test.
 */
async function buildBoundaryWorld(ctx: MutationCtx, now: number): Promise<BoundaryWorld> {
  const existing = await ctx.db
    .query("fantasyGameweeks")
    .withIndex("by_season_gwNumber", (q) =>
      q.eq("season", BOUNDARY_SEASON).eq("gwNumber", BOUNDARY_GW),
    )
    .first();
  assert(existing === null, `${BOUNDARY_SEASON} already exists — a prior run left rows; purge it.`);

  const gameweekId = await ctx.db.insert("fantasyGameweeks", {
    season: BOUNDARY_SEASON,
    gwNumber: BOUNDARY_GW,
    leagueIds: [BOUNDARY_LEAGUE],
    status: "upcoming",
    finalityAt: now + 48 * 60 * 60 * 1000,
  });

  const fixtureIds: Id<"fantasyFixtures">[] = [];
  for (let i = 0; i < 3; i += 1) {
    fixtureIds.push(
      await ctx.db.insert("fantasyFixtures", {
        gameweekId,
        leagueId: BOUNDARY_LEAGUE,
        providerFixtureId: `synth-o1b-f${i}`,
        kickoffAt: now + 6 * 60 * 60 * 1000, // future: everyone selectable
        status: "scheduled",
        homeClubId: BOUNDARY_CLUBS[i * 2],
        awayClubId: BOUNDARY_CLUBS[i * 2 + 1],
      }),
    );
  }

  const playerIds: Id<"fantasyPlayers">[] = [];
  const insertPlayer = async (
    n: number,
    clubId: string,
    price: number,
  ): Promise<Id<"fantasyPlayers">> => {
    const id = await ctx.db.insert("fantasyPlayers", {
      providerPlayerId: `synth-o1b-p${n}`,
      name: `Synth Boundary ${n}`,
      clubId,
      leagueId: BOUNDARY_LEAGUE,
      feedPosition: "MID",
      price,
      active: true,
    });
    playerIds.push(id);
    return id;
  };

  // The exact-91.0 thirteen: clubs A–D three each (the cap), E one. All 7.0.
  const thirteen: Id<"fantasyPlayers">[] = [];
  let n = 0;
  for (const clubId of ["SYNTH-O1A", "SYNTH-O1B", "SYNTH-O1C", "SYNTH-O1D"]) {
    for (let i = 0; i < PER_CLUB_CAP; i += 1) thirteen.push(await insertPlayer(n++, clubId, 7.0));
  }
  thirteen.push(await insertPlayer(n++, "SYNTH-O1E", 7.0));

  const bursterId = await insertPlayer(n++, "SYNTH-O1E", 7.5);
  const lateArrivalId = await insertPlayer(n++, "SYNTH-O1A", 7.0);
  const favoriteFour: Id<"fantasyPlayers">[] = [];
  for (let i = 0; i < PER_CLUB_CAP + 1; i += 1) {
    favoriteFour.push(await insertPlayer(n++, "SYNTH-O1F", 4.0));
  }

  return {
    gameweekId,
    fixtureIds,
    playerIds,
    thirteen,
    bursterId,
    lateArrivalId,
    favoriteFour,
    kickedOffFixtureId: fixtureIds[0], // the A–B fixture
  };
}

/** Delete everything the boundary world inserted — same transaction, so the
 *  world was never observable. Squads/slots of the passed users included. */
async function purgeBoundaryWorld(
  ctx: MutationCtx,
  world: BoundaryWorld,
  squadIds: Id<"fantasySquads">[],
): Promise<number> {
  let deleted = 0;
  for (const squadId of squadIds) {
    const slots = await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad", (q) => q.eq("squadId", squadId))
      .collect();
    for (const slot of slots) {
      await ctx.db.delete(slot._id);
      deleted += 1;
    }
    await ctx.db.delete(squadId);
    deleted += 1;
  }
  for (const playerId of world.playerIds) {
    await ctx.db.delete(playerId);
    deleted += 1;
  }
  for (const fixtureId of world.fixtureIds) {
    await ctx.db.delete(fixtureId);
    deleted += 1;
  }
  await ctx.db.delete(world.gameweekId);
  deleted += 1;
  return deleted;
}

async function clearSquad(
  ctx: MutationCtx,
  userId: Id<"users">,
  squadId: Id<"fantasySquads">,
): Promise<void> {
  const slots = await ctx.db
    .query("fantasySquadSlots")
    .withIndex("by_squad", (q) => q.eq("squadId", squadId))
    .collect();
  for (const slot of slots) {
    if (slot.playerId !== undefined) {
      await setSlotFor(ctx, userId, { squadId, slotIndex: slot.slotIndex, playerId: null });
    }
  }
}

export const simulateBudgetBuild = internalMutation({
  args: {
    salt: v.optional(v.string()),
    /** FW-VS1 uniform contract. This sim ALWAYS keeps its live-market rows
     *  (the flag is accepted for CLI uniformity); the boundary world is
     *  transaction-local either way. Purge: purgeSimBudgetData, idempotent. */
    keepData: v.optional(v.boolean()),
  },
  handler: async (ctx, { salt }) => {
    const now = Date.now();
    const username = simUsername(salt ?? "o1");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    assert(
      existing === null,
      `sim user ${username} already exists — run purgeSimBudgetData first.`,
    );

    const gameweek = await findOpenGameweek(ctx);
    assert(
      gameweek !== null,
      "no open gameweek on this deployment — constitute one (FW-2) before the walkthrough.",
    );

    const userId = await ctx.db.insert("users", { username });
    const report: Record<string, unknown> = { username, gameweek: gameweek.gwNumber };

    // ── 1 · create ──
    const { squadId } = await createBudgetSquadFor(ctx, userId, {
      gameweekId: gameweek._id,
      formation: { GK: 1, DEF: 4, MID: 4, ATT: 2 },
      finisherRoles: ["MID", "ATT"],
    });
    report.created = squadId;

    const { selectable, unpricedWithFixture } = await selectablePlayers(
      ctx,
      gameweek._id,
      now,
    );
    assert(
      selectable.length >= SQUAD_SIZE * 2,
      `only ${selectable.length} selectable players — not enough of a market to walk through.`,
    );

    // ── 2 · over-budget, rejected server-side ──
    // Fill 12 slots greedily from the top of the market (legally — every
    // acceptance is the server's), then ask for a 13th priced above what is
    // left. Twelve top-down picks always spend past 78.0, so a player above
    // the remaining headroom always exists while the scale tops at 13.0.
    const expensive = await fillSlots(
      ctx,
      userId,
      squadId,
      selectable,
      Array.from({ length: SQUAD_SIZE - 1 }, (_, i) => i),
    );
    assert(expensive.filled === SQUAD_SIZE - 1, `expensive fill stopped at ${expensive.filled}/12.`);
    const headroom = SQUAD_BUDGET - expensive.spent;
    const burster = selectable.find((p) => !expensive.used.has(p.id) && p.price > headroom);
    assert(
      burster !== undefined,
      `no unused player priced above the ${headroom.toFixed(1)} headroom — cannot demonstrate an over-budget rejection.`,
    );
    report.overBudgetRejected = await expectRejection(
      () =>
        setSlotFor(ctx, userId, {
          squadId,
          slotIndex: SQUAD_SIZE - 1,
          playerId: burster.id,
        }),
      "budget",
      "over-budget edit",
    );

    // ── 3 · over-cap, rejected server-side ──
    await clearSquad(ctx, userId, squadId);
    const byClub = new Map<string, SimPlayer[]>();
    for (const p of selectable) {
      const list = byClub.get(p.clubId) ?? [];
      list.push(p);
      byClub.set(p.clubId, list);
    }
    const bigClub = [...byClub.values()].find(
      (list) =>
        list.length > PER_CLUB_CAP &&
        list.slice(0, PER_CLUB_CAP + 1).reduce((s, p) => s + p.price, 0) <= SQUAD_BUDGET,
    );
    assert(bigClub !== undefined, "no club with 4 affordable selectable players.");
    for (let i = 0; i < PER_CLUB_CAP; i += 1) {
      await setSlotFor(ctx, userId, { squadId, slotIndex: i, playerId: bigClub[i].id });
    }
    report.overCapRejected = await expectRejection(
      () =>
        setSlotFor(ctx, userId, {
          squadId,
          slotIndex: PER_CLUB_CAP,
          playerId: bigClub[PER_CLUB_CAP].id,
        }),
      "players from one club",
      "over-cap edit",
    );

    // ── 4 · unpriced player, rejected fail-closed (FW-1 STOP-4) ──
    if (unpricedWithFixture === null) {
      report.unpricedRejected =
        "skipped — every active player with a fixture is priced on this deployment.";
    } else {
      report.unpricedRejected = await expectRejection(
        () =>
          setSlotFor(ctx, userId, {
            squadId,
            slotIndex: PER_CLUB_CAP,
            playerId: unpricedWithFixture._id,
          }),
        "no editorial price",
        "unpriced pick",
      );
    }

    // ── 5 · fill a legal 13 (cheapest-first, cap-aware) ──
    await clearSquad(ctx, userId, squadId);
    const cheapFirst = [...selectable].reverse();
    const legal = await fillSlots(
      ctx,
      userId,
      squadId,
      cheapFirst,
      Array.from({ length: SQUAD_SIZE }, (_, i) => i),
    );
    assert(legal.filled === SQUAD_SIZE, `full fill stopped at ${legal.filled}/13.`);
    assert(
      legal.spent <= SQUAD_BUDGET,
      `full fill spent ${legal.spent}, over ${SQUAD_BUDGET} — the server should have refused.`,
    );
    report.filled = { count: legal.filled, spent: legal.spent };

    // ── 6 · arrange: swap an XI slot with a finisher, atomically ──
    const slots = await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad", (q) => q.eq("squadId", squadId))
      .collect();
    const xiSlot = slots.find((s) => s.slotIndex === 10);
    const finSlot = slots.find((s) => s.slotIndex === 11);
    assert(xiSlot !== undefined && finSlot !== undefined, "slots 10/11 missing.");
    await setFormationFor(ctx, userId, {
      squadId,
      slots: slots
        .sort((a, b) => a.slotIndex - b.slotIndex)
        .map((s) => ({
          slotIndex: s.slotIndex,
          slotRole:
            s.slotIndex === 10
              ? finSlot.slotRole
              : s.slotIndex === 11
                ? xiSlot.slotRole
                : s.slotRole,
          isFinisher:
            s.slotIndex === 10 ? true : s.slotIndex === 11 ? false : s.isFinisher,
        })),
    });
    const after = await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad_slotIndex", (q) => q.eq("squadId", squadId).eq("slotIndex", 10))
      .first();
    assert(after?.isFinisher === true, "swap did not land: slot 10 is not a finisher.");
    report.arranged = "XI slot 10 ↔ finisher slot 11, via atomic setFormation";

    // ══ 7 · the FW-VS1 boundary phase, in a transaction-local synthetic world ══
    const world = await buildBoundaryWorld(ctx, now);
    const boundarySquads: Id<"fantasySquads">[] = [];

    // 7a · a 13 summing EXACTLY 91.0 is accepted — the 13th acceptance is the
    //      boundary. Every fill is the server's own.
    const bx = await createBudgetSquadFor(ctx, userId, {
      gameweekId: world.gameweekId,
      formation: { GK: 1, DEF: 4, MID: 4, ATT: 2 },
      finisherRoles: ["MID", "ATT"],
    });
    boundarySquads.push(bx.squadId);
    for (let i = 0; i < SQUAD_SIZE; i += 1) {
      await setSlotFor(ctx, userId, {
        squadId: bx.squadId,
        slotIndex: i,
        playerId: world.thirteen[i],
      });
    }
    {
      const filled = await ctx.db
        .query("fantasySquadSlots")
        .withIndex("by_squad", (q) => q.eq("squadId", bx.squadId))
        .collect();
      let sum = 0;
      for (const slot of filled) {
        assert(slot.playerId !== undefined, `boundary slot ${slot.slotIndex} is empty.`);
        const player = await ctx.db.get(slot.playerId);
        sum += player?.price ?? 0;
      }
      assert(
        sum === SQUAD_BUDGET,
        `boundary 13 sums to ${sum.toFixed(1)}, expected exactly ${SQUAD_BUDGET.toFixed(1)}.`,
      );
      report.exactBudgetAccepted = `13 players at ${sum.toFixed(1)} = SQUAD_BUDGET exactly, all accepted`;
    }

    // 7b · the 91.5 variant: swap one 7.0 for the 7.5 — refused, and the
    //      server's message must carry BOTH boundary numbers.
    {
      const message = await expectRejection(
        () =>
          setSlotFor(ctx, userId, {
            squadId: bx.squadId,
            slotIndex: SQUAD_SIZE - 1,
            playerId: world.bursterId,
          }),
        "budget",
        "the 91.5 variant",
      );
      const over = (SQUAD_BUDGET + 0.5).toFixed(1);
      assert(
        message.includes(over) && message.includes(SQUAD_BUDGET.toFixed(1)),
        `the rejection does not show the boundary numbers ${over}/${SQUAD_BUDGET.toFixed(1)}: "${message}"`,
      );
      report.halfStepOverRejected = message;
    }

    // 7c · the favorite exemption, POSITIVE direction. A fresh user's
    //      first-ever favorite set is immediate (S2 — no cooldown to wait
    //      out), and with it in force a 4th same-club player is ACCEPTED.
    const favUsername = `${username.slice(0, 20)}_fav`;
    const favUserId = await ctx.db.insert("users", { username: favUsername });
    {
      const favUser = await ctx.db.get(favUserId);
      assert(favUser !== null, "favorite-probe user vanished.");
      const patch = planFavoriteClubChange(favUser, now, "SYNTH-O1F");
      assert(
        patch.favoriteClub === "SYNTH-O1F" && patch.favoriteClubPending === undefined,
        "a first-ever favorite selection was not immediate (S2).",
      );
      await ctx.db.patch(favUserId, patch);
    }
    const fy = await createBudgetSquadFor(ctx, favUserId, {
      gameweekId: world.gameweekId,
      formation: { GK: 1, DEF: 4, MID: 4, ATT: 2 },
      finisherRoles: ["MID", "ATT"],
    });
    boundarySquads.push(fy.squadId);
    assert(
      fy.favoriteClubAtBuild === "SYNTH-O1F",
      `favorite not snapshotted at build: ${fy.favoriteClubAtBuild}.`,
    );
    for (let i = 0; i < PER_CLUB_CAP + 1; i += 1) {
      // The 4th same-club acceptance — the exemption's positive direction.
      await setSlotFor(ctx, favUserId, {
        squadId: fy.squadId,
        slotIndex: i,
        playerId: world.favoriteFour[i],
      });
    }
    report.favoriteFourthAccepted = `4 × SYNTH-O1F accepted with the favorite set (cap ${PER_CLUB_CAP})`;
    // Negative control on the same squad: 3 from a NON-favorite club, then a 4th.
    for (let i = 0; i < PER_CLUB_CAP; i += 1) {
      await setSlotFor(ctx, favUserId, {
        squadId: fy.squadId,
        slotIndex: PER_CLUB_CAP + 1 + i,
        playerId: world.thirteen[i], // clubs: 3 × SYNTH-O1A
      });
    }
    report.nonFavoriteFourthRejected = await expectRejection(
      () =>
        setSlotFor(ctx, favUserId, {
          squadId: fy.squadId,
          slotIndex: PER_CLUB_CAP * 2 + 1,
          playerId: world.lateArrivalId, // a 4th SYNTH-O1A
        }),
      "players from one club",
      "4th from a non-favorite club",
    );

    // 7d · the A–B fixture kicks off. The three club-A slots lock; a
    //      formation call that would re-role one is refused whole.
    await ctx.db.patch(world.kickedOffFixtureId, {
      kickoffAt: now - 60 * 60 * 1000,
      status: "live",
    });
    {
      const slots = (
        await ctx.db
          .query("fantasySquadSlots")
          .withIndex("by_squad", (q) => q.eq("squadId", bx.squadId))
          .collect()
      ).sort((a, b) => a.slotIndex - b.slotIndex);
      // Slot 0 holds a club-A player (fill order) — locked now. Propose
      // swapping its role with slot 5's: a legal shape, but it re-roles a
      // frozen slot.
      report.lockedSetFormationRejected = await expectRejection(
        () =>
          setFormationFor(ctx, userId, {
            squadId: bx.squadId,
            slots: slots.map((s) => ({
              slotIndex: s.slotIndex,
              slotRole:
                s.slotIndex === 0
                  ? slots[5].slotRole
                  : s.slotIndex === 5
                    ? slots[0].slotRole
                    : s.slotRole,
              isFinisher: s.isFinisher,
            })),
          }),
        SLOT_LOCKED,
        "setFormation reaching a locked slot",
      );
    }

    // 7e · the kicked-off swap-in: an UNLOCKED slot may not take a player
    //      whose own fixture is underway (hindsight ban, v1.0.1).
    report.kickedOffSwapInRejected = await expectRejection(
      () =>
        setSlotFor(ctx, userId, {
          squadId: bx.squadId,
          slotIndex: SQUAD_SIZE - 1, // club-E slot: unlocked
          playerId: world.lateArrivalId, // club A: kicked off
        }),
      PLAYER_ALREADY_STARTED,
      "swap-in of a kicked-off player",
    );

    // 7f · createSquad's F1 argument gate: context "crew" refused. Driven
    //      through the exported guard the public wrapper calls first — the
    //      auth wrapper itself is the sim's one standing seam (no sessions).
    report.crewCreateRejected = await expectRejection(
      async () => assertPublicSquadCreateArgs("crew", undefined),
      CREW_SQUAD_DRAFT_ONLY,
      "public crew createSquad",
    );

    // 7g · the boundary world vanishes with this transaction.
    const boundaryDeleted = await purgeBoundaryWorld(ctx, world, boundarySquads);
    await ctx.db.delete(favUserId);
    report.boundaryWorld = `built, probed and deleted in-transaction (${boundaryDeleted + 1} rows)`;

    report.verdict = "PASS — purge with fantasyBudgetSim:purgeSimBudgetData";
    return report;
  },
});

export const purgeSimBudgetData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.gte("username", SIM_USERNAME_PREFIX).lt("username", SIM_USERNAME_PREFIX + "\uffff"),
      )
      .take(100);

    let deletedUsers = 0;
    let deletedSquads = 0;
    let deletedSlots = 0;
    for (const user of users) {
      // Re-validate: never delete a row that is not provably the sim's.
      if (!user.username?.startsWith(SIM_USERNAME_PREFIX)) continue;
      const squads = await ctx.db
        .query("fantasySquads")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      for (const squad of squads) {
        const slots = await ctx.db
          .query("fantasySquadSlots")
          .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
          .collect();
        for (const slot of slots) {
          await ctx.db.delete(slot._id);
          deletedSlots += 1;
        }
        await ctx.db.delete(squad._id);
        deletedSquads += 1;
      }
      await ctx.db.delete(user._id);
      deletedUsers += 1;
    }
    return { deletedUsers, deletedSquads, deletedSlots };
  },
});
