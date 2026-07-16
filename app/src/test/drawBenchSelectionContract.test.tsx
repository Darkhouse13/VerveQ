/**
 * Bench selection contract (Ticket B, S3): exactly one card benched,
 * changeable freely before CONFIRM, and CONFIRM submits the selected index.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LocalMockApi } from "@/lib/drawApi";
import type { DrawRunView, DrawToday } from "@/lib/drawApi/types";
import { RoundStage } from "@/components/draw/RoundStage";

const FIXED_NOW = Date.parse("2026-07-16T12:00:00.000Z");

async function benchPhaseView(): Promise<{ view: DrawRunView; today: DrawToday }> {
  const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
  const today = await api.getToday();
  let view = await api.startRun();
  while (view.phase === "draft") {
    view = await api.submitChoice({ type: "pick", offerIndex: 0 });
  }
  return { view, today };
}

function renderStage(view: DrawRunView, today: DrawToday) {
  const onBench = vi.fn();
  const utils = render(
    <RoundStage
      view={view}
      rules={today.rules}
      locked={false}
      revealMs={0}
      onBench={onBench}
      onBank={vi.fn()}
      onPush={vi.fn()}
      onContinue={vi.fn()}
    />,
  );
  return { onBench, ...utils };
}

describe("Draw bench selection", () => {
  it("starts with no bench selected and CONFIRM disabled", async () => {
    const { view, today } = await benchPhaseView();
    renderStage(view, today);
    expect(screen.queryAllByText("BENCHED")).toHaveLength(0);
    expect(screen.getByTestId("draw-confirm-bench")).toBeDisabled();
  });

  it("benches exactly one card, moveable across taps until CONFIRM", async () => {
    const { view, today } = await benchPhaseView();
    const { onBench } = renderStage(view, today);

    fireEvent.click(screen.getByTestId("draw-squad-chip-2"));
    expect(screen.getAllByText("BENCHED")).toHaveLength(1);
    expect(screen.getByTestId("draw-benched-badge-2")).toBeInTheDocument();
    expect(screen.getByTestId("draw-confirm-bench")).toBeEnabled();

    // Tapping another chip MOVES the bench — never a second benched card.
    fireEvent.click(screen.getByTestId("draw-squad-chip-4"));
    expect(screen.getAllByText("BENCHED")).toHaveLength(1);
    expect(screen.queryByTestId("draw-benched-badge-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("draw-benched-badge-4")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("draw-squad-chip-1"));
    expect(screen.getAllByText("BENCHED")).toHaveLength(1);
    expect(screen.getByTestId("draw-benched-badge-1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("draw-confirm-bench"));
    expect(onBench).toHaveBeenCalledTimes(1);
    expect(onBench).toHaveBeenCalledWith(1);
  });

  it("locks the strip while a submission is in flight", async () => {
    const { view, today } = await benchPhaseView();
    const onBench = vi.fn();
    render(
      <RoundStage
        view={view}
        rules={today.rules}
        locked={true}
        revealMs={0}
        onBench={onBench}
        onBank={vi.fn()}
        onPush={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("draw-squad-chip-2"));
    expect(screen.queryAllByText("BENCHED")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("draw-confirm-bench"));
    expect(onBench).not.toHaveBeenCalled();
  });
});
