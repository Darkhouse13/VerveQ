/**
 * Removing QA test data from production, run by hand from the CLI:
 *
 *   npx convex run opsTestData:listTestSquads '{"from":…,"to":…}' --prod
 *   npx convex run opsTestData:deleteTestSquad '{"squadId":"…","from":…,"to":…}' --prod
 *
 * QA walkthroughs on prod name their accounts `qaonb…`; guest walkthroughs
 * leave nameless guests. A Weekend squad they build would show on the public
 * Weekend table once its players score, so it is removed before kickoff.
 * The delete refuses anything that is not plainly test data: the owner must
 * carry a QA username, or be a nameless guest whose squad was created inside
 * the given window (the walkthrough's time on the site).
 */
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";

const QA_USERNAME = /^qaonb[a-z0-9]*$/;
// A window is a QA session on the site, never a day of real traffic.
const MAX_WINDOW_MS = 2 * 60 * 60 * 1000;

function checkWindow(from: number, to: number) {
  if (!(to > from) || to - from > MAX_WINDOW_MS) {
    throw new Error("window must be positive and at most 2 hours");
  }
}

async function describe(ctx: QueryCtx, squad: Doc<"fantasySquads">) {
  const owner = await ctx.db.get(squad.userId);
  const slots = await ctx.db
    .query("fantasySquadSlots")
    .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
    .collect();
  return {
    squadId: squad._id,
    context: squad.context,
    createdAt: new Date(squad.createdAt).toISOString(),
    username: owner?.username ?? null,
    filledSlots: slots.filter((s) => s.playerId !== undefined).length,
  };
}

function isTestSquad(
  squad: Doc<"fantasySquads">,
  owner: Doc<"users"> | null,
  from: number,
  to: number,
): boolean {
  if (squad.context !== "budget") return false;
  const username = owner?.username;
  if (typeof username === "string") return QA_USERNAME.test(username);
  return squad.createdAt >= from && squad.createdAt <= to;
}

/** Budget squads that pass the test-data rule for this window. Read only. */
export const listTestSquads = internalQuery({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, { from, to }) => {
    checkWindow(from, to);
    const out = [];
    for (const squad of await ctx.db.query("fantasySquads").collect()) {
      const owner = await ctx.db.get(squad.userId);
      if (isTestSquad(squad, owner, from, to)) out.push(await describe(ctx, squad));
    }
    return out;
  },
});

/** Deletes one test squad, its slots and any percentile stamp. */
export const deleteTestSquad = internalMutation({
  args: { squadId: v.id("fantasySquads"), from: v.number(), to: v.number() },
  handler: async (ctx, { squadId, from, to }) => {
    checkWindow(from, to);
    const squad = await ctx.db.get(squadId);
    if (!squad) throw new Error("No such squad");
    const owner = await ctx.db.get(squad.userId);
    if (!isTestSquad(squad, owner, from, to)) {
      throw new Error("Refused: not a QA squad (owner name or creation time doesn't match)");
    }
    const removed: Id<"fantasySquadSlots">[] = [];
    for (const slot of await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad", (q) => q.eq("squadId", squadId))
      .collect()) {
      await ctx.db.delete(slot._id);
      removed.push(slot._id);
    }
    const stamps = await ctx.db
      .query("fantasyGameweekPercentiles")
      .filter((q) => q.eq(q.field("squadId"), squadId))
      .collect();
    for (const stamp of stamps) await ctx.db.delete(stamp._id);
    await ctx.db.delete(squadId);
    return { deleted: squadId, slots: removed.length, percentileStamps: stamps.length };
  },
});
