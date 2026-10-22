/**
 * Onboarding fixes from the 2026-10-22 first-time-user walkthrough (in-game):
 *  - the tab-switch rule is a quiet line under the game header, stated on the
 *    session's first live game, never a toast over the question;
 *  - a nameless guest is offered a name on a daily's result, with Skip;
 *  - Missing Letters says "one try per board" and points at empty blanks;
 *  - a browser's first Career Path comes from the easy pool.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { readFileSync } from "node:fs";

const auth = vi.hoisted(() => ({ accountState: "needsUsername" as string }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import { useAntiCheat } from "@/hooks/useAntiCheat";
import { StageFrame } from "@/components/shell/play/PlayStage";
import { ResultScreen } from "@/components/shell/play/result/ResultScreen";
import { firstRunDifficulty, markCareerPathPlayed } from "@/lib/careerPathFirstRun";

function Game({ active = true, over = false }: { active?: boolean; over?: boolean }) {
  useAntiCheat(() => {}, { warningMessage: "Don't switch tabs", active });
  return (
    <StageFrame title="Game">
      {over ? <ResultScreen hero={<p>hero</p>} actions={<p>actions</p>} /> : <p>question</p>}
    </StageFrame>
  );
}

const rule = () => screen.queryByTestId("stage-tab-rule");

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  auth.accountState = "needsUsername";
});
afterEach(cleanup);

describe("tab-switch rule line", () => {
  it("states the rule under the header on the session's first live game", () => {
    render(<Game />);
    expect(rule()?.textContent).toBe("Don't switch tabs");
  });

  it("does not repeat it on the next game of the session", () => {
    const first = render(<Game />);
    first.unmount();
    render(<Game />);
    expect(rule()).toBeNull();
  });

  it("waits for a live round, so reopening a finished daily doesn't use it up", () => {
    const view = render(<Game active={false} />);
    expect(rule()).toBeNull();
    view.rerender(<Game active />);
    expect(rule()?.textContent).toBe("Don't switch tabs");
  });

  it("goes when the result is on screen", () => {
    const view = render(<Game />);
    expect(rule()).not.toBeNull();
    view.rerender(<Game over />);
    expect(rule()).toBeNull();
  });

  it("no longer exists as a toast helper", () => {
    expect(readFileSync("src/lib/notify.ts", "utf8")).not.toContain("warnTabSwitchOnce");
  });
});

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

function renderResult(nameAsk = true) {
  return render(
    <MemoryRouter initialEntries={["/whos-older?ref=older"]}>
      <Routes>
        <Route path="*" element={<><ResultScreen hero={<p>hero</p>} actions={<p>actions</p>} nameAsk={nameAsk} /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("soft name ask on a daily result", () => {
  it("offers a nameless guest a name, under the actions", () => {
    renderResult();
    const card = screen.getByTestId("result-name-ask");
    expect(card).toBeTruthy();
    // After the actions: the primary keeps its place.
    expect(screen.getByText("actions").compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is not shown to players with a name, or on screens that don't ask", () => {
    auth.accountState = "usernameOnly";
    renderResult();
    expect(screen.queryByTestId("result-name-ask")).toBeNull();
    cleanup();
    auth.accountState = "needsUsername";
    renderResult(false);
    expect(screen.queryByTestId("result-name-ask")).toBeNull();
  });

  it("Pick a name goes to the name screen and comes back here", () => {
    renderResult();
    fireEvent.click(screen.getByTestId("result-name-ask-pick"));
    expect(screen.getByTestId("where").textContent).toBe(
      `/welcome?next=${encodeURIComponent("/whos-older?ref=older")}`,
    );
  });

  it("Skip hides it for the rest of the day", () => {
    renderResult();
    act(() => fireEvent.click(screen.getByTestId("result-name-ask-skip")));
    expect(screen.queryByTestId("result-name-ask")).toBeNull();
    cleanup();
    renderResult();
    expect(screen.queryByTestId("result-name-ask")).toBeNull();
  });

  it("is wired into the four dailies' results", () => {
    const wo = readFileSync("src/pages/shell/play/WhosOlderPlayScreen.tsx", "utf8");
    const ml = readFileSync("src/pages/shell/play/MissingLettersPlayScreen.tsx", "utf8");
    const modes = readFileSync("src/components/shell/play/result/ModeResults.tsx", "utf8");
    expect(wo.match(/<ResultScreen\s+testId="whos-older-[a-z-]+"\s+nameAsk/g)).toHaveLength(2);
    expect(ml.match(/<ResultScreen\s+testId="missing-letters-[a-z-]+"\s+nameAsk/g)).toHaveLength(2);
    expect(modes.match(/<ResultScreen\s+nameAsk/g)).toHaveLength(2);
  });
});

describe("Missing Letters first-timer clarity", () => {
  const src = readFileSync("src/pages/shell/play/MissingLettersPlayScreen.tsx", "utf8");

  it("says one try per board on the session's first board", () => {
    expect(src).toContain('t("missingLetters.oneTry")');
    expect(src).toMatch(/!reveal && view\.history\.length === 0/);
  });

  it("drops the 'Tap to continue' label: the reveal moves on by itself", () => {
    expect(src).not.toContain("tapToContinue");
  });

  it("Check on an unfinished board points at the empty blanks instead of being greyed out", () => {
    expect(src).not.toContain("disabled={busy || !complete}");
    expect(src).toContain("setNudgeEmpty(true)");
    expect(src).toContain('nudgeEmpty ? "border-verdict-wrong"');
  });
});

describe("first Career Path", () => {
  it("asks for an easy path until one has started in this browser", () => {
    expect(firstRunDifficulty()).toBe("easy");
    markCareerPathPlayed();
    expect(firstRunDifficulty()).toBeUndefined();
  });
});
