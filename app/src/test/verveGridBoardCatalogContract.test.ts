// Verve Grid start draws from a small per-sport catalog of playable board ids
// instead of reading every board (~1.6k docs, ~2.6 MB on prod). The draw must
// stay the same: only playable boards, the requested tier (widening toward
// "hard"), and a working start when the catalog is missing or stale.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => "user_1" as string | null),
}));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
}));

import * as verveGrid from "../../convex/verveGrid";

type Row = Record<string, unknown> & { _id: string };

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as { _handler?: (ctx: unknown, args: unknown) => Promise<unknown> };
  if (typeof registered._handler !== "function") throw new Error("not a Convex function");
  return registered._handler;
}

const INDEX_FIELD: Record<string, string> = {
  by_external_id: "externalId",
  by_pool_key: "poolKey",
  by_sport: "sport",
};

type FakeDb = {
  reads: { docs: number };
  tables: Record<string, Row[]>;
};

function makeDb(tables: Record<string, Row[]>) {
  let nextId = 1;
  const reads = { docs: 0 };
  const all = () => Object.values(tables).flat();
  const db = {
    reads,
    tables,
    async get(id: string) {
      reads.docs += 1;
      return all().find((r) => r._id === id) ?? null;
    },
    async insert(table: string, doc: Record<string, unknown>) {
      const _id = `${table}_${nextId++}`;
      (tables[table] ??= []).push({ ...doc, _id });
      return _id;
    },
    async patch(id: string, fields: Record<string, unknown>) {
      const row = all().find((r) => r._id === id);
      if (!row) throw new Error(`patch: missing ${id}`);
      Object.assign(row, fields);
    },
    async delete(id: string) {
      for (const rows of Object.values(tables)) {
        const i = rows.findIndex((r) => r._id === id);
        if (i >= 0) rows.splice(i, 1);
      }
    },
    query(table: string) {
      const rows = () => tables[table] ?? [];
      let filtered: Row[] | null = null;
      const api = {
        withIndex(name: string, build: (q: { eq: (f: string, v: unknown) => unknown }) => unknown) {
          let field = INDEX_FIELD[name];
          let value: unknown;
          const q = {
            eq(f: string, v: unknown) {
              field = f;
              value = v;
              return q;
            },
          };
          build(q);
          filtered = rows().filter((r) => r[field] === value);
          return api;
        },
        async first() {
          const list = filtered ?? rows();
          if (list[0]) reads.docs += 1;
          return list[0] ?? null;
        },
        async collect() {
          const list = filtered ?? rows();
          reads.docs += list.length;
          return [...list];
        },
      };
      return api;
    },
  };
  return db;
}

function board(i: number, difficulty: string | undefined, playable = true): Row {
  return {
    _id: `board_${i}`,
    externalId: `b${i}`,
    sport: "football",
    templateId: `t${i}`,
    axisFamily: "club_nation",
    difficulty,
    score: 1,
    rows: [0, 1, 2].map((r) => ({ type: "club", key: `c${r}`, label: `Club ${r}` })),
    cols: [0, 1, 2].map((c) => ({ type: "nation", key: `n${c}`, label: `Nation ${c}` })),
    cells: Array.from({ length: 9 }, (_, k) => ({
      rowIdx: Math.floor(k / 3),
      colIdx: k % 3,
      validPlayerIds: playable || k > 0 ? [`p${i}_${k}`] : [],
    })),
  };
}

function seed(): Record<string, Row[]> {
  const boards: Row[] = [];
  for (let i = 0; i < 40; i += 1) boards.push(board(i, i % 2 ? "easy" : "hard"));
  boards.push(board(100, "easy", false)); // unplayable: an empty cell
  return { users: [{ _id: "user_1", totalGames: 0 }], verveGridBoards: boards };
}

const start = handlerOf(verveGrid.startSession);

function ctxOf(db: FakeDb) {
  const scheduled: unknown[] = [];
  return { ctx: { db, scheduler: { runAfter: async (...a: unknown[]) => void scheduled.push(a) } }, scheduled };
}

describe("Verve Grid board catalog", () => {
  beforeEach(() => authMock.getAuthUserId.mockResolvedValue("user_1"));

  it("first start reads every board and writes the catalog; later starts read a few docs", async () => {
    const db = makeDb(seed());
    const { ctx } = ctxOf(db);
    await start(ctx, { sport: "football", difficulty: "easy" });
    const catalog = db.tables.verveGridBoardCatalogs[0];
    expect((catalog.entries as unknown[]).length).toBe(40); // the unplayable board is left out

    const before = db.reads.docs;
    await start(ctx, { sport: "football", difficulty: "easy" });
    expect(db.reads.docs - before).toBeLessThan(6);
  });

  it("serves only the requested tier, and never an unplayable board", async () => {
    const db = makeDb(seed());
    const { ctx } = ctxOf(db);
    for (let i = 0; i < 60; i += 1) {
      await start(ctx, { sport: "football", difficulty: "easy" });
    }
    const sessions = db.tables.verveGridSessions;
    for (const s of sessions) {
      expect(s.difficulty).toBe("easy");
      const n = Number(String(s.boardTemplateId).slice(1));
      expect(n % 2).toBe(1); // easy boards are the odd ones
      expect(n).not.toBe(100);
    }
  });

  it("falls back to the full read when the drawn board is gone, and asks for a rebuild", async () => {
    const db = makeDb(seed());
    const { ctx, scheduled } = ctxOf(db);
    await start(ctx, { sport: "football", difficulty: "hard" });
    db.tables.verveGridBoards = db.tables.verveGridBoards.filter((b) => b._id === "board_0");
    for (let i = 0; i < 5; i += 1) await start(ctx, { sport: "football", difficulty: "hard" });
    for (const s of db.tables.verveGridSessions.slice(1)) expect(s.boardTemplateId).toBe("t0");
    expect(scheduled.length).toBeGreaterThan(0);
  });

  it("rebuildBoardCatalog replaces the catalog", async () => {
    const db = makeDb(seed());
    const { ctx } = ctxOf(db);
    await start(ctx, { sport: "football" });
    db.tables.verveGridBoards.push(board(200, "easy"));
    await handlerOf(verveGrid.rebuildBoardCatalog)(ctx, { sport: "football" });
    expect(db.tables.verveGridBoardCatalogs).toHaveLength(1);
    expect((db.tables.verveGridBoardCatalogs[0].entries as unknown[]).length).toBe(41);
  });
});
