import { beforeEach, describe, expect, it, vi } from "vitest";

const trackMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/analytics", () => ({ track: trackMock }));

import {
  __resetRunsForTest,
  abandonRun,
  completeRun,
  hasRunInProgress,
  isRealIdentity,
  noteQuestionAnswered,
  startRun,
} from "../lib/gameAnalytics";
import { classifyEntrySource } from "../lib/entrySource";

const eventNames = () => trackMock.mock.calls.map((c) => c[0]);
const lastPayload = () => trackMock.mock.calls.at(-1)?.[1];

beforeEach(() => {
  trackMock.mockClear();
  __resetRunsForTest();
  sessionStorage.clear();
});

describe("game_started fires on the action, never on routing", () => {
  it("is silent without a resolved server session (a bare navigation)", () => {
    // The artifact that broke the last analysis: arriving at a mode URL must
    // produce nothing at all until the server actually mints a session.
    startRun(null, "career-path", { accountState: "loggedOut" });
    startRun(undefined, "career-path", { accountState: "loggedOut" });
    startRun("", "career-path", { accountState: "loggedOut" });
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("fires once per session, so a re-render or retry cannot double-count", () => {
    startRun("sess_1", "career-path", { accountState: "loggedOut" });
    startRun("sess_1", "career-path", { accountState: "loggedOut" });
    startRun("sess_1", "career-path", { accountState: "loggedOut" });
    expect(eventNames()).toEqual(["game_started"]);
  });

  it("counts a genuinely new server session as a new game (Next player)", () => {
    startRun("sess_1", "career-path", { accountState: "loggedOut" });
    completeRun("sess_1", { score: 1 });
    startRun("sess_2", "career-path", { accountState: "loggedOut" });
    expect(eventNames()).toEqual([
      "game_started",
      "game_completed",
      "game_started",
    ]);
  });

  it("marks game_started as auto by default, since arriving IS starting", () => {
    startRun("sess_1", "career-path", { accountState: "loggedOut" });
    expect(lastPayload()).toMatchObject({ start_trigger: "auto" });
  });

  it("does not orphan a live run when a re-fire mints a new session", () => {
    // Career Path / Higher-Lower / VerveGrid re-run startGame on a locale
    // switch, minting a fresh server session mid-game. The displaced run must
    // report, not leak.
    startRun("sess_1", "verve-grid", { accountState: "fullAccount" });
    noteQuestionAnswered("sess_1");
    startRun("sess_2", "verve-grid", { accountState: "fullAccount" });

    expect(eventNames()).toEqual([
      "game_started",
      "game_abandoned",
      "game_started",
    ]);
    expect(trackMock.mock.calls[1][1]).toMatchObject({
      mode: "verve-grid",
      questions_answered_before_exit: 1,
    });
    // and the displaced run must not pin this true for the tab's whole life
    expect(hasRunInProgress()).toBe(true);
    completeRun("sess_2", { score: 3 });
    expect(hasRunInProgress()).toBe(false);
  });

  it("does not re-abandon an already-completed run when the next game starts", () => {
    startRun("sess_1", "career-path", { accountState: "loggedOut" });
    completeRun("sess_1", { score: 5 });
    startRun("sess_2", "career-path", { accountState: "loggedOut" });
    expect(eventNames()).toEqual([
      "game_started",
      "game_completed",
      "game_started",
    ]);
  });
});

describe("is_authenticated does not trust the tab-local guest", () => {
  it("treats a logged-out visitor as unauthenticated", () => {
    startRun("sess_1", "career-path", { accountState: "loggedOut" });
    expect(lastPayload()).toMatchObject({
      mode: "career-path",
      is_authenticated: false,
      account_state: "loggedOut",
    });
  });

  it("treats a real server identity as authenticated", () => {
    for (const state of ["usernameOnly", "fullAccount", "needsUsername"] as const) {
      expect(isRealIdentity(state)).toBe(true);
    }
    expect(isRealIdentity("loggedOut")).toBe(false);
    // Auth settling must never be reported as a signed-in user.
    expect(isRealIdentity("loading")).toBe(false);
  });
});

describe("completed vs abandoned are distinguishable and mutually exclusive", () => {
  it("reports a completion with score, duration and result", () => {
    startRun("sess_1", "higher-lower", { accountState: "fullAccount" });
    noteQuestionAnswered("sess_1");
    noteQuestionAnswered("sess_1");
    completeRun("sess_1", { score: 42, result: "win" });

    expect(eventNames()).toEqual(["game_started", "game_completed"]);
    expect(lastPayload()).toMatchObject({
      mode: "higher-lower",
      score: 42,
      questions_answered: 2,
      result: "win",
    });
    expect(lastPayload()?.duration_seconds).toBeTypeOf("number");
  });

  it("does NOT report an abandon after a completion (late unmount)", () => {
    startRun("sess_1", "quiz", { accountState: "fullAccount" });
    completeRun("sess_1", { score: 10 });
    // The unmount cleanup always runs when leaving the results screen.
    abandonRun("sess_1");
    expect(eventNames()).toEqual(["game_started", "game_completed"]);
  });

  it("reports an abandon with progress when leaving mid-game", () => {
    startRun("sess_1", "survival", { accountState: "usernameOnly" });
    noteQuestionAnswered("sess_1");
    noteQuestionAnswered("sess_1");
    noteQuestionAnswered("sess_1");
    abandonRun("sess_1");

    expect(eventNames()).toEqual(["game_started", "game_abandoned"]);
    expect(lastPayload()).toMatchObject({
      mode: "survival",
      questions_answered_before_exit: 3,
    });
  });

  it("does not double-report when terminal branches converge", () => {
    // Survival has four callers of goToResults; Higher/Lower defers one by
    // 1200ms. Only the first may report.
    startRun("sess_1", "survival", { accountState: "fullAccount" });
    completeRun("sess_1", { score: 5 });
    completeRun("sess_1", { score: 5 });
    expect(eventNames()).toEqual(["game_started", "game_completed"]);
  });

  it("ignores unmount cleanup for a game that never started", () => {
    abandonRun(null);
    abandonRun("never_seen");
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("tracks whether any run is live, for the exit funnel", () => {
    expect(hasRunInProgress()).toBe(false);
    startRun("sess_1", "blitz", { accountState: "fullAccount" });
    expect(hasRunInProgress()).toBe(true);
    completeRun("sess_1", {});
    expect(hasRunInProgress()).toBe(false);
  });
});

describe("entry_source reads the door, not the destination", () => {
  it("classifies share/invite doors", () => {
    expect(classifyEntrySource("/s/d/DQTESTLINK01", "")).toBe("share-link");
    expect(classifyEntrySource("/duel/DQTESTLINK01", "")).toBe("share-link");
    expect(classifyEntrySource("/v2/arena/X7K2P9", "")).toBe("share-link");
    expect(classifyEntrySource("/arena/X7K2P9", "")).toBe("share-link");
    expect(classifyEntrySource("/v2/career-path", "?ref=daily_share")).toBe(
      "share-link",
    );
  });

  it("classifies homepage, profile and direct doors", () => {
    expect(classifyEntrySource("/", "")).toBe("homepage");
    expect(classifyEntrySource("/v2", "")).toBe("homepage");
    expect(classifyEntrySource("/home", "")).toBe("homepage");
    expect(classifyEntrySource("/v2/profile", "")).toBe("profile");
    expect(classifyEntrySource("/rivals/j5762abcdef", "")).toBe("profile");
    expect(classifyEntrySource("/v2/career-path", "?ref=play")).toBe("direct");
    expect(classifyEntrySource("/v2/daily", "")).toBe("direct");
  });
});
