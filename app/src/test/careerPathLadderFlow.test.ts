import { afterEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => null as string | null),
}));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
}));

import * as careerPath from "../../convex/careerPath";

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as {
    _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with an accessible handler");
  }
  return registered._handler;
}

function memoryDb() {
  const rows = new Map<string, Record<string, unknown>>();
  let sequence = 0;
  return {
    rows,
    db: {
      insert: vi.fn(async (_table: string, value: Record<string, unknown>) => {
        const id = `career_session_${++sequence}`;
        rows.set(id, { _id: id, ...value });
        return id;
      }),
      get: vi.fn(async (id: string) => rows.get(id) ?? null),
      patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
        rows.set(id, { ...rows.get(id), ...value });
      }),
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("career ladder prepared flow", () => {
  it("builds one deterministic, unique server-side queue", () => {
    const first = careerPath.buildLadderEntryQueue(() => 0);
    const second = careerPath.buildLadderEntryQueue(() => 0);

    expect(first).toEqual(second);
    expect(first).toHaveLength(10);
    expect(new Set(first).size).toBe(10);
  });

  it("returns the next round atomically without exposing answer-bearing IDs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0);
    const store = memoryDb();
    const ctx = { db: store.db };
    const guestToken = "career-ladder-guest-123456";

    const started = (await handlerOf(careerPath.startChallenge)(ctx, {
      sport: "football",
      mode: "ladder",
      guestToken,
    })) as Record<string, unknown>;

    expect(started).not.toHaveProperty("entryId");
    expect(started).not.toHaveProperty("answerName");
    expect(started).not.toHaveProperty("ladderEntryIds");

    const firstSession = store.rows.get(String(started.sessionId))!;
    const queue = firstSession.ladderEntryIds as string[];
    expect(queue).toHaveLength(10);
    expect(new Set(queue).size).toBe(10);

    const difficulties = [String(started.difficulty)];
    let currentSessionId = String(started.sessionId);
    for (let round = 1; round <= 10; round += 1) {
      const resolved = (await handlerOf(careerPath.resolveLadderChallenge)(ctx, {
        sessionId: currentSessionId,
        reason: "skipped",
        guestToken,
      })) as Record<string, unknown>;

      expect(resolved.answerName).toBeTypeOf("string");
      if (round === 10) {
        expect(resolved).not.toHaveProperty("nextRound");
        break;
      }

      const next = resolved.nextRound as Record<string, unknown>;
      expect(next).not.toHaveProperty("entryId");
      expect(next).not.toHaveProperty("answerName");
      expect(next).not.toHaveProperty("ladderEntryIds");
      expect(Number(next.startsAt) - Date.now()).toBe(
        careerPath.CAREER_PATH_LADDER_REVEAL_MS,
      );
      expect(Number(next.deadlineAt) - Number(next.startsAt)).toBe(
        careerPath.CAREER_PATH_LADDER_ROUND_MS,
      );

      await expect(handlerOf(careerPath.resolveLadderChallenge)(ctx, {
        sessionId: next.sessionId,
        reason: "skipped",
        guestToken,
      })).rejects.toThrow("Round has not started");

      vi.setSystemTime(Number(next.startsAt));
      currentSessionId = String(next.sessionId);
      difficulties.push(String(next.difficulty));
    }

    expect(difficulties).toEqual([
      "easy", "easy",
      "medium", "medium", "medium",
      "hard", "hard", "hard",
      "impossible", "impossible",
    ]);
    expect(store.rows.size).toBe(10);
  });
});
