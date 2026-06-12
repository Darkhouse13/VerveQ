/**
 * Cold-entry landing contract.
 *
 * A signed-out visitor with no context (bare verveq.com) must be able to:
 *  - orient in one glance (positioning headline + one-liner + Play CTA);
 *  - play a full taste round with NO signup wall and NO navigation away;
 *  - only AFTER the round, see the deferred username claim that routes into
 *    the existing /v2/welcome username-only onboarding with ?next= threaded;
 *  - choose "Maybe later" and keep playing fresh rounds.
 *
 * i18n is passthrough-mocked (labels are raw keys) and navigation is spied so
 * the test asserts the flow and routing, not visual internals.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {},
  }),
}));

import ColdEntryScreen from "@/pages/shell/ColdEntryScreen";
import { TASTE_ROUND_SIZE } from "@/lib/tasteRound";

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
});

function renderColdEntry() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <ColdEntryScreen />
    </MemoryRouter>,
  );
}

/** Answer every question of the current round and land on the result card. */
function playThroughRound() {
  for (let i = 0; i < TASTE_ROUND_SIZE; i += 1) {
    fireEvent.click(screen.getAllByTestId("taste-option")[0]);
    const last = i === TASTE_ROUND_SIZE - 1;
    fireEvent.click(
      screen.getByText(last ? "landing.seeScore" : "landing.next"),
    );
  }
}

describe("cold-entry landing", () => {
  it("orients in one glance and offers sign-in for returning users", () => {
    renderColdEntry();
    expect(screen.getByText("landing.headline")).toBeTruthy();
    expect(screen.getByText("landing.subline")).toBeTruthy();
    expect(screen.getByText("landing.play")).toBeTruthy();
    expect(screen.queryByTestId("taste-option")).toBeNull();

    fireEvent.click(screen.getByText("landing.signIn"));
    expect(navigateSpy).toHaveBeenLastCalledWith("/?mode=signin");
  });

  it("Play drops straight into a question — no navigation, no signup wall", () => {
    renderColdEntry();
    fireEvent.click(screen.getByText("landing.play"));

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("taste-option")).toHaveLength(4);
    expect(screen.getByText("landing.progress")).toBeTruthy();
    // The username ask is DEFERRED — nothing about claiming during play.
    expect(screen.queryByText("landing.claimTitle")).toBeNull();
  });

  it("an answer reveals feedback before advancing", () => {
    renderColdEntry();
    fireEvent.click(screen.getByText("landing.play"));

    fireEvent.click(screen.getAllByTestId("taste-option")[0]);
    // One of the two verdicts (correct/wrong) must be visible post-pick.
    const verdict =
      screen.queryByText("landing.correct") ?? screen.getByText("landing.wrong");
    expect(verdict).toBeTruthy();
  });

  it("the claim prompt appears only AFTER the round and routes to /v2/welcome with next", () => {
    renderColdEntry();
    fireEvent.click(screen.getByText("landing.play"));
    playThroughRound();

    expect(screen.getByText("landing.claimTitle")).toBeTruthy();
    fireEvent.click(screen.getByText("landing.claimCta"));
    expect(navigateSpy).toHaveBeenLastCalledWith("/v2/welcome?next=%2Fv2");
  });

  it("'Maybe later' keeps them playing — a fresh round starts, no navigation", () => {
    renderColdEntry();
    fireEvent.click(screen.getByText("landing.play"));
    playThroughRound();

    fireEvent.click(screen.getByText("landing.maybeLater"));
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("taste-option")).toHaveLength(4);
    expect(screen.queryByText("landing.claimTitle")).toBeNull();
  });

  it("the result card offers explore + sign-in escapes", () => {
    renderColdEntry();
    fireEvent.click(screen.getByText("landing.play"));
    playThroughRound();

    fireEvent.click(screen.getByText("landing.explore"));
    expect(navigateSpy).toHaveBeenLastCalledWith("/v2");

    fireEvent.click(screen.getByText("landing.signIn"));
    expect(navigateSpy).toHaveBeenLastCalledWith("/?mode=signin");
  });
});
