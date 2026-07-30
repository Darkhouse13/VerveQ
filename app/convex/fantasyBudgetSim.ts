/**
 * Weekend Fantasy — the budget-mode DEV walkthrough (FW-LAUNCH O1).
 *
 * The O1 DONE gate, as one scripted run against live DEV data through the
 * REAL write path: create → fill 13 → arrange → over-budget and over-cap
 * variants rejected server-side → purge clean.
 *
 * Same posture as fantasyDraftSim.ts: internal-only, unreachable from any
 * client, and it drives the shipped cores (`createBudgetSquadFor`,
 * `setSlotFor`, `setFormationFor`) that the public mutations delegate to —
 * the sim has no sessions, so the authorization wrappers are the only thing
 * not exercised. Every rule the product enforces (budget, club cap,
 * hindsight, formation, unpriced fail-closed) is enforced on this run too:
 * nothing here is asserted from a reimplementation, every PASS is the
 * server's own acceptance and every REJECTED is the server's own throw.
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
  createBudgetSquadFor,
  setFormationFor,
  setSlotFor,
} from "./fantasySquads";
import { findOpenGameweek } from "./fantasyDraftRooms";
import { kickoffHasPassed } from "./fantasyLocks";

const SIM_USERNAME_PREFIX = "simbudget_";

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
  args: { salt: v.optional(v.string()) },
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
