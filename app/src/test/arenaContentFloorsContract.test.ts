// The hot arena module validates configs against static content floors and
// must never import the question banks (Convex evaluates the whole bundle on
// every call: ~3 MB of banks cost ~125 ms per heartbeat/answer/room read).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  ARENA_SELECTABLE_CATEGORIES,
  categoryRoundCapacityFloor,
} from "../../convex/challengeArenas";
import { ARENA_FALLBACK_SEEDS } from "../../convex/challengeArenaSelection";
import { ARENA_FALLBACK_SEED_COUNTS } from "../../convex/lib/arenaContentFloors";

const convexDir = path.resolve(__dirname, "../../convex");

describe("arena content floors", () => {
  it("static floor counts equal the bundled fallback bank sizes", () => {
    const actual = Object.fromEntries(
      Object.entries(ARENA_FALLBACK_SEEDS).map(([k, seeds]) => [k, seeds.length]),
    );
    expect(ARENA_FALLBACK_SEED_COUNTS).toEqual(actual);
  });

  it("every fallback-backed category is selectable and uses its bank size as floor", () => {
    for (const [category, seeds] of Object.entries(ARENA_FALLBACK_SEEDS)) {
      expect(ARENA_SELECTABLE_CATEGORIES).toContain(category);
      expect(categoryRoundCapacityFloor(category)).toBe(seeds.length);
    }
  });

  it("challengeArenas.ts imports no question bank or content registry as a value", () => {
    const source = readFileSync(path.join(convexDir, "challengeArenas.ts"), "utf8");
    const valueImports = source
      .split("\n")
      .filter((line) => /^import\s/.test(line) && !/^import type\s/.test(line));
    const joined = source.match(/^import(?! type)[\s\S]*?from\s+"[^"]+";/gm) ?? [];
    for (const stmt of [...valueImports, ...joined]) {
      expect(stmt).not.toMatch(/QuestionsV\d|challengeArenaContent|challengeArenaCieContent|knowledgeQuestions|challengeArenaSelection/);
    }
  });
});
