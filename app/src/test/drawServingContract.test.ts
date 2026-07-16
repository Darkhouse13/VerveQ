/**
 * THE DRAW — Convex serving layer contract (Ticket A acceptance).
 *
 * Covers: the drawSettings flag gate (enabled=false blocks non-testers),
 * one-run-per-day enforcement, payload sanitization (no boardSeed / future
 * rows / pre-resolution form in any pre-completion payload), the B2 replay
 * gate rejecting a tampered board, reroll determinism (same dateKey ⇒ same
 * board across regenerations), and streak continuity incl. gap reset.
 *
 * Runs the real convex/draw.ts handlers against an in-memory db fake (the
 * house pattern — see dailyChallengeAttemptContract.test.ts), with the real
 * engine, real board generation, and the real dead-board oracle underneath.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { DRAW_DISABLED_MESSAGE, nextDrawStreak } from "../../convex/draw";
import * as drawSeed from "../../convex/drawSeed";
import * as drawBoards from "../../convex/drawBoards";
import {
  computeDailyBoard,
  dailyBoardSeed,
  loadCardSet,
} from "../../convex/drawBoards";
import { DRAW_ACTIVE_CONFIG } from "../../convex/drawSeed";
import { getTodayUTC } from "../../convex/lib/daily";

// ── minimal in-memory Convex db fake ──

type Row = { _id: string; _creationTime: number } & Record<string, unknown>;

const INDEXES: Record<string, Record<string, string[]>> = {
  drawCards: {
    by_setVersion: ["setVersion"],
    by_setVersion_cardId: ["setVersion", "cardId"],
  },
  drawSettings: {},
  drawDailyBoards: { by_dateKey: ["dateKey"] },
  drawRuns: {
    by_user_date: ["userId", "dateKey"],
    by_date_score: ["dateKey", "score"],
  },
  drawStreaks: { by_user: ["userId"] },
  funnelEvents: {
    by_type_ts: ["type", "ts"],
    by_actor_type: ["actor", "type"],
  },
  users: { by_username: ["username"] },
};

function compareValues(a: unknown, b: unknown): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return -1; // undefined sorts lowest, like Convex
  if (b === undefined) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

class FakeDb {
  private tables = new Map<string, Map<string, Row>>();
  private counter = 0;

  table(name: string): Map<string, Row> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  rows(name: string): Row[] {
    return [...this.table(name).values()];
  }

  async insert(table: string, doc: Record<string, unknown>): Promise<string> {
    this.counter += 1;
    const _id = `${table};${this.counter}`;
    this.table(table).set(_id, { ...doc, _id, _creationTime: this.counter });
    return _id;
  }

  async get(id: string): Promise<Row | null> {
    const table = id.split(";")[0];
    return this.table(table).get(id) ?? null;
  }

  async patch(id: string, fields: Record<string, unknown>): Promise<void> {
    const row = await this.get(id);
    if (!row) throw new Error(`patch: no row ${id}`);
    Object.assign(row, fields);
  }

  async replace(id: string, doc: Record<string, unknown>): Promise<void> {
    const row = await this.get(id);
    if (!row) throw new Error(`replace: no row ${id}`);
    const { _id, _creationTime } = row;
    for (const key of Object.keys(row)) delete row[key];
    Object.assign(row, doc, { _id, _creationTime });
  }

  async delete(id: string): Promise<void> {
    const table = id.split(";")[0];
    this.table(table).delete(id);
  }

  query(table: string) {
    const filters: Array<{ op: "eq" | "gte" | "lte"; field: string; value: unknown }> = [];
    let indexFields: string[] = [];
    let desc = false;

    const matches = (row: Row): boolean =>
      filters.every(({ op, field, value }) => {
        const actual = row[field];
        if (op === "eq") return actual === value;
        if (op === "gte") return compareValues(actual, value) >= 0;
        return compareValues(actual, value) <= 0;
      });

    const sorted = (): Row[] => {
      const out = this.rows(table).filter(matches);
      out.sort((a, b) => {
        for (const field of indexFields) {
          const cmp = compareValues(a[field], b[field]);
          if (cmp !== 0) return cmp;
        }
        return a._creationTime - b._creationTime;
      });
      if (desc) out.reverse();
      return out;
    };

    const rangeBuilder = {
      eq(field: string, value: unknown) {
        filters.push({ op: "eq", field, value });
        return rangeBuilder;
      },
      gte(field: string, value: unknown) {
        filters.push({ op: "gte", field, value });
        return rangeBuilder;
      },
      lte(field: string, value: unknown) {
        filters.push({ op: "lte", field, value });
        return rangeBuilder;
      },
      lt(field: string, value: unknown) {
        filters.push({ op: "lte", field, value });
        return rangeBuilder;
      },
    };

    const builder = {
      withIndex(name: string, cb?: (q: typeof rangeBuilder) => unknown) {
        indexFields = INDEXES[table]?.[name] ?? [];
        if (cb) cb(rangeBuilder);
        return builder;
      },
      order(direction: "asc" | "desc") {
        desc = direction === "desc";
        return builder;
      },
      async first() {
        return sorted()[0] ?? null;
      },
      async collect() {
        return sorted();
      },
      async take(n: number) {
        return sorted().slice(0, n);
      },
    };
    return builder;
  }
}

// ── harness ──

type Handler = (ctx: unknown, args: unknown) => Promise<unknown>;

function handlerOf<T>(fn: T): Handler {
  const registered = fn as { _handler?: Handler };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

interface Env {
  db: FakeDb;
  ctx: { db: FakeDb; auth: Record<string, never> };
  settingsId: string;
  today: string;
}

async function makeEnv(): Promise<Env> {
  const db = new FakeDb();
  const ctx = { db, auth: {} as Record<string, never> };
  await handlerOf(drawSeed.seedSyntheticCards)(ctx, {});
  const settings = db.rows("drawSettings")[0];
  return { db, ctx, settingsId: settings._id, today: getTodayUTC() };
}

async function makeUser(env: Env, username: string): Promise<string> {
  return env.db.insert("users", { username, displayName: username });
}

function actAs(userId: string | null) {
  authMock.getAuthUserId.mockResolvedValue(userId);
}

async function enable(env: Env, testerUserIds: string[] = [], enabled = true) {
  await env.db.patch(env.settingsId, { enabled, testerUserIds });
}

interface RunViewLike {
  phase: string;
  status: string;
  rowIndex: number;
  fixtureIndex: number;
  offers: Array<{ id: string }> | null;
  squad: Array<{ id: string }>;
  rounds: Array<{ cleared: boolean; cards: Array<{ form: number }> }>;
  outcome: string | null;
  finalScore: number | null;
  boardReveal: { rows: Array<Array<{ id: string }>> } | null;
  draftLineHash: string | null;
}

interface SubmitResult {
  replayRejected: boolean;
  run: RunViewLike;
}

async function startRun(env: Env): Promise<RunViewLike> {
  return (await handlerOf(draw.startRun)(env.ctx, {})) as RunViewLike;
}

async function submit(env: Env, choice: unknown): Promise<SubmitResult> {
  return (await handlerOf(draw.submitChoice)(env.ctx, { choice })) as SubmitResult;
}

/** Drive a fresh run to completion: draft offer 0 six times, bench 0, push. */
async function playToCompletion(env: Env): Promise<SubmitResult> {
  let view = await startRun(env);
  let last: SubmitResult = { replayRejected: false, run: view };
  while (view.phase === "draft") {
    last = await submit(env, { type: "pick", offerIndex: 0 });
    view = last.run;
  }
  while (view.phase !== "done") {
    if (view.phase === "bench") {
      last = await submit(env, { type: "bench", squadIndex: 0 });
    } else {
      last = await submit(env, { type: "push" });
    }
    view = last.run;
  }
  return last;
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue(null);
});

// ── flag gate ──

describe("drawSettings flag gate", () => {
  it("blocks non-testers while disabled, admits testers, opens when enabled", async () => {
    const env = await makeEnv();
    const tester = await makeUser(env, "qa_draw_tester");
    const outsider = await makeUser(env, "regular_player");

    // Seeding creates the singleton DISABLED with no testers.
    const settings = env.db.rows("drawSettings")[0];
    expect(settings.enabled).toBe(false);
    expect(settings.testerUserIds).toEqual([]);

    actAs(outsider);
    await expect(handlerOf(draw.getToday)(env.ctx, {})).rejects.toThrow(
      DRAW_DISABLED_MESSAGE,
    );
    await expect(handlerOf(draw.startRun)(env.ctx, {})).rejects.toThrow(
      DRAW_DISABLED_MESSAGE,
    );

    // Tester allowlist admits while still disabled.
    await enable(env, [tester], false);
    actAs(tester);
    const today = (await handlerOf(draw.getToday)(env.ctx, {})) as { dateKey: string };
    expect(today.dateKey).toBe(env.today);
    actAs(outsider);
    await expect(handlerOf(draw.getToday)(env.ctx, {})).rejects.toThrow(
      DRAW_DISABLED_MESSAGE,
    );

    // enabled=true opens it for everyone.
    await enable(env, []);
    const opened = (await handlerOf(draw.getToday)(env.ctx, {})) as { dateKey: string };
    expect(opened.dateKey).toBe(env.today);

    // No auth at all is always rejected.
    actAs(null);
    await expect(handlerOf(draw.getToday)(env.ctx, {})).rejects.toThrow(
      "Sign in required",
    );
  });
});

// ── reroll determinism (B1 / P0-runtime) ──

describe("daily board generation", () => {
  it("is deterministic: same dateKey ⇒ identical board across regenerations", async () => {
    const env = await makeEnv();
    const cardSet = await loadCardSet(env.ctx as never, "synthetic-v1");
    const first = computeDailyBoard("2026-07-16", cardSet, DRAW_ACTIVE_CONFIG);
    const second = computeDailyBoard("2026-07-16", cardSet, DRAW_ACTIVE_CONFIG);
    expect(second.boardSeed).toBe(first.boardSeed);
    expect(second.rerollIndex).toBe(first.rerollIndex);
    expect(JSON.stringify(second.board)).toBe(JSON.stringify(first.board));
    expect(first.boardSeed).toBe(dailyBoardSeed("2026-07-16", first.rerollIndex));
    // Different date ⇒ different chain.
    const other = computeDailyBoard("2026-07-17", cardSet, DRAW_ACTIVE_CONFIG);
    expect(other.boardSeed).not.toBe(first.boardSeed);
  });

  it("upserts idempotently: cron + lazy generation never duplicate a dateKey", async () => {
    const env = await makeEnv();
    const cron = handlerOf(drawBoards.generateTodaysBoard);
    const a = (await cron(env.ctx, {})) as { created: boolean; boardSeed: string };
    const b = (await cron(env.ctx, {})) as { created: boolean; boardSeed: string };
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.boardSeed).toBe(a.boardSeed);
    expect(env.db.rows("drawDailyBoards")).toHaveLength(1);

    // Regenerating after a wipe lands on the identical board (pure function
    // of the date), so a lost row can never fork the day's leaderboard.
    const row = env.db.rows("drawDailyBoards")[0];
    const boardJson = JSON.stringify(row.board);
    await env.db.delete(row._id);
    const c = (await cron(env.ctx, {})) as { created: boolean; boardSeed: string };
    expect(c.created).toBe(true);
    expect(c.boardSeed).toBe(a.boardSeed);
    expect(JSON.stringify(env.db.rows("drawDailyBoards")[0].board)).toBe(boardJson);
  });
});

// ── one run per user per dateKey ──

describe("one-run-per-day enforcement", () => {
  it("startRun returns the existing run instead of creating a second", async () => {
    const env = await makeEnv();
    await enable(env);
    const user = await makeUser(env, "one_run_user");
    actAs(user);

    await startRun(env);
    expect(env.db.rows("drawRuns")).toHaveLength(1);
    await submit(env, { type: "pick", offerIndex: 1 });

    // A second startRun resumes — same row, progress intact.
    const resumed = await startRun(env);
    expect(env.db.rows("drawRuns")).toHaveLength(1);
    expect(resumed.rowIndex).toBe(1);
    expect(resumed.squad).toHaveLength(1);
  });

  it("a finished run stays finished: no restart, no further choices", async () => {
    const env = await makeEnv();
    await enable(env);
    const user = await makeUser(env, "finished_user");
    actAs(user);

    const final = await playToCompletion(env);
    expect(final.run.phase).toBe("done");
    expect(env.db.rows("drawRuns")).toHaveLength(1);

    await expect(submit(env, { type: "pick", offerIndex: 0 })).rejects.toThrow(
      "Run is finished",
    );
    const after = await startRun(env);
    expect(after.phase).toBe("done");
    expect(env.db.rows("drawRuns")).toHaveLength(1);
  });
});

// ── sanitization (B3) ──

describe("payload sanitization", () => {
  it("never leaks boardSeed, future rows, or pre-resolution form", async () => {
    const env = await makeEnv();
    await enable(env);
    const user = await makeUser(env, "sanitize_user");
    actAs(user);

    let view = await startRun(env);
    const boardDoc = env.db.rows("drawDailyBoards")[0];
    const board = boardDoc.board as {
      seed: string;
      rows: Array<Array<{ id: string }>>;
    };
    const boardSeed = boardDoc.boardSeed as string;
    const row0Ids = board.rows[0].map((c) => c.id);
    const futureIds = board.rows
      .slice(1)
      .flat()
      .map((c) => c.id)
      .filter((id) => !row0Ids.includes(id));
    expect(futureIds.length).toBeGreaterThan(0);

    const assertSanitizedPreCompletion = (payload: unknown, rowsResolved: number) => {
      const json = JSON.stringify(payload);
      expect(json).not.toContain(boardSeed);
      expect(json).not.toContain('"seed"');
      // Form appears ONLY inside resolved round breakdowns.
      const formCount = (json.match(/"form":/g) ?? []).length;
      expect(formCount).toBe(rowsResolved * 5); // 5 fielded cards per resolved round
    };

    // Draft phase: exactly the current row's 3 offers; future rows absent.
    expect(view.offers?.map((c) => c.id)).toEqual(row0Ids);
    let json = JSON.stringify(view);
    for (const id of futureIds) expect(json).not.toContain(`"${id}"`);
    assertSanitizedPreCompletion(view, 0);

    // getToday during draft: same guarantees.
    const today = (await handlerOf(draw.getToday)(env.ctx, {})) as { run: RunViewLike };
    json = JSON.stringify(today);
    expect(json).not.toContain(boardSeed);
    for (const id of futureIds) expect(json).not.toContain(`"${id}"`);

    // Draft through: each step exposes only that row's offers.
    for (let row = 0; row < 6; row++) {
      const expectedIds = board.rows[row].map((c) => c.id);
      expect(view.offers?.map((c) => c.id)).toEqual(expectedIds);
      view = (await submit(env, { type: "pick", offerIndex: 0 })).run;
    }

    // Bench phase (pre-resolution): no offers, no reveal, no form anywhere.
    expect(view.phase).toBe("bench");
    expect(view.offers).toBeNull();
    expect(view.boardReveal).toBeNull();
    assertSanitizedPreCompletion(view, 0);

    // Resolve round 1: form now appears in the post-resolution breakdown
    // for the 5 fielded cards of that round — and nowhere else.
    view = (await submit(env, { type: "bench", squadIndex: 0 })).run;
    expect(view.rounds.length).toBe(1);
    if (view.phase !== "done") {
      assertSanitizedPreCompletion(view, 1);
      expect(view.boardReveal).toBeNull();
    }

    // Finish the run; post-completion the full board reveal is allowed —
    // but the seed still never is.
    while (view.phase !== "done") {
      view =
        view.phase === "bench"
          ? (await submit(env, { type: "bench", squadIndex: 0 })).run
          : (await submit(env, { type: "push" })).run;
    }
    expect(view.boardReveal).not.toBeNull();
    expect(view.boardReveal!.rows.flat().length).toBe(18);
    json = JSON.stringify(view);
    expect(json).not.toContain(boardSeed);
    expect(json).not.toContain('"seed"');
  });
});

// ── replay gate (B2) ──

describe("replay gate", () => {
  it("rejects a run whose stored snapshot was tampered (score manipulation)", async () => {
    const env = await makeEnv();
    await enable(env);
    const user = await makeUser(env, "tamper_user");
    actAs(user);

    let view = await startRun(env);
    while (view.phase === "draft") {
      view = (await submit(env, { type: "pick", offerIndex: 0 })).run;
    }

    // Tamper: inflate a fielded squad card's rating in the STORED snapshot —
    // the only server-side artifact a score forger could aim at, since the
    // client never submits scores. All later scoring reads the snapshot; the
    // completion replay against the REGENERATED board must disagree.
    const boardRow = env.db.rows("drawDailyBoards")[0];
    const board = boardRow.board as {
      rows: Array<Array<{ id: string; rating: number }>>;
    };
    const squadCardId = view.squad[1].id;
    for (const row of board.rows) {
      for (const card of row) {
        if (card.id === squadCardId) card.rating = card.rating + 40;
      }
    }
    await env.db.patch(boardRow._id, { board });

    // Play to what would be completion; the completing choice must be
    // rejected by the gate instead of writing a result.
    let final: SubmitResult | null = null;
    while (view.phase !== "done") {
      const res =
        view.phase === "bench"
          ? await submit(env, { type: "bench", squadIndex: 0 })
          : await submit(env, { type: "push" });
      if (res.replayRejected) {
        final = res;
        break;
      }
      view = res.run;
    }

    expect(final).not.toBeNull();
    expect(final!.replayRejected).toBe(true);

    // No result was written; the run did not reach a terminal status.
    const run = env.db.rows("drawRuns")[0];
    expect(run.score).toBeUndefined();
    expect(run.result).toBeUndefined();
    expect(run.completedAt).toBeUndefined();
    expect(["drafting", "running"]).toContain(run.status);

    // The reject left an audit event.
    const rejects = env.db
      .rows("funnelEvents")
      .filter((e) => e.type === "draw_replay_reject");
    expect(rejects).toHaveLength(1);
    expect((rejects[0].meta as { dateKey: string }).dateKey).toBe(env.today);
  });

  it("accepts an untampered completion and writes the replay-verified result", async () => {
    const env = await makeEnv();
    await enable(env);
    const user = await makeUser(env, "honest_user");
    actAs(user);

    const final = await playToCompletion(env);
    expect(final.replayRejected).toBe(false);
    expect(final.run.phase).toBe("done");
    expect(final.run.outcome).not.toBeNull();

    const run = env.db.rows("drawRuns")[0];
    expect(run.score).toBe(final.run.finalScore);
    expect(run.completedAt).toBeDefined();
    expect(["banked", "busted", "fullclear"]).toContain(run.status);
    expect(run.draftLineHash).toBe("000000");

    // Outcome funnel event fired exactly once.
    const outcomes = env.db
      .rows("funnelEvents")
      .filter((e) =>
        ["draw_bank", "draw_bust", "draw_fullclear"].includes(e.type as string),
      );
    expect(outcomes).toHaveLength(1);
    const starts = env.db.rows("funnelEvents").filter((e) => e.type === "draw_start");
    expect(starts).toHaveLength(1);
    const picks = env.db.rows("funnelEvents").filter((e) => e.type === "draw_pick");
    expect(picks).toHaveLength(6);
  });
});

// ── streaks (B5) ──

describe("draw streaks", () => {
  it("nextDrawStreak: start, continue, gap-reset, same-day no-op", () => {
    expect(nextDrawStreak(null, "2026-07-16")).toEqual({
      current: 1,
      best: 1,
      lastPlayedDateKey: "2026-07-16",
    });
    // Consecutive UTC dateKeys extend (including across a month boundary).
    expect(
      nextDrawStreak(
        { current: 3, best: 5, lastPlayedDateKey: "2026-06-30" },
        "2026-07-01",
      ),
    ).toEqual({ current: 4, best: 5, lastPlayedDateKey: "2026-07-01" });
    // A gap resets to 1 but best survives.
    expect(
      nextDrawStreak(
        { current: 5, best: 5, lastPlayedDateKey: "2026-07-10" },
        "2026-07-16",
      ),
    ).toEqual({ current: 1, best: 5, lastPlayedDateKey: "2026-07-16" });
    // Same day (or stored future day — skew guard) never changes anything.
    expect(
      nextDrawStreak(
        { current: 2, best: 2, lastPlayedDateKey: "2026-07-16" },
        "2026-07-16",
      ),
    ).toBeNull();
    expect(
      nextDrawStreak(
        { current: 2, best: 2, lastPlayedDateKey: "2026-07-17" },
        "2026-07-16",
      ),
    ).toBeNull();
  });

  it("completion advances the streak: continue from yesterday, reset after a gap", async () => {
    const env = await makeEnv();
    await enable(env);

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const longAgo = new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10);

    // Continuity: played yesterday ⇒ today makes it 4.
    const contUser = await makeUser(env, "streak_cont");
    await env.db.insert("drawStreaks", {
      userId: contUser,
      current: 3,
      best: 3,
      lastPlayedDateKey: yesterday,
    });
    actAs(contUser);
    await playToCompletion(env);
    const cont = env.db.rows("drawStreaks").find((s) => s.userId === contUser)!;
    expect(cont.current).toBe(4);
    expect(cont.best).toBe(4);
    expect(cont.lastPlayedDateKey).toBe(env.today);

    // Gap: last played 4 days ago ⇒ reset to 1, best preserved.
    const gapUser = await makeUser(env, "streak_gap");
    await env.db.insert("drawStreaks", {
      userId: gapUser,
      current: 7,
      best: 9,
      lastPlayedDateKey: longAgo,
    });
    actAs(gapUser);
    await playToCompletion(env);
    const gap = env.db.rows("drawStreaks").find((s) => s.userId === gapUser)!;
    expect(gap.current).toBe(1);
    expect(gap.best).toBe(9);

    // First-ever completion creates the row at 1.
    const newUser = await makeUser(env, "streak_new");
    actAs(newUser);
    await playToCompletion(env);
    const fresh = env.db.rows("drawStreaks").find((s) => s.userId === newUser)!;
    expect(fresh.current).toBe(1);
    expect(fresh.best).toBe(1);

    // getStreak reports the live value for a fresh completion.
    const streakView = (await handlerOf(draw.getStreak)(env.ctx, {})) as {
      current: number;
      best: number;
    };
    expect(streakView.current).toBe(1);
  });
});

// ── leaderboard + rarity (B4 smoke) ──

describe("leaderboard and rarity", () => {
  it("ranks completed runs (ties by earlier finish) and reports line share", async () => {
    const env = await makeEnv();
    await enable(env);

    const alpha = await makeUser(env, "lb_alpha");
    const beta = await makeUser(env, "lb_beta");
    actAs(alpha);
    await playToCompletion(env);
    actAs(beta);
    await playToCompletion(env);

    // Same deterministic line ⇒ same score; earlier completion wins the tie.
    const lb = (await handlerOf(draw.getLeaderboard)(env.ctx, {})) as {
      total: number;
      entries: Array<{ rank: number; userId: string; score: number }>;
      me: { rank: number } | null;
    };
    expect(lb.total).toBe(2);
    expect(lb.entries[0].userId).toBe(alpha);
    expect(lb.entries[1].userId).toBe(beta);
    expect(lb.entries[0].score).toBe(lb.entries[1].score);
    expect(lb.me?.rank).toBe(2);

    const rarity = (await handlerOf(draw.getRarity)(env.ctx, {})) as {
      count: number;
      total: number;
      sharePct: number;
    };
    expect(rarity.total).toBe(2);
    expect(rarity.count).toBe(2);
    expect(rarity.sharePct).toBe(100);
  });
});
