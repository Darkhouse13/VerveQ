/**
 * Runtime contracts for the Survival Reveal Ladder economy:
 * pot-based scoring, surname acceptance, free skips, the softened anti-cheat
 * (warn first, then lives), and the cash-out exit. Handlers are invoked
 * directly with a fake ctx whose patch() merges into the session, so
 * multi-step flows (help → guess, warn → repeat) behave like the real DB.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(async () => "stub_user"),
}));

import * as survivalSessions from "../../convex/survivalSessions";
import {
  pickFootballPrimaryPlayer,
  cleanClubName,
} from "../../convex/survivalSessions";
import { findBestMatch } from "../../convex/lib/fuzzy";

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as {
    _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with an accessible handler");
  }
  return registered._handler;
}

// "QQ" has no bucket in the football initials map, so the valid-guess union
// stays exactly what the fixture declares.
function makeCtx(
  overrides: Record<string, unknown> = {},
  challengeOverrides: Record<string, unknown> = {},
) {
  // Loosely typed on purpose: patch() merges arbitrary Reveal Ladder fields
  // (antiCheatWarned, potFloorRound, …) into the session as the real DB would.
  const session: Record<string, unknown> = {
    _id: "surv_rl",
    userId: "stub_user",
    sport: "football",
    round: 1,
    score: 0,
    correctCount: 0,
    lives: 3,
    hintUsed: false,
    usedInitials: ["QQ"],
    gameOver: false,
    expiresAt: Date.now() + 60_000,
    startedAt: Date.now(),
    currentChallenge: {
      initials: "QQ",
      round: 1,
      difficulty: "Easy",
      validPlayers: ["Quentin Quaranta"],
      primaryPlayer: "Quentin Quaranta",
      ...challengeOverrides,
    },
    speedStreak: 0,
    lastAnswerAt: 0,
    performanceBonus: 0,
    closeCallRound: 1,
    closeCallCount: 0,
    helpStage: 0,
    skipsLeft: 3,
    ...overrides,
  };
  const patch = vi.fn(
    async (_id: string, fields: Record<string, unknown>) => {
      Object.assign(session, fields);
    },
  );
  return {
    session,
    patch,
    // get() hands out a snapshot, like a real Convex document — patches
    // must not mutate the object a running handler already holds.
    ctx: { db: { get: async () => ({ ...session }), patch } },
  };
}

describe("surname acceptance in fuzzy matching", () => {
  it("accepts an unambiguous surname", () => {
    const result = findBestMatch(
      "de bruyne",
      ["Kevin De Bruyne", "Quentin Quaranta"],
      { acceptSurname: true },
    );
    expect(result.matched).toBe(true);
    expect(result.surnameMatch).toBe(true);
    expect(result.matchedPlayer).toBe("Kevin De Bruyne");
  });

  it("gives longer surnames the usual typo budget", () => {
    const result = findBestMatch("de bruyn", ["Kevin De Bruyne"], {
      acceptSurname: true,
    });
    expect(result.matched).toBe(true);
    expect(result.surnameMatch).toBe(true);
    expect(result.typoAccepted).toBe(true);
  });

  it("flags a surname shared by several valid players instead of guessing", () => {
    const result = findBestMatch(
      "silva",
      ["Bernardo Silva", "Thiago Silva"],
      { acceptSurname: true },
    );
    expect(result.matched).toBe(false);
    expect(result.ambiguousSurname).toBe(true);
    expect(result.closeCall).toBe(true);
  });

  it("does not accept first names", () => {
    const result = findBestMatch("kevin", ["Kevin De Bruyne"], {
      acceptSurname: true,
    });
    expect(result.matched).toBe(false);
    expect(result.ambiguousSurname).toBe(false);
  });

  it("stays off unless explicitly opted in (Career Path keeps full names)", () => {
    const result = findBestMatch("de bruyne", ["Kevin De Bruyne"]);
    expect(result.matched).toBe(false);
  });
});

describe("pot-based scoring", () => {
  it("banks the full pot for a no-help correct answer", async () => {
    const { ctx, session } = makeCtx();
    const result = (await handlerOf(survivalSessions.submitGuess)(ctx, {
      sessionId: "surv_rl",
      guess: "Quentin Quaranta",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      correct: true,
      pointsEarned: 100,
      score: 100,
      round: 2,
    });
    expect(session.correctCount).toBe(1);
    const nextChallenge = result.nextChallenge as Record<string, unknown>;
    expect(nextChallenge).toBeTruthy();
    expect(nextChallenge).not.toHaveProperty("validPlayers");
    expect(nextChallenge).not.toHaveProperty("primaryPlayer");
    expect(nextChallenge.maskedName).toBeTruthy();
  });

  it("shrinks the payout after help presses and resets the streak", async () => {
    const { ctx } = makeCtx({ helpStage: 3 });
    const result = (await handlerOf(survivalSessions.submitGuess)(ctx, {
      sessionId: "surv_rl",
      guess: "Quentin Quaranta",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      correct: true,
      pointsEarned: 55, // Easy 100 − 3 × 15
      speedStreak: 0,
      isOnFire: false,
    });
  });

  it("pays only the floor for a round whose pot was anti-cheat floored", async () => {
    const { ctx } = makeCtx({ potFloorRound: 1, antiCheatWarned: true });
    const result = (await handlerOf(survivalSessions.submitGuess)(ctx, {
      sessionId: "surv_rl",
      guess: "Quentin Quaranta",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({ correct: true, pointsEarned: 10 });
  });

  it("costs a life and reveals the answer on a committed miss", async () => {
    const { ctx } = makeCtx();
    const result = (await handlerOf(survivalSessions.submitGuess)(ctx, {
      sessionId: "surv_rl",
      guess: "Zinedine Zidane",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      correct: false,
      pointsEarned: 0,
      lives: 2,
      correctAnswer: "Quentin Quaranta",
      round: 2,
      gameOver: false,
    });
  });
});

describe("close calls stay sealed", () => {
  it("does not reveal the near-miss target while the round is live", async () => {
    const { ctx } = makeCtx();
    const result = (await handlerOf(survivalSessions.submitGuess)(ctx, {
      sessionId: "surv_rl",
      guess: "Quentin Qua",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      correct: false,
      closeCall: true,
      correctAnswer: null,
      lives: 3,
    });
  });

  it("asks for the full name when a surname is ambiguous, without spending a life", async () => {
    const { ctx } = makeCtx(
      {},
      {
        validPlayers: ["Bernardo Silva", "Thiago Silva"],
        primaryPlayer: "Bernardo Silva",
      },
    );
    const result = (await handlerOf(survivalSessions.submitGuess)(ctx, {
      sessionId: "surv_rl",
      guess: "Silva",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      correct: false,
      closeCall: true,
      ambiguousSurname: true,
      correctAnswer: null,
      lives: 3,
    });
  });
});

describe("skips are free but budgeted", () => {
  it("skipping never costs a life", async () => {
    const { ctx } = makeCtx();
    const result = (await handlerOf(survivalSessions.skipChallenge)(ctx, {
      sessionId: "surv_rl",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      lives: 3,
      skipsLeft: 2,
      round: 2,
      gameOver: false,
    });
    expect(result.challenge).toBeTruthy();
  });

  it("refuses to skip once the budget is spent", async () => {
    const { ctx } = makeCtx({ skipsLeft: 0 });
    await expect(
      handlerOf(survivalSessions.skipChallenge)(ctx, { sessionId: "surv_rl" }),
    ).rejects.toThrow(/skips/i);
  });
});

describe("anti-cheat warns before it bites", () => {
  it("first offense floors the pot instead of taking a life", async () => {
    const { ctx, session } = makeCtx();
    const result = (await handlerOf(survivalSessions.penalizeTabSwitch)(ctx, {
      sessionId: "surv_rl",
      currentRound: 1,
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      penalized: true,
      warning: true,
      lives: 3,
      potValue: 10,
      gameOver: false,
    });
    expect(session.antiCheatWarned).toBe(true);
    expect(session.potFloorRound).toBe(1);
  });

  it("repeat offense costs a life as before", async () => {
    const { ctx } = makeCtx();
    const penalize = handlerOf(survivalSessions.penalizeTabSwitch);
    await penalize(ctx, { sessionId: "surv_rl", currentRound: 1 });
    const second = (await penalize(ctx, {
      sessionId: "surv_rl",
      currentRound: 2,
    })) as Record<string, unknown>;

    expect(second).toMatchObject({
      penalized: true,
      warning: false,
      lives: 2,
      gameOver: false,
    });
  });
});

describe("hint target accuracy", () => {
  it("a famous player beats the index's topPlayerName as the hint target", () => {
    // Audit 2026-07: the real "JM" bucket held 23 famous players yet topped
    // out at Jorge Molina, and the index only knows "J. Musiala" — the
    // canonical full spelling must come from the initials map.
    expect(
      pickFootballPrimaryPlayer(["J. Musiala", "Jorge Molina"], "Jorge Molina", "JM"),
    ).toBe("Jamal Musiala");
  });

  it("never picks an abbreviated dataset name while a full name exists", () => {
    // "QQ" has no initials-map bucket, so only the given names compete.
    expect(
      pickFootballPrimaryPlayer(["C. Stuani", "Cristhian Stuani"], "C. Stuani", "QQ"),
    ).toBe("Cristhian Stuani");
  });

  it("strips legal boilerplate from club names", () => {
    expect(cleanClubName("Manchester City Football Club")).toBe("Manchester City");
    expect(cleanClubName("Club Atlético de Madrid S.A.D.")).toBe("Atlético de Madrid");
    expect(cleanClubName("Paris Saint-Germain Football Club")).toBe("Paris Saint-Germain");
    expect(cleanClubName("Aarhus Gymnastik Forening")).toBe("Aarhus Gymnastik Forening");
  });

  it("skips clue stages entirely when the hint target has no metadata", async () => {
    // "Quentin Quaranta" has no metadata → filler clues are forbidden; the
    // first help press must already reveal a letter.
    const { ctx, session } = makeCtx();
    const result = (await handlerOf(survivalSessions.requestHelp)(ctx, {
      sessionId: "surv_rl",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({
      stage: 1,
      kind: "letter",
      hintText: null,
      maskedName: "Qu••••• Q•••••••",
      potValue: 85,
      lettersRemaining: 12,
    });
    expect(session.helpStage).toBe(1);
  });

  it("reports zero clue stages on the challenge when metadata is missing", async () => {
    const { ctx } = makeCtx();
    const result = (await handlerOf(survivalSessions.getSession)(ctx, {
      sessionId: "surv_rl",
    })) as { challenge: Record<string, unknown> };

    expect(result.challenge.clueStages).toBe(0);
  });
});

describe("cash out", () => {
  it("ends the run gracefully with the banked score", async () => {
    const { ctx, session } = makeCtx({ score: 340 });
    const result = (await handlerOf(survivalSessions.endRun)(ctx, {
      sessionId: "surv_rl",
    })) as Record<string, unknown>;

    expect(result).toMatchObject({ gameOver: true, score: 340 });
    expect(session.gameOver).toBe(true);
  });
});
