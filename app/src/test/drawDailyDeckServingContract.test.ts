/**
 * Ticket E5 — Daily Deck serving contract.
 *
 * Covers, against the REAL handlers + real engine on the in-memory fake:
 *  - a large (real-v4) active set is served as a per-dateKey SLICE: the board
 *    row pins sliceCardIds (id-sorted, subset of the set) + sliceConfigVersion,
 *    and every board card comes from the slice;
 *  - slice determinism: regeneration reproduces the identical slice + board
 *    (regenerateBoardForDate reports unchanged on a second call);
 *  - the synthetic set is served WHOLE (no slice pin);
 *  - regenerateBoardForDate guards: throws while enabled, throws when runs
 *    exist for the date;
 *  - seedRealCards is a full idempotent sync of the committed artifact;
 *  - the B2 replay gate accepts a completed run on a sliced board (replay
 *    identity regenerates from the PINNED slice, not from re-selection).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb, handlerOf } from "./support/drawFakeConvex";

// vi.hoisted values cannot cross a module boundary, so each suite declares its
// own auth mock rather than sharing one from test/support.
const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => null as string | null),
}));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
  convexAuth: () => ({
    auth: {},
    signIn: () => {},
    signOut: () => {},
    store: {},
    isAuthenticated: () => false,
  }),
}));

import * as draw from "../../convex/draw";
import * as drawSeed from "../../convex/drawSeed";
import * as drawBoards from "../../convex/drawBoards";
import { DAILY_SLICE_CONFIG_V1, DAILY_SLICE_CONFIG_VERSION } from "@/lib/drawEngine";
import { getTodayUTC } from "../../convex/lib/daily";

interface Env {
  db: FakeDb;
  ctx: { db: FakeDb; auth: Record<string, never> };
  settingsId: string;
  today: string;
}

/** Seed synthetic (creates settings) + real set; optionally activate real. */
async function makeEnv(activeSet: "synthetic-v1" | "real-v4"): Promise<Env> {
  const db = new FakeDb();
  const ctx = { db, auth: {} as Record<string, never> };
  await handlerOf(drawSeed.seedSyntheticCards)(ctx, {});
  await handlerOf(drawSeed.seedRealCards)(ctx, {});
  const settings = db.rows("drawSettings")[0];
  await db.patch(settings._id, { activeSetVersion: activeSet });
  return { db, ctx, settingsId: settings._id, today: getTodayUTC() };
}

function actAs(userId: string | null) {
  authMock.getAuthUserId.mockResolvedValue(userId);
}

interface RunViewLike {
  phase: string;
  offers: Array<{ id: string }> | null;
  squad: Array<{ id: string }>;
  outcome: string | null;
  finalScore: number | null;
}

interface SubmitResult {
  replayRejected: boolean;
  run: RunViewLike;
}

async function playToCompletion(env: Env): Promise<SubmitResult> {
  let view = (await handlerOf(draw.startRun)(env.ctx, {})) as RunViewLike;
  let last: SubmitResult = { replayRejected: false, run: view };
  const submit = async (choice: unknown) =>
    (await handlerOf(draw.submitChoice)(env.ctx, { choice })) as SubmitResult;
  while (view.phase === "draft") {
    last = await submit({ type: "pick", offerIndex: 0 });
    view = last.run;
  }
  while (view.phase !== "done") {
    if (view.phase === "bench") last = await submit({ type: "bench", squadIndex: 0 });
    else last = await submit({ type: "push" });
    view = last.run;
  }
  return last;
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue(null);
});

describe("Daily Deck slicing (Ticket E5)", () => {
  it("serves a real-v4 day as a pinned slice; every board card is from it", async () => {
    const env = await makeEnv("real-v4");
    await drawBoards.ensureDailyBoard(env.ctx as never, env.today);
    const board = env.db.rows("drawDailyBoards")[0];

    const sliceIds = board.sliceCardIds as string[];
    expect(board.sliceConfigVersion).toBe(DAILY_SLICE_CONFIG_VERSION);
    expect(sliceIds).toHaveLength(DAILY_SLICE_CONFIG_V1.sliceSize);
    expect(sliceIds).toEqual([...sliceIds].sort());
    const realIds = new Set(
      env.db.rows("drawCards").filter((c) => c.setVersion === "real-v4").map((c) => c.cardId),
    );
    for (const id of sliceIds) expect(realIds.has(id)).toBe(true);

    const boardCards = (board.board as { rows: Array<Array<{ id: string; name: string }>> }).rows.flat();
    expect(boardCards).toHaveLength(18);
    const sliceSet = new Set(sliceIds);
    for (const card of boardCards) {
      expect(sliceSet.has(card.id)).toBe(true);
      // Real names, not the synthetic generator's alien syllables.
      expect(card.id.startsWith("real_")).toBe(true);
    }
  });

  it("serves the synthetic set whole — no slice pin", async () => {
    const env = await makeEnv("synthetic-v1");
    await drawBoards.ensureDailyBoard(env.ctx as never, env.today);
    const board = env.db.rows("drawDailyBoards")[0];
    expect(board.sliceCardIds).toBeUndefined();
    expect(board.sliceConfigVersion).toBeUndefined();
  });

  it("regeneration is deterministic: identical slice + board, then a no-op", async () => {
    const env = await makeEnv("real-v4");
    await drawBoards.ensureDailyBoard(env.ctx as never, env.today);
    const first = env.db.rows("drawDailyBoards")[0];

    const regen = (await handlerOf(drawBoards.regenerateBoardForDate)(env.ctx, {})) as {
      unchanged: boolean;
      boardSeed: string;
      sliced: boolean;
    };
    // ensureDailyBoard already produced exactly what regeneration computes.
    expect(regen.unchanged).toBe(true);
    expect(regen.sliced).toBe(true);
    expect(regen.boardSeed).toBe(first.boardSeed);
    const after = env.db.rows("drawDailyBoards")[0];
    expect(after.sliceCardIds).toEqual(first.sliceCardIds);
    expect(JSON.stringify(after.board)).toBe(JSON.stringify(first.board));
  });

  it("regenerateBoardForDate fails closed: refuses while enabled or with runs", async () => {
    const env = await makeEnv("real-v4");
    await drawBoards.ensureDailyBoard(env.ctx as never, env.today);

    await env.db.patch(env.settingsId, { enabled: true });
    await expect(handlerOf(drawBoards.regenerateBoardForDate)(env.ctx, {})).rejects.toThrow(
      /enabled must be false/,
    );
    await env.db.patch(env.settingsId, { enabled: false });

    const board = env.db.rows("drawDailyBoards")[0];
    const userId = await env.db.insert("users", { username: "runner" });
    await env.db.insert("drawRuns", {
      userId,
      dateKey: env.today,
      boardId: board._id,
      choiceLog: [],
      status: "drafting",
      startedAt: 1,
    });
    await expect(handlerOf(drawBoards.regenerateBoardForDate)(env.ctx, {})).rejects.toThrow(
      /drawRuns exist/,
    );
  });

  it("seedRealCards is a full idempotent sync of the committed artifact", async () => {
    const env = await makeEnv("real-v4");
    const again = (await handlerOf(drawSeed.seedRealCards)(env.ctx, {})) as {
      cards: number;
      inserted: number;
      updated: number;
      deleted: number;
    };
    expect(again.cards).toBe(430);
    expect(again.inserted).toBe(0);
    expect(again.updated).toBe(430);
    expect(again.deleted).toBe(0);
    // A stale row of the setVersion is swept on the next sync.
    await env.db.insert("drawCards", {
      cardId: "real_9999",
      name: "Stale Card",
      rating: 60,
      clubs: [],
      nation: "Nowhere",
      era: "≤70s",
      eraIndex: 0,
      position: "GK",
      setVersion: "real-v4",
      synthetic: false,
    });
    const sweep = (await handlerOf(drawSeed.seedRealCards)(env.ctx, {})) as { deleted: number };
    expect(sweep.deleted).toBe(1);
  });

  it("B2 replay gate accepts a completed run on a sliced board", async () => {
    const env = await makeEnv("real-v4");
    const tester = await env.db.insert("users", { username: "slice_tester" });
    const settings = env.db.rows("drawSettings")[0];
    await env.db.patch(settings._id, { enabled: false, testerUserIds: [tester] });
    actAs(tester);

    const done = await playToCompletion(env);
    // Acceptance = a result was produced by the replay gate (regenerated from
    // the PINNED slice) and no reject was recorded.
    expect(done.replayRejected).toBe(false);
    expect(done.run.outcome).not.toBeNull();
    expect(done.run.finalScore).not.toBeNull();
    const rejects = env.db
      .rows("funnelEvents")
      .filter((e) => e.type === "draw_replay_reject");
    expect(rejects).toHaveLength(0);
    const run = env.db.rows("drawRuns")[0];
    expect(run.result).toBeDefined();
    expect(run.score).toBeDefined();
  });
});
