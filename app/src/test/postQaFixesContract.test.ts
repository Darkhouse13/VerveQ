import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("post-QA regression contracts", () => {
  it("Daily Quiz stops the live question query before navigating to completed results", () => {
    const source = read("src/hooks/useDailyQuiz.ts");
    expect(source).toContain("attemptFinished");
    expect(source).toContain("attemptId && !attemptFinished && questionNum < MAX_QUESTIONS");
    expect(source).toContain("setAttemptFinished(true)");
    expect(source).toContain("setAttemptId(null)");
  });

  it("Higher or Lower has an immediate pointer guard so touch clicks cannot appear inert or double-submit", () => {
    const source = read("src/pages/shell/play/HigherLowerPlayScreen.tsx");
    expect(source).toContain("guessInFlight");
    expect(source).toContain("onPointerDownCapture");
    expect(source).toContain("event.preventDefault()");
  });

  it("/ranks is an alias for the shell Ranks screen", () => {
    const source = read("src/App.tsx");
    expect(source).toContain('path="/ranks" element={<LegacyRedirect to="/v2/ranks" />}');
  });

  it("The Forge lock screen displays the same default unrated ELO as Profile", () => {
    const source = read("src/pages/ForgeScreen.tsx");
    expect(source).toContain("Math.max(Math.round(currentElo), 1200)");
  });

  it("Duel Hub renders listMine buckets and shared mode labels", () => {
    const source = read("src/pages/ChallengeScreen.tsx");
    expect(source).toContain("api.duels.listMine");
    expect(source).toContain("const yourTurn = list?.yourTurn ?? []");
    expect(source).toContain("const awaiting = list?.awaiting ?? []");
    expect(source).toContain("const resolved = list?.resolved ?? []");
    // i18n: the "Your turn" bucket title moved to a locale key; assert the key
    // wiring in source and that the English copy is intact.
    const screens = JSON.parse(read("src/i18n/locales/en/screens.json"));
    expect(source).toContain("challenge.yourTurnTitle");
    expect(screens.challenge.yourTurnTitle).toBe("Your turn");
    expect(source).toContain("formatModeLabel(d.mode, t)");
  });
});


it("keeps used daily attempts from advertising as new or re-calling startAttempt", async () => {
  const fs = await import("node:fs/promises");
  const daily = await fs.readFile(`${process.cwd()}/src/hooks/useDailyQuiz.ts`, "utf8");

  expect(daily).toContain("const attemptStatus = useQuery(api.dailyChallenge.getAttemptStatus");
  expect(daily).toContain("const startAttemptInFlight = useRef(false)");
  expect(daily).toContain("const localAttemptSport = useRef<string | null>(null)");
  expect(daily).toContain("if (attemptStatus) {");
  expect(daily).toContain("if (startAttemptInFlight.current || hasLocalAttempt) return");
  expect(daily.indexOf("if (attemptStatus)")).toBeLessThan(daily.indexOf('startAttemptMut({ sport, mode: "quiz" })'));
});
