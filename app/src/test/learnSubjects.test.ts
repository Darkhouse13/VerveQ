import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => "user_1"),
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

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

import * as learn from "../../convex/learn";
import {
  DEFAULT_LEARN_SUBJECT,
  learnSubjects,
  resolveLearnSubject,
  skillNodes,
} from "../../convex/learnSkillGraph";
import { listSubjectNodeSummaries } from "../../convex/learnLadderBuilder";
import {
  learnPath,
  resolveSelectedLearnSubject,
} from "@/lib/learn/useLearnSubject";

type RegisteredFunction = {
  _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
};

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as RegisteredFunction;
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

function makeEmptyIndexedQuery() {
  return {
    withIndex: (
      _indexName: string,
      select: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
    ) => {
      const builder = {
        eq() {
          return builder;
        },
      };
      select(builder);
      return {
        collect: async () => [],
      };
    },
  };
}

function makeCtx() {
  return {
    db: {
      query: (table: string) => {
        if (table !== "learnMastery" && table !== "learnRungReviews") {
          throw new Error(`Unexpected query table: ${table}`);
        }
        return makeEmptyIndexedQuery();
      },
    },
  };
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue("user_1");
});

/**
 * The subjects registry is the single authority on what Learn serves. Nothing
 * downstream may hardcode a subject id; everything derives from this list.
 */
describe("learn subjects registry", () => {
  it("has unique ids and a default that is the first entry", () => {
    const ids = learnSubjects.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_LEARN_SUBJECT).toBe(learnSubjects[0].id);
  });

  it("covers every skill node's subject", () => {
    const ids = new Set<string>(learnSubjects.map((s) => s.id));
    for (const node of skillNodes) {
      expect(ids.has(node.subject), `node ${node.id} has unregistered subject`).toBe(
        true,
      );
    }
  });

  it("every registered subject has at least one non-fixture node", () => {
    for (const subject of learnSubjects) {
      expect(
        listSubjectNodeSummaries(subject.id).length,
        `subject ${subject.id} has no servable nodes`,
      ).toBeGreaterThan(0);
    }
  });

  it("resolves known subjects and maps unknown/missing to the default", () => {
    expect(resolveLearnSubject("geography")).toBe("geography");
    expect(resolveLearnSubject("not-a-subject")).toBe(DEFAULT_LEARN_SUBJECT);
    expect(resolveLearnSubject(undefined)).toBe(DEFAULT_LEARN_SUBJECT);
    expect(resolveLearnSubject(null)).toBe(DEFAULT_LEARN_SUBJECT);
  });
});

describe("getLearnSubjects Convex contract", () => {
  it("lists every registry subject with playability and per-user counts", async () => {
    const result = (await handlerOf(learn.getLearnSubjects)(makeCtx(), {})) as {
      defaultSubject: string;
      subjects: Array<Record<string, unknown>>;
    };

    expect(result.defaultSubject).toBe(DEFAULT_LEARN_SUBJECT);
    expect(result.subjects.map((s) => s.subject)).toEqual(
      learnSubjects.map((s) => s.id),
    );

    const geography = result.subjects.find((s) => s.subject === "geography");
    expect(geography).toMatchObject({
      name: "Geography",
      totalNodes: 7,
      // All 7 geography nodes ship now: reveal ladders + the border-identify drill.
      playableNodes: 7,
      servable: true,
      dueCount: 0,
      learningCount: expect.any(Number),
      lockedCount: expect.any(Number),
    });

    const history = result.subjects.find((s) => s.subject === "history");
    expect(history).toMatchObject({
      name: "History",
      totalNodes: 3,
      playableNodes: 3,
      servable: true,
    });

    const science = result.subjects.find((s) => s.subject === "science");
    expect(science).toMatchObject({
      name: "Science",
      totalNodes: 3,
      playableNodes: 3,
      servable: true,
    });
  });
});

describe("getLearnReviewPlan subject resolution", () => {
  it("resolves the default subject when none is given", async () => {
    const result = (await handlerOf(learn.getLearnReviewPlan)(makeCtx(), {})) as {
      subject: string;
      nodes: unknown[];
    };
    expect(result.subject).toBe(DEFAULT_LEARN_SUBJECT);
    expect(result.nodes.length).toBeGreaterThan(0);
  });

  it("resolves unknown subjects to the default instead of an empty plan", async () => {
    const result = (await handlerOf(learn.getLearnReviewPlan)(makeCtx(), {
      subject: "not-a-subject",
    })) as { subject: string; nodes: unknown[] };
    expect(result.subject).toBe(DEFAULT_LEARN_SUBJECT);
    expect(result.nodes.length).toBeGreaterThan(0);
  });
});

/**
 * Client-side selection precedence: a requested subject wins only when the
 * server lists it; otherwise first servable, then the server default. While
 * the list loads, the request is trusted (the server resolves unknowns).
 */
describe("resolveSelectedLearnSubject", () => {
  const subjects = [
    { subject: "geography", servable: true },
    { subject: "history", servable: false },
  ];

  it("trusts the requested param while the list is loading", () => {
    expect(
      resolveSelectedLearnSubject({
        requested: "history",
        subjects: undefined,
        defaultSubject: undefined,
      }),
    ).toBe("history");
    expect(
      resolveSelectedLearnSubject({
        requested: null,
        subjects: undefined,
        defaultSubject: undefined,
      }),
    ).toBeUndefined();
  });

  it("keeps a requested subject the server lists", () => {
    expect(
      resolveSelectedLearnSubject({
        requested: "history",
        subjects,
        defaultSubject: "geography",
      }),
    ).toBe("history");
  });

  it("falls back to the first servable subject for unknown requests", () => {
    expect(
      resolveSelectedLearnSubject({
        requested: "not-a-subject",
        subjects,
        defaultSubject: "geography",
      }),
    ).toBe("geography");
    expect(
      resolveSelectedLearnSubject({
        requested: null,
        subjects,
        defaultSubject: "geography",
      }),
    ).toBe("geography");
  });

  it("uses the server default when nothing is servable yet", () => {
    expect(
      resolveSelectedLearnSubject({
        requested: null,
        subjects: [{ subject: "history", servable: false }],
        defaultSubject: "history",
      }),
    ).toBe("history");
  });
});

describe("learnPath", () => {
  it("appends the subject and extra params", () => {
    expect(learnPath("/v2/learn", "geography")).toBe(
      "/v2/learn?subject=geography",
    );
    expect(learnPath("/v2/learn/run", "geography", { node: "geo.capitals.core" }))
      .toBe("/v2/learn/run?node=geo.capitals.core&subject=geography");
    expect(learnPath("/v2/learn", undefined)).toBe("/v2/learn");
  });
});
