// Higher or Lower deals each run a server-only shuffled deck so a correct
// guess reads the next card instead of the whole pool (pools hold up to ~450
// facts). These tests pin what must not change: no repeats, no ties with the
// card on screen, exact "pool exhausted" endings, few reads per guess, and the
// deck never leaving the server.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => "user_1" as string | null),
}));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
}));

import * as higherLower from "../../convex/higherLower";

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

const POOL = "player_goals_league:fb_39_2020";

function seed(factCount: number, valueOf: (i: number) => number = (i) => i + 1) {
  return {
    users: [{ _id: "user_1", totalGames: 0 }],
    higherLowerPools: [
      {
        _id: "pool_1",
        externalId: POOL,
        sport: "football",
        entityType: "player",
        statKey: "player_goals",
        contextKey: "league:fb_39",
        contextLabel: "Premier League",
        factCount,
        distinctValueCount: factCount,
        minValue: 1,
        maxValue: factCount,
        season: 2020,
      },
    ],
    higherLowerFacts: Array.from({ length: factCount }, (_, i) => ({
      _id: `fact_${i}`,
      externalId: `f${i}`,
      sport: "football",
      poolKey: POOL,
      entityType: "player",
      entityId: `p${i}`,
      entityName: `Player ${i}`,
      statKey: "player_goals",
      contextKey: "league:fb_39",
      value: valueOf(i),
      season: 2020,
    })),
    sportsPlayers: [],
  } as Record<string, Row[]>;
}

const start = handlerOf(higherLower.startSession);
const guess = handlerOf(higherLower.makeGuess);
const getSession = handlerOf(higherLower.getSession);

type GuessResult = {
  correct: boolean;
  gameOver: boolean;
  endReason?: string;
  nextPlayerBName?: string;
};

/** Plays perfectly: reads the hidden value straight from the fake DB. */
async function playPerfect(db: FakeDb, sessionId: string) {
  const served: string[] = [];
  const readsPerGuess: number[] = [];
  for (let i = 0; i < 1000; i += 1) {
    const s = db.tables.higherLowerSessions.find((r) => r._id === sessionId)!;
    served.push(s.currentFactBId as string);
    const pick = (s.playerBValue as number) > (s.playerAValue as number) ? "higher" : "lower";
    const before = db.reads.docs;
    const res = (await guess({ db }, { sessionId, guess: pick })) as GuessResult;
    readsPerGuess.push(db.reads.docs - before);
    expect(res.correct).toBe(true);
    if (res.gameOver) return { served, readsPerGuess, last: res };
  }
  throw new Error("run never ended");
}

describe("Higher or Lower deck", () => {
  beforeEach(() => authMock.getAuthUserId.mockResolvedValue("user_1"));

  it("deals a deck at start and keeps it out of the client's view", async () => {
    const db = makeDb(seed(40));
    const res = (await start({ db }, { sport: "football" })) as Record<string, unknown>;
    const session = db.tables.higherLowerSessions[0];
    expect(session.deckId).toBeTruthy();
    const deck = db.tables.higherLowerDecks[0];
    expect((deck.factIds as string[]).length).toBe(38); // pool minus A and B
    expect(deck.factIds).not.toContain(session.currentFactAId);
    expect(deck.factIds).not.toContain(session.currentFactBId);
    for (const value of [res, await getSession({ db }, { sessionId: session._id })]) {
      const json = JSON.stringify(value);
      expect(json).not.toContain("deck");
      expect(json).not.toContain("playerBValue"); // the hidden answer
    }
  });

  it("serves every fact once, reads a few docs per guess, and ends exhausted", async () => {
    const db = makeDb(seed(300));
    await start({ db }, { sport: "football" });
    const sessionId = db.tables.higherLowerSessions[0]._id;
    const { served, readsPerGuess, last } = await playPerfect(db, sessionId);

    expect(new Set(served).size).toBe(served.length); // no repeats
    expect(served.length).toBe(299); // every B the pool could deal
    expect(last.endReason).toBe("pool_exhausted");
    // Deck guesses: session + pool + deck + a card or two (+ user on the last).
    const deckGuesses = readsPerGuess.slice(0, -1);
    expect(Math.max(...deckGuesses)).toBeLessThan(15);
    // The deck is gone once the run is over.
    expect(db.tables.higherLowerDecks).toHaveLength(0);
  });

  it("never deals a card that ties the one on screen", async () => {
    // Only 3 distinct values: ties are everywhere.
    const db = makeDb(seed(60, (i) => (i % 3) + 1));
    await start({ db }, { sport: "football" });
    const sessionId = db.tables.higherLowerSessions[0]._id;
    for (let i = 0; i < 200; i += 1) {
      const s = db.tables.higherLowerSessions.find((r) => r._id === sessionId)!;
      expect(s.playerBValue).not.toBe(s.playerAValue);
      const pick = (s.playerBValue as number) > (s.playerAValue as number) ? "higher" : "lower";
      const res = (await guess({ db }, { sessionId, guess: pick })) as GuessResult;
      if (res.gameOver) return;
    }
    throw new Error("run never ended");
  });

  it("after the first start, a start reads the pool catalog instead of every pool", async () => {
    const tables = seed(50);
    // 300 extra pools nobody picks (an unknown context, so "easy" skips them).
    for (let i = 0; i < 300; i += 1) {
      tables.higherLowerPools.push({ ...tables.higherLowerPools[0], _id: `pool_x${i}`, externalId: `x${i}`, contextKey: "league:fb_999" });
    }
    const db = makeDb(tables);
    await start({ db }, { sport: "football", difficulty: "easy" });
    expect(db.tables.higherLowerPoolCatalogs).toHaveLength(1);
    const before = db.reads.docs;
    await start({ db }, { sport: "football", difficulty: "easy" });
    // user + catalog + the pool's 50 facts + pool + photos — not 301 pools.
    expect(db.reads.docs - before).toBeLessThan(60);
    expect(db.tables.higherLowerSessions[1].currentFullContextKey).toBe(POOL);
  });

  it("still works for runs started before decks existed", async () => {
    const db = makeDb(seed(30));
    await start({ db }, { sport: "football" });
    const session = db.tables.higherLowerSessions[0];
    delete session.deckId;
    delete session.deckPos;
    db.tables.higherLowerDecks = [];
    const { served, last } = await playPerfect(db, session._id);
    expect(new Set(served).size).toBe(served.length);
    expect(last.endReason).toBe("pool_exhausted");
  });

  it("drops the deck on a wrong guess and on leaving", async () => {
    const db = makeDb(seed(20));
    await start({ db }, { sport: "football" });
    let s = db.tables.higherLowerSessions[0];
    const wrong = (s.playerBValue as number) > (s.playerAValue as number) ? "lower" : "higher";
    const res = (await guess({ db }, { sessionId: s._id, guess: wrong })) as GuessResult;
    expect(res.gameOver).toBe(true);
    expect(db.tables.higherLowerDecks).toHaveLength(0);

    await start({ db }, { sport: "football" });
    s = db.tables.higherLowerSessions[1];
    expect(db.tables.higherLowerDecks).toHaveLength(1);
    await handlerOf(higherLower.penalizeTabSwitch)({ db }, { sessionId: s._id });
    expect(db.tables.higherLowerDecks).toHaveLength(0);
  });
});
