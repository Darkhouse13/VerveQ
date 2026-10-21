import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge rivalries v1 contract", () => {
  // The head-to-head/rivalry queries were removed with the dormant challenge
  // subsystem; getMatch keeps the versusSummary shape as an empty state so
  // legacy match views still render.
  // The liveMatches backend was purged 2026-07; the rivalry summary types
  // survive on the ResultScreen's historic challenge results.
  it("keeps the rivalry summary types the result surfaces still read", () => {
    const types = readFileSync("src/types/api.ts", "utf8");

    expect(types).toContain("currentStreak?:");
    expect(types).toContain("recentMatches?:");
  });

  it("never re-surfaces live rematches on the solo result screens", () => {
    // The v1 ResultScreen (the last place historic rivalry context rendered)
    // was retired by VerveQ ONE P3.1; the shell's solo results must not grow
    // the old rematch prompts back.
    const results = readFileSync("src/components/shell/play/result/ModeResults.tsx", "utf8");

    expect(results).not.toContain("getChallengeAgainLabel");
    expect(results).not.toContain("Get Revenge");
    expect(results).not.toContain("Defend Your Win");
    expect(results).not.toContain("Run It Back");
    expect(results).not.toContain("Best of 3?");
  });
});
