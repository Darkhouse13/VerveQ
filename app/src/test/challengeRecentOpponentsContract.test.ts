import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge duel hub contract", () => {
  it("exposes Duel Hub buckets and rivalry-backed opponent suggestions", () => {
    const schema = readFileSync("convex/schema.ts", "utf8");
    const duels = readFileSync("convex/duels.ts", "utf8");
    const rivalries = readFileSync("convex/rivalries.ts", "utf8");
    const createDuel = readFileSync("src/pages/challenge/CreateDuelModal.tsx", "utf8");

    expect(schema).toContain("duels: defineTable");
    expect(schema).toContain('index("by_challenger"');
    expect(schema).toContain('index("by_opponent_status"');
    expect(schema).toContain("rivalries: defineTable");
    expect(duels).toContain("export const listMine");
    expect(duels).toContain("return { yourTurn, awaiting, resolved }");
    expect(duels).toContain('bucket: "your_turn"');
    expect(duels).toContain('s.bucket === "your_turn"');
    expect(duels).toContain('myCompleted ? "awaiting_opponent" : "your_turn"');
    expect(rivalries).toContain("export const listMine");
    expect(createDuel).toContain("api.rivalries.listMine");
    expect(createDuel).toContain("rivalSuggestions");
    expect(createDuel).toContain('type OpponentMode = "rival" | "username" | "link"');
  });

  it("renders the Duel Hub buckets instead of legacy recent-opponent buttons", () => {
    const challengeScreen = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");

    expect(challengeScreen).toContain("api.duels.listMine");
    expect(challengeScreen).toContain('title="Your turn"');
    expect(challengeScreen).toContain('title="Waiting on them"');
    expect(challengeScreen).toContain("New Duel");
    expect(challengeScreen).toContain("formatModeLabel(d.mode)");
    expect(challengeScreen).toContain("const topRivals = useMemo");
  });

  it("shows a compact recent-results strip and routes the full list to the history page", () => {
    const challengeScreen = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");
    const historyScreen = readFileSync("src/pages/DuelHistoryScreen.tsx", "utf8");
    const appSource = readFileSync("src/App.tsx", "utf8");

    expect(challengeScreen).toContain("RECENT_RESULTS_SHOWN");
    expect(challengeScreen).toContain("Recent results");
    expect(challengeScreen).toContain("Duel history");
    expect(challengeScreen).not.toContain('title="Resolved"');

    expect(historyScreen).toContain("api.duels.listMine");
    expect(historyScreen).toContain("Duel history");
    expect(appSource).toContain('path="/duels/history"');
    expect(appSource).toContain('path="/v2/duels/history"');
  });
});
