import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge duel hub contract", () => {
  it("exposes Duel Hub buckets and a play-first create flow", () => {
    const schema = readFileSync("convex/schema.ts", "utf8");
    const duels = readFileSync("convex/duels.ts", "utf8");
    const rivalries = readFileSync("convex/rivalries.ts", "utf8");
    const createDuel = readFileSync("src/pages/challenge/CreateDuelModal.tsx", "utf8");

    expect(schema).toContain("duels: defineTable");
    expect(schema).toContain('index("by_challenger"');
    expect(schema).toContain('index("by_opponent_status"');
    expect(schema).toContain("rivalries: defineTable");
    expect(schema).toContain("sharedAt: v.optional(v.number())");
    expect(duels).toContain("export const listMine");
    expect(duels).toContain("return { yourTurn, awaiting, resolved }");
    expect(duels).toContain('bucket: "your_turn"');
    expect(duels).toContain('s.bucket === "your_turn"');
    expect(duels).toContain('myCompleted ? "awaiting_opponent" : "your_turn"');
    expect(rivalries).toContain("export const listMine");

    // Play-first: the create modal no longer forces an opponent up front — it
    // creates a link duel, plays, and invites from the results screen.
    expect(createDuel).toContain("viaLink: true");
    expect(createDuel).toContain("Play duel");
    expect(createDuel).toContain("Play now, invite after");
    expect(createDuel).not.toContain("OpponentMode");
    expect(createDuel).not.toContain("api.rivalries.listMine");

    // challenge_issued is deferred to the share moment via markShared, gated by
    // sharedAt so it fires once per duel.
    expect(duels).toContain("export const markShared");
    expect(duels).toContain("duel.sharedAt");
  });

  it("renders the Duel Hub buckets instead of legacy recent-opponent buttons", () => {
    const challengeScreen = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");
    const screens = JSON.parse(readFileSync("src/i18n/locales/en/screens.json", "utf8"));

    expect(challengeScreen).toContain("api.duels.listMine");
    // i18n: the section titles moved to locale keys; assert both the key wiring
    // in source and that the English copy is intact.
    expect(challengeScreen).toContain("challenge.yourTurnTitle");
    expect(screens.challenge.yourTurnTitle).toBe("Your turn");
    expect(challengeScreen).toContain("challenge.waitingTitle");
    expect(screens.challenge.waitingTitle).toBe("Waiting on them");
    expect(challengeScreen).toContain("challenge.newDuel");
    expect(screens.challenge.newDuel).toBe("New Duel");
    expect(challengeScreen).toContain("formatModeLabel(d.mode)");
    expect(challengeScreen).toContain("const topRivals = useMemo");
  });

  it("shows a compact recent-results strip and routes the full list to the history page", () => {
    const challengeScreen = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");
    const historyScreen = readFileSync("src/pages/DuelHistoryScreen.tsx", "utf8");
    const appSource = readFileSync("src/App.tsx", "utf8");
    const screens = JSON.parse(readFileSync("src/i18n/locales/en/screens.json", "utf8"));

    expect(challengeScreen).toContain("RECENT_RESULTS_SHOWN");
    // i18n: "Recent results" and "Duel history" copy moved to locale keys.
    expect(challengeScreen).toContain("challenge.recentResults");
    expect(screens.challenge.recentResults).toBe("Recent results");
    expect(challengeScreen).toContain("challenge.duelHistory");
    expect(screens.challenge.duelHistory).toBe("Duel history");
    expect(challengeScreen).not.toContain('title="Resolved"');

    expect(historyScreen).toContain("api.duels.listMine");
    // i18n: the history page title moved to a locale key as well.
    expect(historyScreen).toContain("duelHistory.title");
    expect(screens.duelHistory.title).toBe("Duel history");
    expect(appSource).toContain('path="/duels/history"');
    expect(appSource).toContain('path="/v2/duels/history"');
  });
});
