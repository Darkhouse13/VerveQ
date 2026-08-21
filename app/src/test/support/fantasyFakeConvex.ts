/**
 * Weekend Fantasy — in-memory Convex harness for the FW-1 contract suites.
 *
 * Same house pattern as test/support/drawFakeConvex.ts: only the database and
 * the auth check are faked, and the REAL convex/fantasySquads.ts and
 * convex/fantasyLocks.ts handlers run on top, with the real pure rule modules
 * underneath. A test that passes here exercises the shipped lock engine.
 *
 * Deliberately a separate file rather than an import of the DRAW harness: the
 * DRAW files are frozen for this ticket, and generalizing one to serve two
 * modes would couple THE DRAW's test suite to fantasy schema changes. The
 * duplication is the cheaper of the two costs (approved, FW-1 Phase 0).
 *
 * The auth mock is NOT here — vi.hoisted values cannot cross a module
 * boundary, so each suite declares its own vi.mock("@convex-dev/auth/server").
 */

export type Row = { _id: string; _creationTime: number } & Record<string, unknown>;

/** Mirrors the index definitions in convex/schema.ts for the fantasy tables. */
const INDEXES: Record<string, Record<string, string[]>> = {
  fantasyGameweeks: {
    by_season_gwNumber: ["season", "gwNumber"],
    by_status: ["status"],
  },
  fantasyFixtures: {
    by_gameweek_kickoff: ["gameweekId", "kickoffAt"],
    by_gameweek_home: ["gameweekId", "homeClubId"],
    by_gameweek_away: ["gameweekId", "awayClubId"],
    by_providerFixtureId: ["providerFixtureId"],
  },
  fantasyPlayers: {
    by_providerPlayerId: ["providerPlayerId"],
    by_club: ["clubId"],
    by_active_club: ["active", "clubId"],
  },
  fantasySquads: {
    by_user_gameweek_contextKey: ["userId", "gameweekId", "contextKey"],
    by_gameweek: ["gameweekId"],
    by_user: ["userId"],
  },
  fantasySquadSlots: {
    by_squad: ["squadId"],
    by_squad_slotIndex: ["squadId", "slotIndex"],
    by_player: ["playerId"],
  },
  // FW-3 draft-room tables (schema.ts §THE WEEKEND crew draft rooms).
  fantasyCrews: { by_code: ["code"] },
  fantasyCrewMembers: {
    by_crew: ["crewId"],
    by_user: ["userId"],
    by_crew_user: ["crewId", "userId"],
  },
  fantasyDraftQueues: {
    by_room_user: ["roomId", "userId"],
    by_room: ["roomId"],
  },
  fantasyCrewAlerts: {
    by_crew_created: ["crewId", "createdAt"],
    by_crew_dedupe: ["crewId", "dedupeKey"],
  },
  fantasyDraftRooms: {
    by_crew: ["crewId"],
    by_crew_gameweek: ["crewId", "gameweekId"],
    by_status: ["status"],
  },
  fantasyDraftLog: {
    by_room_seq: ["roomId", "seq"],
    by_room_player: ["roomId", "playerId"],
  },
  fantasyDraftPoolMeta: { by_player: ["playerId"] },
  // FW-4 scoring pipeline tables (schema.ts §THE WEEKEND scoring execution
  // pipeline).
  fantasyFixtureStats: {
    by_fixture_player_revision: ["fixtureId", "providerPlayerId", "revision"],
    by_gameweek: ["gameweekId"],
  },
  fantasyPlayerScores: {
    by_fixture_player_version: ["fixtureId", "providerPlayerId", "version"],
    by_gameweek_player_version: ["gameweekId", "providerPlayerId", "version"],
    by_gameweek_state: ["gameweekId", "state"],
    by_player: ["providerPlayerId"],
  },
  // FW-SCOUT player detail sheet tables (schema.ts §WEEKEND FANTASY: player
  // detail sheet).
  fantasyPlayerSeasonStats: {
    by_player_season: ["providerPlayerId", "season"],
    by_season: ["season"],
  },
  fantasySeasonStatSweeps: { by_status: ["status"] },
  // FW-AVAIL availability report (schema.ts §fantasyPlayerAvailability).
  fantasyPlayerAvailability: {
    by_gameweek_player: ["gameweekId", "playerId"],
    by_gameweek_league: ["gameweekId", "leagueId"],
    by_gameweek: ["gameweekId"],
    by_player: ["playerId"],
  },
  fantasyAvailabilityCoverage: {
    by_gameweek_league: ["gameweekId", "leagueId"],
    by_gameweek: ["gameweekId"],
  },
  fantasyFixtureScoring: {
    by_fixture: ["fixtureId"],
    by_gameweek_state: ["gameweekId", "state"],
  },
  fantasyGameweekScoring: {
    by_gameweek: ["gameweekId"],
    by_state: ["state"],
  },
  // FW-RECEIPT: the settlement-stamped percentile rollup.
  fantasyGameweekPercentiles: {
    by_squad: ["squadId"],
    by_gameweek: ["gameweekId"],
  },
  // O2 crowd voting tables (schema.ts §WEEKEND FANTASY: crowd voting).
  fantasyCrowdPairs: {
    by_user_gameweek: ["userId", "gameweekId"],
    by_user_gameweek_pairKey: ["userId", "gameweekId", "pairKey"],
    by_gameweek_status: ["gameweekId", "status"],
  },
  fantasyCrowdRatings: {
    by_gameweek_player: ["gameweekId", "playerId"],
    by_gameweek: ["gameweekId"],
  },
  fantasyCrowdRaterStats: {
    by_user: ["userId"],
    by_gameweek_user: ["gameweekId", "userId"],
  },
  // O3 reclamation-court tables (schema.ts §WEEKEND FANTASY: reclamation court).
  fantasyCourtClaims: {
    by_gameweek_status: ["gameweekId", "status"],
    by_gameweek_claimKey: ["gameweekId", "providerPlayerId", "fixtureId", "claimedPosition"],
    by_filer_gameweek: ["filedBy", "gameweekId"],
  },
  fantasyCourtEndorsements: {
    by_claim_user: ["claimId", "userId"],
    by_claim: ["claimId"],
  },
  fantasyCourtVotes: {
    by_claim_user: ["claimId", "userId"],
    by_claim: ["claimId"],
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

export class FakeDb {
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

  /**
   * Mirrors ctx.db.normalizeId: an id string is valid for a table only if it
   * belongs to that table, and null otherwise. Ids here are `table;n`, so the
   * prefix carries the same information a real Convex id encodes — which
   * matters because getRoom/getDraftPool take a bare string from the client
   * and this is the check that rejects a hand-made one.
   */
  normalizeId(table: string, id: string): string | null {
    return id.startsWith(`${table};`) && this.table(table).has(id) ? id : null;
  }

  async patch(id: string, fields: Record<string, unknown>): Promise<void> {
    const row = await this.get(id);
    if (!row) throw new Error(`patch: no row ${id}`);
    // Convex removes a field patched to undefined; mirror that so a test can
    // never pass on a key that would have vanished in production.
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) delete row[key];
      else row[key] = value;
    }
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
    /** Post-index predicates from `.filter()`. See filterBuilder below. */
    const predicates: Array<(row: Row) => boolean> = [];
    let indexFields: string[] = [];
    let desc = false;

    const matches = (row: Row): boolean =>
      filters.every(({ op, field, value }) => {
        const actual = row[field];
        if (op === "eq") return actual === value;
        if (op === "gte") return compareValues(actual, value) >= 0;
        return compareValues(actual, value) <= 0;
      }) && predicates.every((predicate) => predicate(row));

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

    /**
     * The `.filter()` expression vocabulary, enough for what the fantasy
     * handlers actually use.
     *
     * `q.field(name)` returns an accessor rather than a value, because the real
     * Convex builder composes expressions before it ever sees a row — and the
     * one filter FW-4's finalization pass depends on is
     * `q.eq(q.field("supersededByVersion"), undefined)`, i.e. "the row has no
     * such field". Modelling `field` as an accessor is what makes that work
     * against a missing key rather than throwing.
     */
    type Accessor = (row: Row) => unknown;
    const asAccessor = (value: unknown): Accessor =>
      typeof value === "function" ? (value as Accessor) : () => value;
    const filterBuilder = {
      field: (name: string): Accessor => (row: Row) => row[name],
      eq: (left: unknown, right: unknown) => (row: Row) =>
        asAccessor(left)(row) === asAccessor(right)(row),
      neq: (left: unknown, right: unknown) => (row: Row) =>
        asAccessor(left)(row) !== asAccessor(right)(row),
      gt: (left: unknown, right: unknown) => (row: Row) =>
        compareValues(asAccessor(left)(row), asAccessor(right)(row)) > 0,
      gte: (left: unknown, right: unknown) => (row: Row) =>
        compareValues(asAccessor(left)(row), asAccessor(right)(row)) >= 0,
      lt: (left: unknown, right: unknown) => (row: Row) =>
        compareValues(asAccessor(left)(row), asAccessor(right)(row)) < 0,
      lte: (left: unknown, right: unknown) => (row: Row) =>
        compareValues(asAccessor(left)(row), asAccessor(right)(row)) <= 0,
      and:
        (...parts: Array<(row: Row) => boolean>) =>
        (row: Row) =>
          parts.every((part) => part(row)),
      or:
        (...parts: Array<(row: Row) => boolean>) =>
        (row: Row) =>
          parts.some((part) => part(row)),
      not:
        (part: (row: Row) => boolean) =>
        (row: Row) =>
          !part(row),
    };

    const builder = {
      filter(expression: (q: typeof filterBuilder) => (row: Row) => boolean) {
        predicates.push(expression(filterBuilder));
        return builder;
      },
      withIndex(name: string, cb?: (q: typeof rangeBuilder) => unknown) {
        const known = INDEXES[table]?.[name];
        if (known === undefined) {
          // A typo'd or unregistered index would otherwise silently degrade to
          // a full scan and let a broken query pass.
          throw new Error(`FakeDb: no index "${name}" on table "${table}"`);
        }
        indexFields = known;
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

// ── handler access ──

export type Handler = (ctx: unknown, args: unknown) => Promise<unknown>;

/** Unwrap a Convex registered function to the raw handler the fake ctx drives. */
export function handlerOf<T>(fn: T): Handler {
  const registered = fn as { _handler?: Handler };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

export type FakeCtx = { db: FakeDb; auth: Record<string, never> };

export function makeCtx(db: FakeDb = new FakeDb()): FakeCtx {
  return { db, auth: {} as Record<string, never> };
}

// ── world builders ──
//
// A readable weekend: two clubs playing Saturday, two playing Sunday, so the
// partial-lock cases the spec cares about ("editing Sunday around a locked
// Saturday") are one helper call away.

export const SATURDAY = Date.UTC(2026, 8, 12, 14, 0); // 2026-09-12 14:00Z
export const SUNDAY = Date.UTC(2026, 8, 13, 14, 0); // 2026-09-13 14:00Z

export interface World {
  db: FakeDb;
  ctx: FakeCtx;
  userId: string;
  gameweekId: string;
  /** clubId -> kickoff instant of that club's fixture. */
  kickoffByClub: Record<string, number>;
  /** Every seeded player id, by a readable handle. */
  players: Record<string, string>;
}

/**
 * Seed a gameweek with six clubs across three fixtures, and a pool of priced
 * players.
 *
 * SAT_A/SAT_B and SAT_C/SAT_D kick off Saturday; SUN_A/SUN_B kick off Sunday,
 * so "editing Sunday around a locked Saturday" is one helper call away.
 *
 * Six clubs rather than four is deliberate: with a per-club cap of 3, four
 * clubs cap a squad at 12 players and no legal squad could ever be filled
 * without leaning on the favorite-club exemption — which would quietly turn
 * every full-squad test into an exemption test.
 *
 * Each club gets six players (twice the cap) at price 5.0, so a full 13 costs
 * 65.0 against the 100.0 placeholder budget and ordinary edits stay inside it.
 */
export async function seedWorld(
  opts: { gwNumber?: number; status?: string; price?: number | null } = {},
): Promise<World> {
  const { gwNumber = 3, status = "upcoming", price = 5.0 } = opts;
  const db = new FakeDb();
  const ctx = makeCtx(db);

  const userId = await db.insert("users", { username: "tester" });
  const gameweekId = await db.insert("fantasyGameweeks", {
    season: "2026-2027",
    gwNumber,
    leagueIds: [39],
    status,
    finalityAt: SUNDAY + 2 * 86_400_000,
  });

  const fixtures = [
    { id: "f-sat-1", home: "SAT_A", away: "SAT_B", kickoffAt: SATURDAY },
    { id: "f-sat-2", home: "SAT_C", away: "SAT_D", kickoffAt: SATURDAY },
    { id: "f-sun-1", home: "SUN_A", away: "SUN_B", kickoffAt: SUNDAY },
  ];

  const kickoffByClub: Record<string, number> = {};
  for (const fixture of fixtures) {
    kickoffByClub[fixture.home] = fixture.kickoffAt;
    kickoffByClub[fixture.away] = fixture.kickoffAt;
    await db.insert("fantasyFixtures", {
      gameweekId,
      leagueId: 39,
      providerFixtureId: fixture.id,
      kickoffAt: fixture.kickoffAt,
      status: "scheduled",
      homeClubId: fixture.home,
      awayClubId: fixture.away,
    });
  }

  const players: Record<string, string> = {};
  for (const clubId of Object.keys(kickoffByClub)) {
    for (let i = 1; i <= 6; i += 1) {
      const handle = `${clubId}_${i}`;
      players[handle] = await db.insert("fantasyPlayers", {
        providerPlayerId: handle,
        name: handle,
        clubId,
        leagueId: 39,
        feedPosition: i === 1 ? "GK" : i <= 3 ? "DEF" : i <= 5 ? "MID" : "ATT",
        price,
        active: true,
      });
    }
  }

  return { db, ctx, userId, gameweekId, kickoffByClub, players };
}

/** Saturday clubs, in seed order. */
export const SATURDAY_CLUBS = ["SAT_A", "SAT_B", "SAT_C", "SAT_D"] as const;
/** Sunday clubs, in seed order. */
export const SUNDAY_CLUBS = ["SUN_A", "SUN_B"] as const;

/** A standard 4-4-2 with two ATT finishers — the shape most tests start from. */
export const FOUR_FOUR_TWO = { GK: 1, DEF: 4, MID: 4, ATT: 2 };
export const TWO_ATT_FINISHERS = ["ATT", "ATT"] as const;
