import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { pickTodaysSessionNode } from "@/lib/learn/todaysSession";
import { resolveLearnSessionSource } from "@/lib/learn/useLearnSession";
import { useLearnGrading } from "@/lib/learn/useLearnGrading";
import type { LearnAnswer, LearnQuestion } from "@/lib/learn/contract";

const { convexMutationMock } = vi.hoisted(() => ({
  convexMutationMock: vi.fn(async () => {
    throw new Error("Convex must not be reached by these tests");
  }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => convexMutationMock,
  useQuery: () => undefined,
}));

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

/**
 * Learn entry must show real data: the session starts on the user's actual
 * due/learning node (never the pipeline-proof fixture), and the dashboard
 * carries no fabricated streaks or hardcoded due counts.
 */
describe("pickTodaysSessionNode", () => {
  it("returns null while the plan is empty (Start stays disabled, no fixture fallback)", () => {
    expect(pickTodaysSessionNode([])).toBeNull();
  });

  it("prefers the node with the most due items", () => {
    expect(
      pickTodaysSessionNode([
        { id: "a", due: 0, state: "learning" },
        { id: "b", due: 3, state: "learning" },
        { id: "c", due: 1, state: "locked" },
      ]),
    ).toBe("b");
  });

  it("falls back to a learning node, then the first node", () => {
    expect(
      pickTodaysSessionNode([
        { id: "a", due: 0, state: "locked" },
        { id: "b", due: 0, state: "learning" },
      ]),
    ).toBe("b");
    expect(
      pickTodaysSessionNode([
        { id: "a", due: 0, state: "locked" },
        { id: "z", due: 0, state: "locked" },
      ]),
    ).toBe("a");
  });
});

/**
 * The runner's session source must never produce the fixture deck outside the
 * explicit dev flag: a node-less visit resolves a real due node, waits on the
 * plan, or lands on the honest empty state.
 */
describe("resolveLearnSessionSource", () => {
  it("starts the explicit node when one is requested", () => {
    expect(
      resolveLearnSessionSource({
        requestedNodeId: "geo.capitals.core",
        planNodes: undefined,
        fixturesEnabled: false,
      }),
    ).toEqual({ kind: "start", nodeId: "geo.capitals.core" });
  });

  it("waits for the plan, then resolves today's node — never the fixture", () => {
    expect(
      resolveLearnSessionSource({
        requestedNodeId: undefined,
        planNodes: undefined,
        fixturesEnabled: false,
      }),
    ).toEqual({ kind: "loading" });
    expect(
      resolveLearnSessionSource({
        requestedNodeId: undefined,
        planNodes: [{ id: "geo.capitals.core", due: 0, state: "learning" }],
        fixturesEnabled: false,
      }),
    ).toEqual({ kind: "start", nodeId: "geo.capitals.core" });
  });

  it("surfaces an honest empty state when nothing is resolvable — never the fixture", () => {
    expect(
      resolveLearnSessionSource({
        requestedNodeId: undefined,
        planNodes: [],
        fixturesEnabled: false,
      }),
    ).toEqual({ kind: "empty" });
  });

  it("serves the fixture deck only behind the dev flag", () => {
    expect(
      resolveLearnSessionSource({
        requestedNodeId: undefined,
        planNodes: [],
        fixturesEnabled: true,
      }),
    ).toEqual({ kind: "fixture" });
  });
});

describe("Learn grading live guard (behavioral)", () => {
  it("refuses to submit a non-live session to Convex", async () => {
    const { result } = renderHook(() =>
      useLearnGrading({ id: "fixture-session", live: false }),
    );
    const question: LearnQuestion = {
      id: "fx-text-wc",
      type: "text",
      subject: "World Cup lore",
      prompt: "Name the nation.",
    };
    const answer: LearnAnswer = { type: "text", text: "Brazil" };
    await expect(
      result.current.submitLearnAnswer(question, answer),
    ).rejects.toThrow(/not live/);
    expect(convexMutationMock).not.toHaveBeenCalled();
  });
});

describe("Learn session source honesty (source contract)", () => {
  const hook = read("../lib/learn/useLearnSession.ts");

  it("gates the fixture deck behind a dev-only env flag", () => {
    expect(hook).toContain("import.meta.env.DEV");
    expect(hook).toContain("VITE_LEARN_FIXTURES");
  });

  it("never serves fixtures from the ladder-error path", () => {
    // The catch around getLearnLadder must set the error state, not fixtures.
    expect(hook).not.toMatch(/catch[\s\S]{0,300}FIXTURE/);
    expect(hook).toMatch(/catch[\s\S]{0,300}ERROR_STATE/);
  });

  const grading = read("../lib/learn/useLearnGrading.ts");

  it("guards submitLearnAnswer on session.live before any Convex call", () => {
    expect(grading).toMatch(
      /submitLearnAnswer[\s\S]{0,400}if \(!session\.live\)[\s\S]{0,300}throw[\s\S]{0,600}submitRung\(/,
    );
  });
});

/**
 * All three Learn entry points (entry Start, Mastery "Start session", Review
 * "Review due") share one behavior: resolve a real node via
 * pickTodaysSessionNode, stay disabled until the plan loads, and never
 * navigate to the runner without a node.
 */
describe("Learn entry points resolve a real node (source contract)", () => {
  const screens: Record<string, string> = {
    entry: read("../pages/shell/learn/LearnEntryScreen.tsx"),
    mastery: read("../pages/shell/learn/LearnMasteryScreen.tsx"),
    review: read("../pages/shell/learn/LearnReviewScreen.tsx"),
  };

  for (const [name, src] of Object.entries(screens)) {
    it(`${name} routes through pickTodaysSessionNode, disabled until loaded`, () => {
      expect(src).toContain("pickTodaysSessionNode");
      expect(src).toContain("disabled={!todaysNode}");
      expect(src).not.toMatch(/navigate\(\s*SHELL_ROUTES\.learnRun\s*\)/);
      expect(src).not.toContain("LEARN_FIXTURE");
    });
  }
});

describe("Learn entry honesty (source contract)", () => {
  const entry = read("../pages/shell/learn/LearnEntryScreen.tsx");

  it("never starts the pipeline-proof fixture node", () => {
    expect(entry).not.toContain("LEARN_PIPELINE_PROOF_NODE_ID");
    expect(entry).not.toContain("geo.pipeline.proof");
  });

  it("carries no hardcoded streak or due-count props", () => {
    expect(entry).not.toContain("STREAK_DAYS");
    expect(entry).not.toMatch(/dueNote",\s*\{\s*count:\s*\d+\s*\}/);
  });

  it("does not fall back to fixture subjects", () => {
    expect(entry).not.toContain("LEARN_FIXTURE_SUBJECTS");
  });
});

describe("Learn route containment (source contract)", () => {
  const app = read("../App.tsx");

  it("gates the v2 learn surfaces behind a server identity", () => {
    for (const route of ["/v2/learn", "/v2/learn/run", "/v2/learn/review", "/v2/learn/mastery"]) {
      const line = app.split("\n").find((l) => l.includes(`path="${route}"`));
      expect(line, `${route} should be gated`).toContain("UsernameOnlyRoute");
    }
  });

  it("contains the v1 learn screens behind the flag", () => {
    for (const route of ["/learn/geography", "/learn/prototype"]) {
      const line = app.split("\n").find((l) => l.includes(`path="${route}"`));
      expect(line, `${route} should redirect into the v2 shell`).toContain("V2Redirect");
    }
  });
});
