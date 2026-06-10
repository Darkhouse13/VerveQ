import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { pickTodaysSessionNode } from "@/lib/learn/todaysSession";

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
