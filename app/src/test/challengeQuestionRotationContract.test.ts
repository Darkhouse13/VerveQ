import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge question rotation contract", () => {
  it("stores source checksums in live match question snapshots and avoids tiny fixed fetch windows", () => {
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");

    expect(liveMatches).toContain("checksum?: string | null");
    expect(liveMatches).toContain("checksum: q.checksum");
    expect(liveMatches).not.toContain(".take(200)");
  });

  it("prioritizes less-used challenge questions and avoids recent pair repeats before shuffling", () => {
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");

    expect(liveMatches).toContain("getRecentChallengeQuestionChecksums");
    expect(liveMatches).toContain("usageCount");
    expect(liveMatches).toContain("recentChecksums.has");
    expect(liveMatches).toContain("selectRotatedQuestions");
  });

  it("updates source question usage stats from live challenge answers", () => {
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");

    expect(liveMatches).toContain("recordChallengeQuestionUsage");
    expect(liveMatches).toContain("timesAnswered: question.timesAnswered + 2");
    expect(liveMatches).toContain("timesCorrect: question.timesCorrect +");
    expect(liveMatches).toContain("usageCount: question.usageCount + 1");
  });

  it("serves the full normal Knowledge pool in challenge quiz while keeping Which Came First separate", () => {
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");

    expect(liveMatches).toContain("getChallengeQuestionCandidates");
    expect(liveMatches).toContain('challenge.sport === "knowledge"');
    expect(liveMatches).toContain('challenge.mode !== "came_first"');
    expect(liveMatches).toContain('difficulty of ["easy", "intermediate", "hard"]');
    expect(liveMatches).toContain('q.category !== "which_came_first"');
  });
});
