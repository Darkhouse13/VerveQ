import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The question-selection/rotation contracts were removed with the dormant
// challenge subsystem (no live-match creation path remains). What survives is
// the usage-stat recording that still runs while legacy matches finish.
describe("challenge question rotation contract", () => {
  it("updates source question usage stats from live challenge answers", () => {
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");

    expect(liveMatches).toContain("recordChallengeQuestionUsage");
    expect(liveMatches).toContain("timesAnswered: question.timesAnswered + 2");
    expect(liveMatches).toContain("timesCorrect: question.timesCorrect +");
    expect(liveMatches).toContain("usageCount: question.usageCount + 1");
  });
});
