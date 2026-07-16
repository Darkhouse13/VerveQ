/**
 * F4 — coach marks: shown once, dismissible individually, skippable as a set,
 * and never shown again.
 *
 * The show-ONCE behaviour is the contract worth defending: a tip that returns
 * every day is not teaching, it is nagging, and it lands on the exact players
 * who already know the answer. So the tests below assert the negative — that a
 * remount after dismissal renders nothing — as much as the positive.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LocalMockApi } from "@/lib/drawApi";
import type { DrawRunView, DrawToday } from "@/lib/drawApi/types";
import { DraftStage } from "@/components/draw/DraftStage";
import { RoundStage } from "@/components/draw/RoundStage";
import { COACH_COPY, DRAW_COACH_KEY } from "@/components/draw/coachMarks";

const FIXED_NOW = Date.parse("2026-07-16T12:00:00.000Z");
const noop = () => {};

async function draftView(): Promise<{ view: DrawRunView; today: DrawToday }> {
  const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
  const today = await api.getToday();
  const view = await api.startRun();
  return { view, today };
}

async function benchView(): Promise<{ view: DrawRunView; today: DrawToday }> {
  const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
  const today = await api.getToday();
  let view = await api.startRun();
  while (view.phase === "draft") view = await api.submitChoice({ type: "pick", offerIndex: 0 });
  return { view, today };
}

function renderDraft(view: DrawRunView, today: DrawToday) {
  return render(<DraftStage view={view} rules={today.rules} locked={false} onPick={noop} />);
}

function renderRound(view: DrawRunView, today: DrawToday) {
  return render(
    <RoundStage
      view={view}
      rules={today.rules}
      locked={false}
      revealMs={0}
      onBench={noop}
      onBank={noop}
      onPush={noop}
      onContinue={noop}
    />,
  );
}

describe("F4 — coach marks", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the draft mark on a first run, with the ticket's copy", async () => {
    const { view, today } = await draftView();
    renderDraft(view, today);
    expect(screen.getByTestId("draw-coach-draft")).toHaveTextContent(COACH_COPY.draft);
  });

  it("never shows a mark again once dismissed — across remounts", async () => {
    const { view, today } = await draftView();
    renderDraft(view, today);
    fireEvent.click(screen.getByTestId("draw-coach-draft-got-it"));
    expect(screen.queryByTestId("draw-coach-draft")).not.toBeInTheDocument();

    // A fresh mount is a new run / a new day: the mark must stay gone.
    cleanup();
    renderDraft(view, today);
    expect(screen.queryByTestId("draw-coach-draft")).not.toBeInTheDocument();
  });

  it("persists dismissal under the drawCoachV1 key", async () => {
    const { view, today } = await draftView();
    renderDraft(view, today);
    fireEvent.click(screen.getByTestId("draw-coach-draft-got-it"));
    expect(JSON.parse(window.localStorage.getItem(DRAW_COACH_KEY)!)).toEqual(["draft"]);
  });

  it("SKIP ALL dismisses the whole set, including marks not yet seen", async () => {
    const draft = await draftView();
    renderDraft(draft.view, draft.today);
    fireEvent.click(screen.getByTestId("draw-coach-draft-skip"));
    expect(screen.queryByTestId("draw-coach-draft")).not.toBeInTheDocument();
    cleanup();

    // The bench mark was never displayed, but skipping is a decision about the
    // whole set — it must not reappear on the next surface.
    const bench = await benchView();
    renderRound(bench.view, bench.today);
    expect(screen.queryByTestId("draw-coach-bench")).not.toBeInTheDocument();
  });

  it("shows at most 3 marks, one per surface", async () => {
    const bench = await benchView();
    renderRound(bench.view, bench.today);
    // The round view only ever teaches its own surface — the draft mark
    // belongs to a screen the player has already left.
    expect(screen.getByTestId("draw-coach-bench")).toHaveTextContent(COACH_COPY.bench);
    expect(screen.queryByTestId("draw-coach-draft")).not.toBeInTheDocument();
    expect(screen.queryByTestId("draw-coach-decision")).not.toBeInTheDocument();
  });

  it("selecting an offer dismisses the draft mark — the control was found", async () => {
    const { view, today } = await draftView();
    renderDraft(view, today);
    fireEvent.click(screen.getByTestId("draw-offer-0"));
    expect(screen.queryByTestId("draw-coach-draft")).not.toBeInTheDocument();
  });

  it("survives an unreadable storage value rather than crashing the mode", async () => {
    window.localStorage.setItem(DRAW_COACH_KEY, "{not json");
    const { view, today } = await draftView();
    // Degrades to showing the mark; an unwanted tip beats a dead screen.
    expect(() => renderDraft(view, today)).not.toThrow();
    expect(screen.getByTestId("draw-coach-draft")).toBeInTheDocument();
  });

  it("ignores unknown ids in a stale stored value", async () => {
    window.localStorage.setItem(DRAW_COACH_KEY, JSON.stringify(["draft", "removedMarkV0"]));
    const { view, today } = await draftView();
    renderDraft(view, today);
    expect(screen.queryByTestId("draw-coach-draft")).not.toBeInTheDocument();
  });
});
