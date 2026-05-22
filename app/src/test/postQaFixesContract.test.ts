import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("post-QA regression contracts", () => {
  it("Daily Quiz stops the live question query before navigating to completed results", () => {
    const source = read("src/pages/DailyQuizScreen.tsx");
    expect(source).toContain("attemptFinished");
    expect(source).toContain("attemptId && !attemptFinished && questionNum < MAX_QUESTIONS");
    expect(source).toContain("setAttemptFinished(true)");
    expect(source).toContain("setAttemptId(null)");
  });

  it("Higher or Lower has an immediate pointer guard so touch clicks cannot appear inert or double-submit", () => {
    const source = read("src/pages/HigherLowerScreen.tsx");
    expect(source).toContain("guessInFlight");
    expect(source).toContain("onPointerDownCapture");
    expect(source).toContain("event.preventDefault()");
  });

  it("/ranks is a protected alias for the leaderboard screen", () => {
    const source = read("src/App.tsx");
    expect(source).toContain("path=\"/ranks\"");
    expect(source).toMatch(/path="\/ranks"[\s\S]*<LeaderboardScreen \/>/);
  });

  it("The Forge lock screen displays the same default unrated ELO as Profile", () => {
    const source = read("src/pages/ForgeScreen.tsx");
    expect(source).toContain("Math.max(Math.round(currentElo), 1200)");
  });

  it("pending challenge avatars derive initials from the challenger name instead of leaking raw first characters", () => {
    const source = read("src/pages/ChallengeScreen.tsx");
    expect(source).toContain("getChallengeInitials");
    expect(source).not.toContain("{c.challenger[0]}");
  });
});
