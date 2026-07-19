/**
 * Layout budget contract (Ticket B): S2/S3 must fit 390×844 with no vertical
 * scroll. jsdom does no real layout, so this asserts the same way
 * `draw:layoutcheck` does — via the LAYOUT pixel model — PLUS that the stage
 * components actually render their sections at those pixel heights (the
 * tokens aren't decorative: the DOM carries them as inline styles).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { checkLayout } from "@/lib/drawEngine";
import { MOCK_ENGINE_CONFIG } from "@/lib/drawApi/mockConfig";
import { LocalMockApi } from "@/lib/drawApi";
import type { DrawRunView, DrawToday } from "@/lib/drawApi/types";
import {
  DECISION_INFO_H,
  DRAFT_SECTIONS,
  NEXT_FIXTURE_H,
  PICK_IMPACT_H,
  PROJECTION_H,
  ROUND_SECTIONS,
  HEIGHT_BUDGET,
  LAYOUT,
  stackedHeight,
} from "@/components/draw/layout";
import { DraftStage } from "@/components/draw/DraftStage";
import { RoundStage } from "@/components/draw/RoundStage";

const FIXED_NOW = Date.parse("2026-07-16T12:00:00.000Z");

async function views(): Promise<{ draft: DrawRunView; bench: DrawRunView; today: DrawToday }> {
  const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
  const today = await api.getToday();
  const draft = await api.startRun();
  let bench = draft;
  while (bench.phase === "draft") {
    bench = await api.submitChoice({ type: "pick", offerIndex: 0 });
  }
  return { draft, bench, today };
}

const noop = () => {};

describe("Draw layout budget (LAYOUT_SPEC 390×844)", () => {
  it("the pinned mock config is layout-eligible", () => {
    const result = checkLayout(MOCK_ENGINE_CONFIG);
    expect(result.violations).toEqual([]);
    expect(result.eligible).toBe(true);
    expect(result.metrics.draftViewH).toBeLessThanOrEqual(result.metrics.budgetH);
    expect(result.metrics.roundViewH).toBeLessThanOrEqual(result.metrics.budgetH);
  });

  it("the stage section stacks match the spec totals and fit the 812px budget", () => {
    // LAYOUT_SPEC + Ticket F + D5:
    //   draft 48+64+36+88+190+40+112+24+44 + 8×12 = 742 (was 618 pre-D5);
    //   round 48+140+92+88+56+76+56 + 6×12 = 628; budget 844 − 2×16 = 812.
    //
    // D5 added the 112px ON PAPER projection panel (PROJECTION_H) to the draft:
    // 618 → 742, consuming 124px (panel + one 12px gap) of the ~194px the draft
    // had spare. It still fits with 70px to spare and no existing element was
    // shrunk to make room; neither view scrolls.
    expect(HEIGHT_BUDGET).toBe(812);
    expect(stackedHeight(DRAFT_SECTIONS)).toBe(742);
    expect(stackedHeight(ROUND_SECTIONS)).toBe(628);
    expect(stackedHeight(DRAFT_SECTIONS)).toBeLessThanOrEqual(HEIGHT_BUDGET);
    expect(stackedHeight(ROUND_SECTIONS)).toBeLessThanOrEqual(HEIGHT_BUDGET);
  });

  it("S2 draft renders every section at its budgeted height", async () => {
    const { draft, today } = await views();
    render(<DraftStage view={draft} rules={today.rules} locked={false} onPick={noop} />);
    expect(screen.getByTestId("draw-fixture-strip").style.height).toBe(`${LAYOUT.fixtureStripH}px`);
    expect(screen.getByTestId("draw-synergy-meters").style.height).toBe("88px");
    expect(screen.getByTestId("draw-offer-row").style.height).toBe(`${LAYOUT.offerCardMaxH}px`);
    expect(screen.getByTestId("draw-row-dots").style.height).toBe(`${LAYOUT.rowDotsH}px`);
    expect(screen.getByTestId("draw-score-bar").style.height).toBe(`${LAYOUT.scoreBarH}px`);
    // Ticket F sections carry their budgeted heights too.
    expect(screen.getByTestId("draw-next-fixture").style.height).toBe(`${NEXT_FIXTURE_H}px`);
    expect(screen.getByTestId("draw-pick-impact").style.height).toBe(`${PICK_IMPACT_H}px`);
    // D5 — the ON PAPER projection panel renders at its budgeted height.
    expect(screen.getByTestId("draw-projection").style.height).toBe(`${PROJECTION_H}px`);
    // One active row of exactly 3 offers — never more on screen.
    expect(screen.getAllByTestId(/draw-offer-\d/)).toHaveLength(MOCK_ENGINE_CONFIG.offersPerRow);
  });

  it("S3 round renders every section at its budgeted height", async () => {
    const { bench, today } = await views();
    render(
      <RoundStage
        view={bench}
        rules={today.rules}
        locked={false}
        revealMs={0}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );
    expect(screen.getByTestId("draw-fixture-card").style.height).toBe(`${LAYOUT.fixtureCardH}px`);
    expect(screen.getByTestId("draw-bench-strip").style.height).toBe(`${LAYOUT.benchStripH}px`);
    expect(screen.getByTestId("draw-synergy-meters").style.height).toBe("88px");
    expect(screen.getByTestId("draw-threshold-bar").style.height).toBe(`${LAYOUT.thresholdBarH}px`);
    expect(screen.getByTestId("draw-decision-panel").style.height).toBe(`${LAYOUT.bankPushButtonsH}px`);
    // F3b's stake panel is RESERVED from the first frame — the slot must hold
    // its height in the bench phase, before it has any content, or BANK/PUSH
    // would move under the player's thumb when the reveal lands.
    expect(screen.getByTestId("draw-stake-panel").style.height).toBe(`${DECISION_INFO_H}px`);
    // All 6 squad chips visible (the tap-to-bench strip shows the full squad).
    expect(screen.getAllByTestId(/draw-squad-chip-\d/)).toHaveLength(MOCK_ENGINE_CONFIG.rows);
  });
});
