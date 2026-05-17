import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge result UX contract", () => {
  it("treats head-to-head challenge results as challenge results, not solo quiz grades", () => {
    const liveMatch = readFileSync("src/pages/LiveMatchScreen.tsx", "utf8");
    const resultScreen = readFileSync("src/pages/ResultScreen.tsx", "utf8");
    const types = readFileSync("src/types/api.ts", "utf8");

    expect(types).toContain('"challenge"');
    expect(liveMatch).toContain('mode: "challenge"');
    expect(resultScreen).toContain("isChallenge");
    expect(resultScreen).toContain("Match Result");
    expect(resultScreen).toContain('navigate("/challenge")');
    expect(resultScreen).toContain('isChallenge ? navigate("/challenge") : navigate(`/sport-select?mode=${state.mode}`)');
  });
});
