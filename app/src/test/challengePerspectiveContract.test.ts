import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("challenge perspective contract", () => {
  it("renders the current user on the left and opponent on the right during live play and round results", () => {
    const liveMatch = read("src/pages/LiveMatchScreen.tsx");

    expect(liveMatch).toContain("const leftPlayer = me;");
    expect(liveMatch).toContain("const rightPlayer = opponent;");
    expect(liveMatch).toContain("const leftRoundAnswer = match.isPlayer1 ? p1Answer : p2Answer;");
    expect(liveMatch).toContain("const rightRoundAnswer = match.isPlayer1 ? p2Answer : p1Answer;");
    expect(liveMatch).toContain("player1Total={leftRoundTotal}");
    expect(liveMatch).toContain("player2Total={rightRoundTotal}");
  });
});
