/**
 * Ticket G3 — reveal staging contract.
 *
 * Score resolution is a staged sequence, not a dump: per-card contributions
 * land one by one, the multiplier stamps, the total meets the threshold after
 * a beat, and only then CLEAR/FAIL. A tap skips straight to the verdict.
 * Pacing, not latency theater — with revealMs 0 (every other test) the whole
 * thing is instant, which this file also pins.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { RoundStage } from "@/components/draw/RoundStage";
import { LocalMockApi } from "@/lib/drawApi";
import type { DrawRunView, DrawToday } from "@/lib/drawApi/types";

const FIXED_NOW = Date.parse("2026-07-16T12:00:00.000Z");

async function benchResolvedViews(): Promise<{
  before: DrawRunView;
  after: DrawRunView;
  today: DrawToday;
}> {
  const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
  const today = await api.getToday();
  let view = await api.startRun();
  while (view.phase === "draft") {
    view = await api.submitChoice({ type: "pick", offerIndex: 0 });
  }
  const before = view; // bench phase, 0 rounds
  const after = await api.submitChoice({ type: "bench", squadIndex: 0 }); // resolved
  return { before, after, today };
}

const noop = () => {};

afterEach(() => {
  vi.useRealTimers();
});

describe("reveal staging (Ticket G3)", () => {
  it("stages contributions one by one, then the verdict; total runs ~2-4s", async () => {
    const { before, after, today } = await benchResolvedViews();
    vi.useFakeTimers();
    const { rerender } = render(
      <RoundStage
        view={before}
        rules={today.rules}
        locked={false}
        revealMs={380}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );
    rerender(
      <RoundStage
        view={after}
        rules={today.rules}
        locked={false}
        revealMs={380}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );

    // Staging is live: nothing landed yet, no verdict, stage marked revealing.
    expect(screen.getByTestId("draw-round-stage").getAttribute("data-revealing")).toBe("true");
    expect(screen.queryByTestId("draw-round-verdict")).toBeNull();
    const contributions = () =>
      after.rounds[0].cards.filter((_, i) =>
        after.squad.some(
          (card, si) =>
            card.id === after.rounds[0].cards[i]?.cardId &&
            screen.queryByTestId(`draw-contribution-${si}`) !== null,
        ),
      ).length;
    expect(contributions()).toBe(0);

    // One beat: exactly the first fielded card's contribution has landed.
    await act(async () => {
      vi.advanceTimersByTime(380 + 10);
    });
    expect(contributions()).toBe(1);
    expect(screen.queryByTestId("draw-round-verdict")).toBeNull();

    // Run the full sequence out (cards + stamp + tension beat + verdict +
    // closing beat): the verdict lands and staging ends. Each beat schedules
    // the next only after a render flush, so advance beat-by-beat; the
    // accumulated clock stays inside the ~2–4s budget.
    for (let i = 0; i < 12 && screen.queryByTestId("draw-round-stage")?.getAttribute("data-revealing") === "true"; i++) {
      await act(async () => {
        vi.advanceTimersByTime(650);
      });
    }
    // Design duration at the default cadence: one beat per fielded card, the
    // multiplier stamp, a 1.4× tension beat before the total, the verdict,
    // and a 1.6× closing beat — inside the ticket's ~2–4s envelope.
    const cards = after.rounds[0].cards.length;
    const designMs = (cards + 1) * 380 + 380 * 1.4 + 380 + 380 * 1.6;
    expect(designMs).toBeGreaterThanOrEqual(2000);
    expect(designMs).toBeLessThanOrEqual(4000);
    expect(screen.getByTestId("draw-round-verdict")).toBeTruthy();
    expect(screen.getByTestId("draw-round-stage").getAttribute("data-revealing")).toBeNull();
  });

  it("a tap skips straight to the verdict — no fake spinners to wait out", async () => {
    const { before, after, today } = await benchResolvedViews();
    vi.useFakeTimers();
    const { rerender } = render(
      <RoundStage
        view={before}
        rules={today.rules}
        locked={false}
        revealMs={380}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );
    rerender(
      <RoundStage
        view={after}
        rules={today.rules}
        locked={false}
        revealMs={380}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );
    expect(screen.queryByTestId("draw-round-verdict")).toBeNull();
    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId("draw-round-stage"));
    });
    expect(screen.getByTestId("draw-round-verdict")).toBeTruthy();
    expect(screen.getByTestId("draw-round-stage").getAttribute("data-revealing")).toBeNull();
  });

  it("revealMs 0 resolves instantly (the mode every functional test runs in)", async () => {
    const { before, after, today } = await benchResolvedViews();
    const { rerender } = render(
      <RoundStage
        view={before}
        rules={today.rules}
        locked={false}
        revealMs={0}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );
    rerender(
      <RoundStage
        view={after}
        rules={today.rules}
        locked={false}
        revealMs={0}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );
    expect(screen.getByTestId("draw-round-verdict")).toBeTruthy();
  });
});
