import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge result UX contract", () => {
  // LiveMatchScreen was removed 2026-07 with the rest of the dead Live Match
  // surface; ResultScreen still renders historic challenge results, so its
  // challenge-vs-solo split stays pinned.
  it("treats head-to-head challenge results as challenge results, not solo quiz grades", () => {
    const resultScreen = readFileSync("src/pages/ResultScreen.tsx", "utf8");
    const types = readFileSync("src/types/api.ts", "utf8");
    const screens = JSON.parse(readFileSync("src/i18n/locales/en/screens.json", "utf8"));

    expect(types).toContain('"challenge"');
    expect(resultScreen).toContain("isChallenge");
    // i18n: the "Match Result" heading moved to a locale key; verify both the
    // key wiring and the English copy.
    expect(resultScreen).toContain("result.matchResult");
    expect(screens.result.matchResult).toBe("Match Result");
    expect(resultScreen).toContain('onClick={() => navigate("/home")}');
    expect(resultScreen).not.toContain("handleChallengeAgain");
    expect(resultScreen).not.toContain('api.liveMatches.createFromChallenge');
  });
});
