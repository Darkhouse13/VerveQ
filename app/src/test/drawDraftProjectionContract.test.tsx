/**
 * Ticket D5 — draft-phase book-value projection contract.
 *
 * STOP-G banned exact pre-decision numbers on the ROUND surfaces; the D5 owner
 * amendment permits them on the DRAFT surface. This pins that amendment:
 *  (a) the projected value IS the engine's bandMidFor — no UI arithmetic — for
 *      k ≤ 5 drafted cards and the k = 6 leave-one-out best-five max;
 *  (b) the panel is a DRAFT-phase surface only — absent from the round phase
 *      (STOP-G's ban there is untouched — drawClearanceMeterContract proves it);
 *  (c) the label declares the number excludes form ("before form");
 *  (d) the numbers move after a pick — the cause-effect point of the ticket;
 *  (e) first-run: the projection shows (their consequence instrument) while the
 *      F1–F5 fit strip stays gated behind the intro sentinel.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DraftStage } from "@/components/draw/DraftStage";
import { RoundStage } from "@/components/draw/RoundStage";
import { DraftProjection } from "@/components/draw/DraftProjection";
import { projectBestFive, projectionConfig } from "@/components/draw/bookValue";
import {
  bandMidFor,
  generateBoard,
  generateCardSet,
  type EngineConfig,
} from "@/lib/drawEngine";
import { C13V2_CONFIG } from "@/lib/drawEngine/configs/c13v2";
import type { DrawRules, DrawRunView } from "@/lib/drawApi/types";

const SEED = "draft-projection-contract";
const noop = () => {};

const config = C13V2_CONFIG;
const cards = generateCardSet(`${SEED}|cards`, config.cardGen);
const board = generateBoard(SEED, cards, config);

/** One card per row — a plausible drafted line (any six board cards work). */
const SIX = board.rows.map((row) => row[0]).slice(0, 6);

function rulesOf(cfg: EngineConfig): DrawRules {
  return {
    rows: cfg.rows,
    offersPerRow: cfg.offersPerRow,
    fixtureCount: cfg.fixtureCount,
    synergyTable: cfg.synergyTable,
    bustKeep: cfg.bustKeep,
    fullClearBonus: cfg.fullClearBonus,
    formSpread: cfg.formSpread,
    maxSynergyFamilies: cfg.maxSynergyFamilies,
    hintReliability: cfg.hints?.hintReliability,
    clearance: cfg.clearance,
  };
}

const rules = rulesOf(config);

function draftView(squad: DrawRunView["squad"]): DrawRunView {
  return {
    boardNumber: 1,
    phase: "draft",
    rowIndex: squad.length,
    currentRow: board.rows[Math.min(squad.length, board.rows.length - 1)],
    squad,
    fixtures: board.fixtures,
    fixtureIndex: 0,
    cumulative: 0,
    rounds: [],
    outcome: null,
    finalScore: null,
    fullBoard: null,
    hints: null,
  };
}

function benchView(): DrawRunView {
  return {
    boardNumber: 1,
    phase: "bench",
    rowIndex: 6,
    currentRow: null,
    squad: SIX,
    fixtures: board.fixtures,
    fixtureIndex: 0,
    cumulative: 0,
    rounds: [],
    outcome: null,
    finalScore: null,
    fullBoard: null,
    hints: null,
  };
}

function renderRound(view: DrawRunView) {
  return render(
    <RoundStage
      view={view}
      rules={rules}
      locked={false}
      revealMs={0}
      onBench={noop}
      onBank={noop}
      onPush={noop}
      onContinue={noop}
    />,
  );
}

describe("Ticket D5 — draft-phase book-value projection", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("(a) the value IS bandMidFor — no UI math — for k≤5 and the k=6 leave-one-out max", () => {
    const fixture = board.fixtures[0];

    for (let k = 1; k <= 5; k++) {
      const squadK = SIX.slice(0, k);
      expect(projectBestFive(squadK, fixture, config)).toBe(bandMidFor(squadK, fixture, config));
    }

    // k = 6 — the best five is the highest-scoring leave-one-out (bench ruling).
    const looMax = Math.max(
      ...SIX.map((_, i) => bandMidFor(SIX.filter((_, j) => j !== i), fixture, config)),
    );
    expect(projectBestFive(SIX, fixture, config)).toBe(looMax);

    // The narrowed config the panel feeds (projectionConfig) is faithful to the
    // full engine config — same bandMidFor, so the panel can't drift from it.
    for (let k = 1; k <= 6; k++) {
      const squadK = SIX.slice(0, k);
      expect(projectBestFive(squadK, fixture, projectionConfig(rules))).toBe(
        projectBestFive(squadK, fixture, config),
      );
    }

    // Empty squad → nothing to project.
    expect(projectBestFive([], fixture, config)).toBeNull();
  });

  it("(b) renders in the draft phase and is absent from the round phase", () => {
    const { unmount } = render(
      <DraftStage view={draftView(SIX.slice(0, 3))} rules={rules} locked={false} onPick={noop} />,
    );
    expect(screen.getByTestId("draw-projection")).toBeInTheDocument();
    unmount();

    // STOP-G's round-phase ban is untouched: no projection on the round surface.
    renderRound(benchView());
    expect(screen.queryByTestId("draw-projection")).not.toBeInTheDocument();
  });

  it("(c) the label declares the number excludes form", () => {
    render(<DraftProjection squad={SIX.slice(0, 3)} fixtures={board.fixtures} rules={rules} />);
    expect(screen.getByTestId("draw-projection")).toHaveTextContent(/before form/i);
  });

  it("(d) the numbers move after a pick, and equal the engine value at each k", () => {
    const fixture = board.fixtures[0];
    const valueTestId = `draw-projection-value-${fixture.index}`;

    // Zero-pick state dashes the value (builder's choice: reserved slot, dash).
    const { unmount: u0 } = render(
      <DraftProjection squad={[]} fixtures={board.fixtures} rules={rules} />,
    );
    expect(screen.getByTestId(valueTestId).textContent).toBe("—");
    u0();

    const { unmount: u1 } = render(
      <DraftProjection squad={SIX.slice(0, 1)} fixtures={board.fixtures} rules={rules} />,
    );
    const v1 = screen.getByTestId(valueTestId).textContent;
    expect(v1).toBe(String(Math.round(bandMidFor(SIX.slice(0, 1), fixture, config))));
    u1();

    render(<DraftProjection squad={SIX.slice(0, 2)} fixtures={board.fixtures} rules={rules} />);
    const v2 = screen.getByTestId(valueTestId).textContent;
    expect(v2).toBe(String(Math.round(bandMidFor(SIX.slice(0, 2), fixture, config))));
    // A second pick moved the number.
    expect(v2).not.toBe(v1);
  });

  it("(e) first-run: the projection shows while the fit strip stays gated", () => {
    // No intro sentinel = first-run player.
    render(
      <DraftStage view={draftView(SIX.slice(0, 2))} rules={rules} locked={false} onPick={noop} />,
    );

    // Their consequence instrument is present…
    expect(screen.getByTestId("draw-projection")).toBeInTheDocument();
    // …while the F1–F5 fit strip content stays withheld (reserved slot only).
    expect(screen.getByTestId("draw-pick-impact")).toHaveAttribute("data-hidden", "true");
    fireEvent.click(screen.getByTestId("draw-offer-0"));
    expect(screen.queryByText(/VS THE GAUNTLET/)).not.toBeInTheDocument();
    // Selecting an offer does not remove the projection.
    expect(screen.getByTestId("draw-projection")).toBeInTheDocument();
  });
});
