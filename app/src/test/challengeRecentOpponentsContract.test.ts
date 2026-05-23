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
    expect(challengeScreen).toContain('title="Awaiting opponent"');
    expect(challengeScreen).toContain('title="Resolved"');
    expect(challengeScreen).toContain("New Duel");
    expect(challengeScreen).toContain("formatModeLabel(d.mode)");
    expect(challengeScreen).toContain("const topRivals = useMemo");
  });
});
