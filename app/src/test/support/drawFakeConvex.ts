/**
 * THE DRAW — in-memory Convex harness shared by the serving (Ticket A) and
 * adapter (Ticket C) contract suites.
 *
 * Extracted verbatim from drawServingContract.test.ts, where it was written
 * first; it is shared rather than copied so the two suites can never disagree
 * about what "the server" does. Everything under the fake is REAL: the real
 * convex/draw.ts handlers, the real frozen engine, real board generation and
 * the real dead-board oracle. Only the database and the auth check are faked.
 *
 * FakeConvexClient additionally satisfies DrawConvexClient, so the production
 * ConvexDrawApi adapter can be driven against these same handlers with no
 * network and no React.
 *
 * The auth mock is NOT here: vi.hoisted values cannot be exported across
 * modules, so each suite declares its own `vi.mock("@convex-dev/auth/server")`.
 */

import { getFunctionName, type FunctionReference } from "convex/server";

// ── minimal in-memory Convex db fake ──

export type Row = { _id: string; _creationTime: number } & Record<string, unknown>;

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
    by_shareSlug: ["shareSlug"],
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

/**
 * Routes DrawApi calls to the REAL convex/draw.ts handlers over a FakeDb.
 *
 * Two properties make this a meaningful test of the adapter rather than of a
 * stub:
 *  - Routing is by Convex function name (getFunctionName over the anyApi
 *    proxy), so a typo'd or renamed reference in the adapter throws here
 *    instead of silently resolving.
 *  - Every payload is JSON round-tripped, mimicking the wire: `undefined`
 *    fields vanish exactly as they do through a real client, so the adapter
 *    cannot pass a test by relying on an in-process object identity.
 */
export class FakeConvexClient {
  constructor(
    private readonly ctx: FakeCtx,
    private readonly routes: Record<string, Handler>,
  ) {}

  async query<T = unknown>(reference: unknown, args: Record<string, never>): Promise<T> {
    return await this.dispatch<T>(reference, args);
  }

  async mutation<T = unknown>(reference: unknown, args: Record<string, unknown>): Promise<T> {
    return await this.dispatch<T>(reference, args);
  }

  private async dispatch<T>(reference: unknown, args: Record<string, unknown>): Promise<T> {
    const name = getFunctionName(reference as FunctionReference<"query" | "mutation">);
    const handler = this.routes[name];
    if (!handler) throw new Error(`FakeConvexClient: no route for "${name}"`);
    const result = await handler(this.ctx, args);
    return (result === undefined ? undefined : JSON.parse(JSON.stringify(result))) as T;
  }
}
