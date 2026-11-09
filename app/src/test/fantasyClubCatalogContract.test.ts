// The favorite-club picker list is precomputed into one doc so
// getFavoriteClub stops reading every fantasyPlayers row per call. Pins:
// same list as the full read, no rewrite when nothing changed, and the
// query touches only the catalog once it exists.
import { describe, expect, it, vi } from "vitest";

vi.mock("@convex-dev/auth/server", () => ({ getAuthUserId: vi.fn(async () => null) }));

import * as fantasySquads from "../../convex/fantasySquads";

type Row = Record<string, unknown> & { _id: string };

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as { _handler?: (ctx: unknown, args: unknown) => Promise<unknown> };
  if (typeof registered._handler !== "function") throw new Error("not a Convex function");
  return registered._handler;
}

function makeDb(tables: Record<string, Row[]>) {
  let nextId = 1;
  const reads: Record<string, number> = {};
  const writes = { count: 0 };
  const db = {
    reads,
    writes,
    tables,
    async get(id: string) {
      return Object.values(tables).flat().find((r) => r._id === id) ?? null;
    },
    async insert(table: string, doc: Record<string, unknown>) {
      writes.count += 1;
      const _id = `${table}_${nextId++}`;
      (tables[table] ??= []).push({ ...doc, _id });
      return _id;
    },
    async patch(id: string, fields: Record<string, unknown>) {
      writes.count += 1;
      Object.assign(Object.values(tables).flat().find((r) => r._id === id)!, fields);
    },
    query(table: string) {
      const rows = tables[table] ?? [];
      return {
        async first() {
          reads[table] = (reads[table] ?? 0) + (rows[0] ? 1 : 0);
          return rows[0] ?? null;
        },
        async collect() {
          reads[table] = (reads[table] ?? 0) + rows.length;
          return [...rows];
        },
      };
    },
  };
  return db;
}

function seed() {
  return {
    fantasyPlayers: [
      { _id: "p1", clubId: "c40", leagueId: 39, active: true },
      { _id: "p2", clubId: "c33", leagueId: 39, active: true },
      { _id: "p3", clubId: "c529", leagueId: 140, active: true },
      { _id: "p4", clubId: "c999", leagueId: 39, active: false },
    ],
    fantasyDraftPoolMeta: [
      { _id: "m1", playerId: "p1", clubName: "Liverpool" },
      { _id: "m2", playerId: "p2", clubName: "Manchester United" },
    ],
  } as Record<string, Row[]>;
}

const rebuild = handlerOf(fantasySquads.rebuildClubCatalog);
const getFavoriteClub = handlerOf(fantasySquads.getFavoriteClub);

describe("favorite-club catalog", () => {
  it("serves the same club list as the full read", async () => {
    const db = makeDb(seed());
    const before = (await getFavoriteClub({ db }, {})) as { clubs: unknown[] };
    await rebuild({ db }, {});
    const after = (await getFavoriteClub({ db }, {})) as { clubs: unknown[] };
    expect(after.clubs).toEqual(before.clubs);
    expect(after.clubs).toEqual([
      { clubId: "c40", name: "Liverpool", leagueId: 39 },
      { clubId: "c33", name: "Manchester United", leagueId: 39 },
      { clubId: "c529", name: "c529", leagueId: 140 },
    ]);
  });

  it("reads only the catalog once it exists", async () => {
    const db = makeDb(seed());
    await rebuild({ db }, {});
    for (const k of Object.keys(db.reads)) delete db.reads[k];
    await getFavoriteClub({ db }, {});
    expect(db.reads.fantasyPlayers ?? 0).toBe(0);
    expect(db.reads.fantasyDraftPoolMeta ?? 0).toBe(0);
  });

  it("does not rewrite the doc when nothing changed, and does when a club appears", async () => {
    const db = makeDb(seed());
    await rebuild({ db }, {});
    const w = db.writes.count;
    expect(await rebuild({ db }, {})).toMatchObject({ changed: false });
    expect(db.writes.count).toBe(w);
    db.tables.fantasyPlayers.push({ _id: "p5", clubId: "c50", leagueId: 39, active: true });
    expect(await rebuild({ db }, {})).toMatchObject({ changed: true, clubs: 4 });
  });
});
