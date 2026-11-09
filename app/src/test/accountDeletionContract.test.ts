// Account deletion (Play policy): the account can't be signed into again,
// the user doc keeps no personal data, the player's own rows are gone, and
// shared records keep working without the player's name.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({ getAuthUserId: vi.fn(async () => "user_1" as string | null) }));
vi.mock("@convex-dev/auth/server", () => ({ getAuthUserId: authMock.getAuthUserId }));

import * as accountDeletion from "../../convex/accountDeletion";

type Row = Record<string, unknown> & { _id: string };

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as { _handler?: (ctx: unknown, args: unknown) => Promise<unknown> };
  if (typeof registered._handler !== "function") throw new Error("not a Convex function");
  return registered._handler;
}

function makeCtx(tables: Record<string, Row[]>) {
  const scheduled: Array<{ args: Record<string, unknown>; delay: number }> = [];
  const all = () => Object.values(tables).flat();
  const find = (id: string) => all().find((r) => r._id === id) ?? null;
  const db = {
    async get(id: string) {
      return find(id);
    },
    async delete(id: string) {
      for (const rows of Object.values(tables)) {
        const i = rows.findIndex((r) => r._id === id);
        if (i >= 0) rows.splice(i, 1);
      }
    },
    async patch(id: string, fields: Record<string, unknown>) {
      const row = find(id)!;
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) delete row[k];
        else row[k] = v;
      }
    },
    async replace(id: string, doc: Record<string, unknown>) {
      const row = find(id)!;
      for (const k of Object.keys(row)) if (k !== "_id") delete row[k];
      Object.assign(row, doc);
    },
    query(table: string) {
      let list = [...(tables[table] ?? [])];
      const api = {
        withIndex(_name: string, build: (q: { eq: (f: string, v: unknown) => unknown }) => unknown) {
          const conds: Array<[string, unknown]> = [];
          const q = {
            eq(f: string, v: unknown) {
              conds.push([f, v]);
              return q;
            },
          };
          build(q);
          list = list.filter((r) => conds.every(([f, v]) => r[f] === v));
          return api;
        },
        async take(n: number) {
          return list.slice(0, n);
        },
        async collect() {
          return list;
        },
        async paginate({ cursor, numItems }: { cursor: string | null; numItems: number }) {
          const start = cursor ? Number(cursor) : 0;
          const page = list.slice(start, start + numItems);
          const end = start + page.length;
          return { page, isDone: end >= list.length, continueCursor: String(end) };
        },
      };
      return api;
    },
  };
  const scheduler = {
    async runAfter(delay: number, _fn: unknown, args: Record<string, unknown>) {
      scheduled.push({ args, delay });
    },
  };
  return { ctx: { db, scheduler }, scheduled };
}

function seed(): Record<string, Row[]> {
  return {
    users: [
      { _id: "user_1", username: "zidane", email: "z@example.com", displayName: "Zizou", currentStreak: 4, isAnonymous: false },
      { _id: "user_2", username: "pirlo" },
    ],
    authAccounts: [{ _id: "acc_1", userId: "user_1", provider: "password", providerAccountId: "z@example.com" }],
    authVerificationCodes: [{ _id: "code_1", accountId: "acc_1" }],
    authSessions: [{ _id: "sess_1", userId: "user_1" }],
    authRefreshTokens: [{ _id: "tok_1", sessionId: "sess_1" }],
    usernameClaims: [{ _id: "claim_1", userId: "user_1", username: "zidane" }],
    userRatings: [
      { _id: "r1", userId: "user_1" },
      { _id: "r2", userId: "user_2" },
    ],
    higherLowerSessions: [{ _id: "hl1", userId: "user_1", deckId: "deck_1" }],
    higherLowerDecks: [{ _id: "deck_1" }],
    whosOlderReminders: [
      { _id: "rem1", createdByUserId: "user_1", email: "z@example.com" },
      { _id: "rem2", email: "z@example.com" },
      { _id: "rem3", email: "other@example.com" },
    ],
    duels: [{ _id: "duel1", challengerId: "user_2", opponentId: "user_1", opponentUsernameSnapshot: "zidane" }],
    fantasyCrewMembers: [{ _id: "cm1", userId: "user_1", nameSnapshot: "zidane" }],
    arenas: [
      {
        _id: "arena1",
        hostId: "user_2",
        players: [
          { userId: "user_2", nameSnapshot: "pirlo" },
          { userId: "user_1", nameSnapshot: "zidane" },
        ],
      },
    ],
    fantasyDraftRooms: [{ _id: "room1", seats: [{ userId: "user_1", nameSnapshot: "zidane" }] }],
    fantasyDraftLog: [{ _id: "log1", userId: "user_1", seats: [{ userId: "user_1", nameSnapshot: "zidane" }] }],
  };
}

async function runPurge(ctx: unknown, scheduled: Array<{ args: Record<string, unknown>; delay: number }>) {
  const purge = handlerOf(accountDeletion.purgeUserData);
  for (let i = 0; i < 500; i += 1) {
    const job = scheduled.shift();
    if (!job) return;
    if (job.delay > 0) {
      scheduled.unshift(job);
      return;
    }
    await purge(ctx, job.args);
  }
  throw new Error("purge never finished");
}

describe("account deletion", () => {
  beforeEach(() => authMock.getAuthUserId.mockResolvedValue("user_1"));

  it("needs a signed-in caller and the explicit confirm word", async () => {
    authMock.getAuthUserId.mockResolvedValue(null);
    const { ctx } = makeCtx(seed());
    await expect(handlerOf(accountDeletion.deleteMyAccount)(ctx, { confirm: "DELETE" })).rejects.toThrow();
  });

  it("removes every way back in and empties the user doc", async () => {
    const tables = seed();
    const { ctx, scheduled } = makeCtx(tables);
    await handlerOf(accountDeletion.deleteMyAccount)(ctx, { confirm: "DELETE" });
    for (const t of ["authAccounts", "authVerificationCodes", "authSessions", "authRefreshTokens", "usernameClaims"]) {
      expect(tables[t]).toHaveLength(0);
    }
    const user = tables.users.find((u) => u._id === "user_1")!;
    expect(Object.keys(user).sort()).toEqual(["_id", "deletedAt", "isAnonymous", "isGuest"]);
    expect(scheduled).toHaveLength(1);
  });

  it("purges own rows, scrubs shared names, leaves other players alone, and runs twice", async () => {
    const tables = seed();
    const { ctx, scheduled } = makeCtx(tables);
    await handlerOf(accountDeletion.deleteMyAccount)(ctx, { confirm: "DELETE" });
    await runPurge(ctx, scheduled);

    expect(tables.userRatings.map((r) => r._id)).toEqual(["r2"]);
    expect(tables.higherLowerSessions).toHaveLength(0);
    expect(tables.higherLowerDecks).toHaveLength(0);
    expect(tables.whosOlderReminders.map((r) => r._id)).toEqual(["rem3"]);
    expect(tables.duels[0].opponentUsernameSnapshot).toBeUndefined();
    expect(tables.duels[0].opponentId).toBe("user_1"); // the other player's history stays
    expect(tables.fantasyCrewMembers[0].nameSnapshot).toBe("Deleted player");
    const players = tables.arenas[0].players as Array<{ nameSnapshot: string }>;
    expect(players.map((p) => p.nameSnapshot)).toEqual(["pirlo", "Deleted player"]);
    expect((tables.fantasyDraftRooms[0].seats as Array<{ nameSnapshot: string }>)[0].nameSnapshot).toBe("Deleted player");
    expect((tables.fantasyDraftLog[0].seats as Array<{ nameSnapshot: string }>)[0].nameSnapshot).toBe("Deleted player");
    expect(JSON.stringify(tables)).not.toContain("zidane");
    expect(JSON.stringify(tables)).not.toContain("z@example.com");

    // Second pass is queued for after any old token has expired.
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].delay).toBeGreaterThan(60 * 60 * 1000);
    expect(scheduled[0].args.secondPass).toBe(true);
  });
});
