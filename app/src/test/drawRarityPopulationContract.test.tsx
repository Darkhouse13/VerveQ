/**
 * F6 — rarity suppression below MIN_RARITY_POPULATION.
 *
 * The bug this closes: with one completed run, the line share is 100% and the
 * result screen announced "ONLY 100% DRAFTED THIS LINE". The assertion below
 * that matters most is the unrepresentability one — not just that the copy is
 * absent at n=1, but that NO population under the floor can produce a rarity
 * claim on EITHER surface. A screen that hides the line while the share card
 * still broadcasts it would be the same absurdity with a longer fuse.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocalMockApi, MOCK_LEADERBOARD_SIZE } from "@/lib/drawApi";
import type { DrawRarity, DrawRunView } from "@/lib/drawApi/types";
import { ResultStage } from "@/components/draw/ResultStage";
import { ShareCard } from "@/components/draw/ShareCard";
import { buildShareText, buildTrail } from "@/components/draw/share";
import type { ShareCardData } from "@/components/draw/share";
import { MIN_RARITY_POPULATION, showRarity } from "@/components/draw/rarity";

const FIXED_NOW = Date.parse("2026-07-16T12:00:00.000Z");

async function finishedRun(): Promise<DrawRunView> {
  const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
  let view = await api.startRun();
  while (view.phase !== "done") {
    if (view.phase === "draft") view = await api.submitChoice({ type: "pick", offerIndex: 0 });
    else if (view.phase === "bench") view = await api.submitChoice({ type: "bench", squadIndex: 0 });
    else view = await api.submitChoice({ type: "push" });
  }
  return view;
}

function shareDataWith(view: DrawRunView, rarity: DrawRarity | null): ShareCardData {
  return {
    boardNumber: view.boardNumber,
    outcome: view.outcome!,
    trail: buildTrail(view.rounds, view.outcome!),
    identity: null,
    score: view.finalScore ?? 0,
    url: "https://verveq.com/draw",
    rarity,
  };
}

function renderResult(view: DrawRunView, rarity: DrawRarity | null) {
  return render(
    <MemoryRouter>
      <ResultStage
        view={view}
        rarity={rarity}
        streak={null}
        leaderboard={[]}
        nextBoardAt={null}
        shareUrl="https://verveq.com/draw"
      />
    </MemoryRouter>,
  );
}

describe("F6 — rarity suppression", () => {
  it("suppresses the line below the floor, on screen AND in share text", async () => {
    const view = await finishedRun();
    // n=1: the absurdity the ticket names.
    const rarity: DrawRarity = { linePercent: 100, population: 1 };

    renderResult(view, rarity);
    expect(screen.queryByTestId("draw-rarity-line")).not.toBeInTheDocument();
    expect(screen.queryByTestId("draw-share-rarity")).not.toBeInTheDocument();
    expect(screen.queryByText(/drafted this line/i)).not.toBeInTheDocument();
    expect(buildShareText(shareDataWith(view, rarity))).not.toMatch(/drafted this line/i);
    expect(buildShareText(shareDataWith(view, rarity))).not.toContain("100%");
  });

  it("shows the line at or above the floor, on screen AND in share text", async () => {
    const view = await finishedRun();
    const rarity: DrawRarity = { linePercent: 4.2, population: MIN_RARITY_POPULATION };

    renderResult(view, rarity);
    expect(screen.getByTestId("draw-rarity-line")).toHaveTextContent(
      "ONLY 4.2% DRAFTED THIS LINE",
    );
    expect(screen.getByTestId("draw-share-rarity")).toHaveTextContent(
      "ONLY 4.2% DRAFTED THIS LINE",
    );
    expect(buildShareText(shareDataWith(view, rarity))).toContain("ONLY 4.2% DRAFTED THIS LINE");
  });

  it("the floor is exact: population 24 hides, 25 shows", () => {
    expect(showRarity({ linePercent: 5, population: MIN_RARITY_POPULATION - 1 })).toBe(false);
    expect(showRarity({ linePercent: 5, population: MIN_RARITY_POPULATION })).toBe(true);
    expect(MIN_RARITY_POPULATION).toBe(25);
  });

  it("'ONLY 100% DRAFTED THIS LINE' is unrepresentable at any small population", async () => {
    const view = await finishedRun();
    // The claim can only be 100% when the population is tiny; sweep the whole
    // suppressed range and assert no surface can emit it.
    for (let population = 0; population < MIN_RARITY_POPULATION; population++) {
      const rarity: DrawRarity = { linePercent: 100, population };
      expect(showRarity(rarity)).toBe(false);
      expect(buildShareText(shareDataWith(view, rarity))).not.toMatch(/drafted this line/i);

      const { unmount } = render(<ShareCard data={shareDataWith(view, rarity)} />);
      expect(screen.queryByTestId("draw-share-rarity")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("a null rarity (never fetched / draft incomplete) shows nothing", async () => {
    const view = await finishedRun();
    renderResult(view, null);
    expect(screen.queryByTestId("draw-rarity-line")).not.toBeInTheDocument();
    expect(buildShareText(shareDataWith(view, null))).not.toMatch(/drafted this line/i);
  });

  it("the mock's own world is below the floor — so it exercises suppression", async () => {
    const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
    let view = await api.startRun();
    while (view.phase === "draft") view = await api.submitChoice({ type: "pick", offerIndex: 0 });
    const rarity = await api.getRarity();
    // The mock fabricates MOCK_LEADERBOARD_SIZE rivals + the player.
    expect(rarity.population).toBe(MOCK_LEADERBOARD_SIZE + 1);
    expect(showRarity(rarity)).toBe(false);
  });

  it("the mock can be pushed above the floor to exercise the shown branch", async () => {
    const api = new LocalMockApi({
      now: () => FIXED_NOW,
      storage: null,
      rarityPopulation: 500,
    });
    let view = await api.startRun();
    while (view.phase === "draft") view = await api.submitChoice({ type: "pick", offerIndex: 0 });
    const rarity = await api.getRarity();
    expect(rarity.population).toBe(500);
    expect(showRarity(rarity)).toBe(true);
  });
});

describe("F5 — integer scores on the result surfaces", () => {
  it("the final score and leaderboard rows render as integers", async () => {
    const view = await finishedRun();
    render(
      <MemoryRouter>
        <ResultStage
          view={view}
          rarity={null}
          streak={null}
          // A raw engine float — the "444.291" class of display.
          leaderboard={[
            { rank: 1, name: "DRAFTER_X", score: 444.291, outcome: "banked" },
            { rank: 2, name: "YOU", score: 1203.9999, outcome: "busted", isYou: true },
          ]}
          nextBoardAt={null}
          shareUrl="https://verveq.com/draw"
        />
      </MemoryRouter>,
    );

    const board = screen.getByTestId("draw-leaderboard");
    expect(board).toHaveTextContent("444");
    expect(board).toHaveTextContent("1,204");
    expect(board.textContent).not.toMatch(/\d\.\d/);
    expect(screen.getByTestId("draw-final-score").textContent).not.toMatch(/\d\.\d/);
  });

  it("the share text quotes an integer score", async () => {
    const view = await finishedRun();
    const text = buildShareText(shareDataWith({ ...view, finalScore: 444.291 }, null));
    expect(text).toContain("444 PTS");
    expect(text).not.toContain("444.291");
  });
});
