import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

describe("challenge result UX contract", () => {
  // LiveMatchScreen was removed 2026-07 with the rest of the dead Live Match
  // surface. The v1 ResultScreen kept rendering historic challenge results
  // until VerveQ ONE P3.1 retired it: nothing had navigated there with a
  // challenge result since the challenge subsystem went, and /results is now
  // a redirect. The result type keeps the variant for old data.
  it("keeps the challenge variant on the result type and retires the v1 page", () => {
    const types = readFileSync("src/types/api.ts", "utf8");
    const app = readFileSync("src/App.tsx", "utf8");

    expect(types).toContain('"challenge"');
    expect(existsSync("src/pages/ResultScreen.tsx")).toBe(false);
    expect(app).toContain('<Route path="/results" element={<LegacyRedirect to="/home#more" />} />');
    expect(app).not.toContain('api.liveMatches.createFromChallenge');
  });
});
