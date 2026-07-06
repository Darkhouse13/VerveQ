import { describe, expect, it, vi } from "vitest";

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

function makeLadderCtx() {
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
      primaryPlayer: "Lionel Messi",
    },
    helpStage: 0,
  };
  return {
    session,
    ctx: {
      db: {
        // get() hands out a snapshot, like a real Convex document; patches
        // merge into the store so consecutive requestHelp calls walk the ladder.
        get: async () => ({ ...session }),
        patch: vi.fn(async (_id: string, fields: Record<string, unknown>) => {
          Object.assign(session, fields);
        }),
      },
    },
  };
}

describe("survival help ladder and reveal contracts", () => {
  it("uses the famous/headline player for clues instead of bucket-size count clues", async () => {
    const { ctx } = makeLadderCtx();
    const result = (await handlerOf(survivalSessions.requestHelp)(ctx, {
      sessionId: "session_1",
    })) as { kind: string; hintText: string; potValue: number };

    expect(result.kind).toBe("clue");
    expect(result.hintText).toContain("Most famous match");
    expect(result.hintText).toContain("Argentina");
    expect(result.hintText).not.toMatch(/players match these initials|possible answers/i);
    // First help press costs 15% of the Easy base pot.
    expect(result.potValue).toBe(85);
  });

  it("reveals the name strictly letter-by-letter through the server ladder, shrinking the pot", async () => {
    const { ctx } = makeLadderCtx();
    const help = handlerOf(survivalSessions.requestHelp);

    // Two clue stages first — the mask stays fully hidden beyond initials.
    const clue1 = (await help(ctx, { sessionId: "session_1" })) as {
      maskedName: string;
    };
    expect(clue1.maskedName).toBe("L••••• M••••");
    await help(ctx, { sessionId: "session_1" });

    // Stage 3 is the first letter reveal.
    const letter1 = (await help(ctx, { sessionId: "session_1" })) as {
      kind: string;
      maskedName: string;
      potValue: number;
      lettersRemaining: number;
    };
    expect(letter1.kind).toBe("letter");
    expect(letter1.maskedName).toBe("Li•••• M••••");
    expect(letter1.potValue).toBe(55);
    expect(letter1.lettersRemaining).toBe(8);

    const letter2 = (await help(ctx, { sessionId: "session_1" })) as {
      maskedName: string;
      potValue: number;
    };
    expect(letter2.maskedName).toBe("Lio••• M••••");
    // Pot floors at 10, never below, no matter how deep the ladder goes.
    // "Lionel Messi" hides 9 letters → stages 3-11 are letter reveals.
    for (let i = 0; i < 6; i++) {
      await help(ctx, { sessionId: "session_1" });
    }
    const drained = (await help(ctx, { sessionId: "session_1" })) as {
      potValue: number;
      lettersRemaining: number;
    };
    expect(drained.potValue).toBe(10);
    expect(drained.lettersRemaining).toBe(0);

    // Everything revealed → the ladder refuses further presses.
    await expect(help(ctx, { sessionId: "session_1" })).rejects.toThrow(
      /nothing left to reveal/i,
    );
  });

  it("never leaks the answer set to the client — the mask is the only reveal channel", async () => {
    const { ctx } = makeLadderCtx();
    const result = (await handlerOf(survivalSessions.getSession)(ctx, {
      sessionId: "session_1",
    })) as { challenge: Record<string, unknown> };

    expect(result.challenge).toBeTruthy();
    expect(result.challenge).not.toHaveProperty("validPlayers");
    expect(result.challenge).not.toHaveProperty("primaryPlayer");
    // Fresh challenge: mask shows word shapes + initials only, no extra letters.
    expect(result.challenge.maskedName).toBe("L••••• M••••");
    expect(result.challenge.potValue).toBe(100);
  });
});
