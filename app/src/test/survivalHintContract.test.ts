import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(async () => "stub_user"),
}));

import * as survivalSessions from "../../convex/survivalSessions";

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as {
    _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with an accessible handler");
  }
  return registered._handler;
}

const read = (path: string) => readFileSync(path, "utf8");

function makeHintCtx() {
  const session = {
    _id: "session_1",
    userId: "stub_user",
    sport: "football",
    round: 1,
    score: 0,
    lives: 3,
    usedInitials: ["LM"],
    gameOver: false,
    expiresAt: Date.now() + 60_000,
    currentChallenge: {
      initials: "LM",
      round: 1,
      difficulty: "Easy",
      validPlayers: ["Lionel Messi", "Luka Modric"],
      maskedName: "______ _____",
      primaryPlayer: "Lionel Messi",
    },
    hintTokensLeft: 3,
    currentHintStage: 0,
  };
  return {
    db: {
      get: async () => session,
      patch: vi.fn(),
    },
  };
}

describe("survival hint and prompt contracts", () => {
  it("uses the famous/headline player for hints instead of bucket-size count clues", async () => {
    const result = (await handlerOf(survivalSessions.useHint)(makeHintCtx(), {
      sessionId: "session_1",
      stage: 1,
    })) as { hintText: string };

    expect(result.hintText).toContain("Most famous match");
    expect(result.hintText).toContain("Argentina");
    expect(result.hintText).not.toMatch(/players match these initials|possible answers/i);
  });

  it("does not expose or render a full-name mask because survival should show initials only", () => {
    const server = read("convex/survivalSessions.ts");
    const screen = read("src/pages/SurvivalScreen.tsx");

    expect(server).not.toContain("maskedName: challenge.maskedName");
    expect(screen).not.toContain("challenge?.maskedName");
    expect(screen).not.toContain("challenge.maskedName.split");
  });
});
