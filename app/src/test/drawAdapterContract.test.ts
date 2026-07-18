/**
 * ConvexDrawApi adapter contract (Ticket C, Step 3).
 *
 * Ticket B's sanitization / ordering / share suites were written against the
 * LocalMockApi. This file re-runs those same guarantees against the PRODUCTION
 * adapter, backed by Ticket A's in-memory db fake — real convex/draw.ts
 * handlers, real frozen engine, real board generation, real dead-board oracle.
 * Only the database, the auth check and the network are faked.
 *
 * What this is here to prove: the rename layer (offers→currentRow,
 * boardReveal.rows→fullBoard, …) preserves sanitization and choice semantics
 * end-to-end. A rename that widened a payload — or a "helpful" client-side
 * derivation creeping into the adapter — fails here rather than on the wire.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeConvexClient,
  FakeDb,
  handlerOf,
  type Handler,
} from "./support/drawFakeConvex";

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
import { ConvexDrawApi, DrawReplayRejectedError } from "@/lib/drawApi";
import type { DrawRunView } from "@/lib/drawApi/types";
import { boardNumberForDate, nextBoardAtForDate } from "../../convex/lib/drawDaily";
import { getTodayUTC } from "../../convex/lib/daily";
import { DRAW_ACTIVE_CONFIG } from "../../convex/drawSeed";

// ── harness ──

interface Env {
  db: FakeDb;
  api: ConvexDrawApi;
  userId: string;
  today: string;
}

function routes(): Record<string, Handler> {
  return {
    "draw:getToday": handlerOf(draw.getToday),
    "draw:ensureToday": handlerOf(draw.ensureToday),
    "draw:startRun": handlerOf(draw.startRun),
    "draw:submitChoice": handlerOf(draw.submitChoice),
    "draw:getLeaderboard": handlerOf(draw.getLeaderboard),
    "draw:getRarity": handlerOf(draw.getRarity),
    "draw:getStreak": handlerOf(draw.getStreak),
  };
}

async function makeEnv(): Promise<Env> {
  const db = new FakeDb();
  const ctx = { db, auth: {} as Record<string, never> };
  await handlerOf(drawSeed.seedSyntheticCards)(ctx, {});
  const settings = db.rows("drawSettings")[0];
  const userId = await db.insert("users", {
    username: "adapter_user",
    displayName: "adapter_user",
  });
  await db.patch(settings._id, { enabled: true, testerUserIds: [] });
  authMock.getAuthUserId.mockResolvedValue(userId);
  return {
    db,
    api: new ConvexDrawApi(new FakeConvexClient(ctx, routes())),
    userId,
    today: getTodayUTC(),
  };
}

/** All keys reachable anywhere in a JSON value (B's deep-scan helper). */
function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.add(k);
      collectKeys(v, out);
    }
  }
  return out;
}

async function draftAll(env: Env): Promise<DrawRunView> {
  let view = await env.api.startRun();
  while (view.phase === "draft") {
    view = await env.api.submitChoice({ type: "pick", offerIndex: 0 });
  }
  return view;
}

async function finishRun(env: Env): Promise<DrawRunView> {
  let view = await draftAll(env);
  while (view.phase !== "done") {
    view =
      view.phase === "bench"
        ? await env.api.submitChoice({ type: "bench", squadIndex: 0 })
        : await env.api.submitChoice({ type: "push" });
  }
  return view;
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue(null);
});

// ── sanitization, through the rename layer ──

describe("adapter sanitization contract", () => {
  it("never leaks a board seed — in any phase, in either seed format", async () => {
    const env = await makeEnv();
    const seen: unknown[] = [await env.api.getToday()];
    let view = await env.api.startRun();
    seen.push(view);
    while (view.phase === "draft") {
      view = await env.api.submitChoice({ type: "pick", offerIndex: 0 });
      seen.push(view);
    }
    seen.push(await env.api.submitChoice({ type: "bench", squadIndex: 0 }));
    seen.push(await finishRun(env));

    const boardSeed = env.db.rows("drawDailyBoards")[0].boardSeed as string;
    for (const value of seen) {
      const keys = collectKeys(value);
      expect(keys.has("seed")).toBe(false);
      expect(keys.has("boardSeed")).toBe(false);
      const json = JSON.stringify(value);
      expect(json).not.toContain(boardSeed);
      // Ticket C, 2c: the server's canonical scheme `draw|<dateKey>|k<k>` is
      // server-only, and the mock's dev-only `draw-<dateKey>#<k>` must never
      // appear in adapter output either. Scan for BOTH formats.
      expect(json).not.toMatch(/draw\|\d{4}-\d{2}-\d{2}\|k\d+/);
      expect(json).not.toMatch(/draw-\d{4}-\d{2}-\d{2}#\d+/);
    }
  });

  it("exposes the current draft row only — offers→currentRow, never a future row", async () => {
    const env = await makeEnv();
    let view = await env.api.startRun();
    const board = env.db.rows("drawDailyBoards")[0].board as {
      rows: Array<Array<{ id: string }>>;
    };

    for (let row = 0; row < DRAW_ACTIVE_CONFIG.rows; row++) {
      expect(view.phase).toBe("draft");
      // The rename preserves identity AND order of the server's offers.
      expect(view.currentRow!.map((c) => c.id)).toEqual(board.rows[row].map((c) => c.id));
      expect(view.fullBoard).toBeNull();

      // Nothing from a row the player has not reached is anywhere in the view.
      const json = JSON.stringify(view);
      const futureIds = board.rows
        .slice(row + 1)
        .flat()
        .map((c) => c.id)
        .filter((id) => !view.squad.some((s) => s.id === id));
      for (const id of futureIds) expect(json).not.toContain(`"${id}"`);

      view = await env.api.submitChoice({ type: "pick", offerIndex: 0 });
    }
    expect(view.currentRow).toBeNull();
  });

  it("reveals no form before a round resolves, and only in played breakdowns after", async () => {
    const env = await makeEnv();
    let view = await env.api.startRun();
    while (view.phase === "draft") {
      expect(collectKeys(view).has("form")).toBe(false);
      view = await env.api.submitChoice({ type: "pick", offerIndex: 0 });
    }
    // Bench phase, round not yet resolved: still no form anywhere.
    expect(view.rounds).toHaveLength(0);
    expect(collectKeys(view).has("form")).toBe(false);

    view = await env.api.submitChoice({ type: "bench", squadIndex: 0 });
    expect(view.rounds).toHaveLength(1);
    // Exactly the 5 fielded cards of the resolved round carry form.
    expect(view.rounds[0].cards).toHaveLength(5);
    for (const card of view.rounds[0].cards) expect(card.form).toBeGreaterThan(0);
  });

  it("reveals the full board only once done — boardReveal.rows→fullBoard", async () => {
    const env = await makeEnv();
    const view = await finishRun(env);
    expect(view.phase).toBe("done");
    expect(view.outcome).not.toBeNull();

    const board = env.db.rows("drawDailyBoards")[0].board as {
      rows: Array<Array<{ id: string }>>;
    };
    expect(view.fullBoard).toHaveLength(DRAW_ACTIVE_CONFIG.rows);
    expect(view.fullBoard!.map((r) => r.map((c) => c.id))).toEqual(
      board.rows.map((r) => r.map((c) => c.id)),
    );
    // The reveal is the rows only — the seed is still absent.
    expect(collectKeys(view).has("seed")).toBe(false);
  });
});

// ── choice ordering, through the adapter ──

describe("adapter choice ordering contract", () => {
  it("walks draft → bench → decision, rejecting out-of-phase and out-of-range choices", async () => {
    const env = await makeEnv();
    let view = await env.api.startRun();
    expect(view.phase).toBe("draft");

    await expect(env.api.submitChoice({ type: "bench", squadIndex: 0 })).rejects.toThrow();
    await expect(env.api.submitChoice({ type: "bank" })).rejects.toThrow();
    await expect(env.api.submitChoice({ type: "pick", offerIndex: 99 })).rejects.toThrow();

    // A rejected submission consumed nothing — the server persisted no choice.
    view = await env.api.startRun();
    expect(view.rowIndex).toBe(0);
    expect(view.squad).toHaveLength(0);

    for (let row = 0; row < DRAW_ACTIVE_CONFIG.rows; row++) {
      expect(view.rowIndex).toBe(row);
      view = await env.api.submitChoice({ type: "pick", offerIndex: 0 });
      expect(view.squad).toHaveLength(row + 1);
    }
    expect(view.phase).toBe("bench");

    await expect(env.api.submitChoice({ type: "pick", offerIndex: 0 })).rejects.toThrow();
    await expect(env.api.submitChoice({ type: "push" })).rejects.toThrow();
    await expect(env.api.submitChoice({ type: "bench", squadIndex: 6 })).rejects.toThrow();

    view = await env.api.submitChoice({ type: "bench", squadIndex: 0 });
    expect(view.rounds).toHaveLength(1);
    expect(view.rounds[0].fixtureIndex).toBe(0);
  });

  it("plays rounds in fixture order and refuses anything after done", async () => {
    const env = await makeEnv();
    const view = await finishRun(env);
    view.rounds.forEach((round, i) => {
      expect(round.fixtureIndex).toBe(i);
      expect(round.benchedCardId).toBeTruthy();
    });
    expect(view.outcome).not.toBeNull();
    expect(view.finalScore).not.toBeNull();

    await expect(env.api.submitChoice({ type: "bank" })).rejects.toThrow(/finished/);
    await expect(env.api.submitChoice({ type: "pick", offerIndex: 0 })).rejects.toThrow(
      /finished/,
    );
  });

  it("a duplicate/out-of-order pick after the draft is rejected, run intact", async () => {
    const env = await makeEnv();
    const drafted = await draftAll(env);
    expect(drafted.squad).toHaveLength(DRAW_ACTIVE_CONFIG.rows);

    await expect(env.api.submitChoice({ type: "pick", offerIndex: 0 })).rejects.toThrow();

    const run = env.db.rows("drawRuns")[0];
    expect((run.choiceLog as unknown[]).length).toBe(DRAW_ACTIVE_CONFIG.rows);
    const resumed = await env.api.startRun();
    expect(resumed.squad.map((c) => c.id)).toEqual(drafted.squad.map((c) => c.id));
  });
});

// ── the rest of the rename map ──

describe("adapter rename map", () => {
  it("getToday serves board meta the client renders without deriving anything", async () => {
    const env = await makeEnv();
    // No board row exists yet (the cron hasn't run): the adapter's lazy
    // ensureToday path must generate it rather than surfacing "not ready".
    expect(env.db.rows("drawDailyBoards")).toHaveLength(0);

    const today = await env.api.getToday();
    expect(env.db.rows("drawDailyBoards")).toHaveLength(1);

    expect(today.dateKey).toBe(env.today);
    // boardNumber is the SERVER's value, not client epoch math (Ticket C, 2b).
    expect(today.boardNumber).toBe(boardNumberForDate(env.today));
    expect(today.nextBoardAt).toBe(nextBoardAtForDate(env.today));
    expect(today.playState).toBe("unplayed");
    expect(today.streak).toBe(0);
    expect(today.fixtures).toHaveLength(DRAW_ACTIVE_CONFIG.fixtureCount);
    expect(today.fixtures[today.fixtures.length - 1].isBoss).toBe(true);
    // rules is the served config projection — and nothing more of the config.
    //
    // Ticket F widened this by two knobs: formSpread and maxSynergyFamilies
    // are now part of the CLIENT contract, because F3's projected band cannot
    // be computed without them (see convexApi.ts#rulesView). Note what did NOT
    // change: the SERVER still sends neither — the adapter fills both from the
    // pinned config — so this is a change to what the client contract carries,
    // not to what crosses the wire.
    //
    // Why that is safe, and why the old "tuning knobs stay server-side" framing
    // was never what protected form: the ENGINE SHIPS IN THE CLIENT BUNDLE.
    // formFor, scoreRound and generateBoard all run in the browser (the mock
    // plays whole boards there), so C13V1_CONFIG — formSpread included — is
    // already sitting in the JS the player downloads. The only thing that makes
    // form unknowable before a round resolves is the BOARD SEED, which is
    // server-only and stays so. Knowing form is uniform on [1-f, 1+f] reveals
    // nothing about any particular draw from it; knowing the seed would reveal
    // every one. The seed assertions below are the ones with teeth.
    expect(today.rules).toEqual({
      rows: DRAW_ACTIVE_CONFIG.rows,
      offersPerRow: DRAW_ACTIVE_CONFIG.offersPerRow,
      fixtureCount: DRAW_ACTIVE_CONFIG.fixtureCount,
      synergyTable: DRAW_ACTIVE_CONFIG.synergyTable,
      bustKeep: DRAW_ACTIVE_CONFIG.bustKeep,
      fullClearBonus: DRAW_ACTIVE_CONFIG.fullClearBonus,
      formSpread: DRAW_ACTIVE_CONFIG.formSpread,
      maxSynergyFamilies: DRAW_ACTIVE_CONFIG.maxSynergyFamilies,
      // Ticket G3 (c13-2): the hint reliability and the clearance-signal
      // bucket cutoffs are published rules — same logic as formSpread above:
      // per-card hints stay server-computed (the seed is what protects them).
      hintReliability: DRAW_ACTIVE_CONFIG.hints!.hintReliability,
      clearance: DRAW_ACTIVE_CONFIG.clearance,
    });
    // The board-generation knobs stay out of the client contract entirely:
    // these WOULD narrow the board, and nothing in the UI needs them.
    const keys = collectKeys(today);
    expect(keys.has("archetypes")).toBe(false);
    expect(keys.has("cardGen")).toBe(false);
    expect(keys.has("ratingSkew")).toBe(false);
  });

  it("getToday tracks playState across the run; run views carry the server boardNumber", async () => {
    const env = await makeEnv();
    await env.api.startRun();
    expect((await env.api.getToday()).playState).toBe("in_progress");

    const done = await finishRun(env);
    expect(done.boardNumber).toBe(boardNumberForDate(env.today));
    const after = await env.api.getToday();
    expect(after.playState).toBe("done");
    expect(after.streak).toBe(1);
  });

  it("passes status/draftLineHash through and drops the choice log", async () => {
    const env = await makeEnv();
    const view = await finishRun(env);
    expect(["banked", "busted", "fullclear"]).toContain(view.status);
    expect(view.status).toBe(view.outcome);
    expect(view.draftLineHash).toBe("000000");
    // The server's internal echo of the log is not part of the UI contract.
    expect(collectKeys(view).has("choiceLog")).toBe(false);
  });

  it("getLeaderboard flattens entries, marks isYou by rank, and drops userId", async () => {
    const env = await makeEnv();
    await finishRun(env);

    const board = await env.api.getLeaderboard();
    expect(board.length).toBeGreaterThanOrEqual(1);
    expect(board[0].rank).toBe(1);
    expect(board[0].isYou).toBe(true);
    expect(board[0].name).toBe("adapter_user");
    expect(["banked", "busted", "fullclear"]).toContain(board[0].outcome);
    // The server's rows carry userId; the client contract must not.
    expect(collectKeys(board).has("userId")).toBe(false);
    expect(collectKeys(board).has("roundsCleared")).toBe(false);
  });

  it("marks isYou on the caller's row only, among several players", async () => {
    const env = await makeEnv();
    await finishRun(env);

    // A second player finishes the same deterministic line ⇒ same score; the
    // earlier completion (ours) takes rank 1 on the tie.
    const other = await env.db.insert("users", {
      username: "other_player",
      displayName: "other_player",
    });
    authMock.getAuthUserId.mockResolvedValue(other);
    await finishRun(env);

    authMock.getAuthUserId.mockResolvedValue(env.userId);
    const board = await env.api.getLeaderboard();
    expect(board).toHaveLength(2);
    expect(board.filter((e) => e.isYou)).toHaveLength(1);
    expect(board.find((e) => e.isYou)!.name).toBe("adapter_user");
    expect(board.find((e) => e.name === "other_player")!.isYou).toBeUndefined();
  });

  it("getRarity maps sharePct→linePercent; getStreak drops lastPlayedDateKey", async () => {
    const env = await makeEnv();
    await finishRun(env);

    const rarity = await env.api.getRarity();
    // Sole player on this line so far ⇒ 100% of completed runs drafted it.
    expect(rarity.linePercent).toBe(100);
    // Ticket F (F6): total → population. This is exactly the n=1 case the
    // suppression exists for — the adapter still reports the honest 100%, and
    // the population it now carries is what stops the UI from printing it.
    expect(Object.keys(rarity).sort()).toEqual(["linePercent", "population"]);
    expect(rarity.population).toBe(1);

    const streak = await env.api.getStreak();
    expect(streak).toEqual({ current: 1, best: 1 });
  });

  it("getRarity refuses before the draft completes (no line to be rare)", async () => {
    const env = await makeEnv();
    await env.api.startRun();
    await expect(env.api.getRarity()).rejects.toThrow(/completed draft/);
  });
});

// ── the replay gate, surfaced (not swallowed) ──

describe("adapter replay gate", () => {
  it("throws DrawReplayRejectedError instead of silently returning stale state", async () => {
    const env = await makeEnv();
    let view = await draftAll(env);

    // Tamper with the stored snapshot: the completion replay against a fresh
    // regeneration must disagree and refuse to write a result (A's B2 gate).
    const boardRow = env.db.rows("drawDailyBoards")[0];
    const board = boardRow.board as {
      rows: Array<Array<{ id: string; rating: number }>>;
    };
    const squadCardId = view.squad[1].id;
    for (const row of board.rows) {
      for (const card of row) if (card.id === squadCardId) card.rating += 40;
    }
    await env.db.patch(boardRow._id, { board });

    let rejected = false;
    try {
      while (view.phase !== "done") {
        view =
          view.phase === "bench"
            ? await env.api.submitChoice({ type: "bench", squadIndex: 0 })
            : await env.api.submitChoice({ type: "push" });
      }
    } catch (error) {
      rejected = error instanceof DrawReplayRejectedError;
    }
    expect(rejected).toBe(true);

    // No result was written, and the reject left its audit event.
    const run = env.db.rows("drawRuns")[0];
    expect(run.score).toBeUndefined();
    expect(run.result).toBeUndefined();
    expect(run.completedAt).toBeUndefined();
    expect(
      env.db.rows("funnelEvents").filter((e) => e.type === "draw_replay_reject"),
    ).toHaveLength(1);
  });
});

// ── share content, built from adapter output ──

describe("adapter share content", () => {
  it("share text from an adapter-served run leaks no card name", async () => {
    const env = await makeEnv();
    const view = await finishRun(env);
    const { buildShareText, buildTrail, buildIdentity } = await import(
      "@/components/draw/share"
    );

    const text = buildShareText({
      boardNumber: view.boardNumber,
      outcome: view.outcome!,
      trail: buildTrail(view.rounds, view.outcome!),
      identity: buildIdentity(view.rounds),
      score: view.finalScore!,
      url: "https://verveq.com/draw",
      rarity: { linePercent: 4.2, population: 500 },
    });

    expect(text).toContain(`THE DRAW #${boardNumberForDate(env.today)}`);
    // HARD RULE (share.ts): no card name may reach share content. Checked
    // against the whole served card set, not just this run's squad.
    for (const card of env.db.rows("drawCards")) {
      expect(text).not.toContain(card.name as string);
    }
  });
});
