/**
 * Ticket D2 — first-run de-noising.
 *
 * On a player's very first board the draft screen would fire every system at
 * once, so two of them are withheld until the game has demonstrated what they
 * mean with real numbers:
 *   (a) the F1–F5 fit strip (PickImpact) during the first-run draft, and
 *   (b) the bench-strip form icons (🔥/❄) during first-run round 1,
 * then BOTH are introduced by ONE coach mark right after fixture 1 resolves
 * (the moment the first resolution ledger has just landed). From the second
 * board on — anyone with the client-only `drawIntroducedV1` sentinel — every
 * surface renders from pick 1.
 *
 * The gate is Option 1 (Ruling 2): client-only sentinel, guests first-class,
 * no server signal consulted. Hiding is render-level (the content is not
 * mounted), never CSS — and the fit strip's PICK_IMPACT_H slot stays reserved
 * so nothing below it shifts when it is introduced.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DraftStage } from "@/components/draw/DraftStage";
import { RoundStage } from "@/components/draw/RoundStage";
import { PICK_IMPACT_H } from "@/components/draw/layout";
import {
  COACH_IDS,
  DRAW_COACH_KEY,
  DRAW_INTRO_KEY,
} from "@/components/draw/coachMarks";
import type { DrawRules, DrawRunView } from "@/lib/drawApi/types";
import type { Card, Fixture, FormHint, RoundBreakdown } from "@/lib/drawEngine";

const noop = () => {};

const RULES: DrawRules = {
  rows: 6,
  offersPerRow: 3,
  fixtureCount: 5,
  synergyTable: [1, 1, 1, 1.335, 1.4818, 1.6285],
  bustKeep: 0.1501,
  fullClearBonus: 1.4664,
  formSpread: 0.48,
  maxSynergyFamilies: 3,
};

function squad(): Card[] {
  const names = ["OTTO WEIS", "BRUNO KANDE", "IVO PETRIC", "MILO DRAVIC", "SANDRO PIRES", "LEO MAREN"];
  return names.map((name, i) => ({
    id: `CARD_0${i}`,
    name,
    rating: [70, 82, 91, 74, 60, 88][i],
    clubs: ["CLUB_D"],
    nation: "NATION_C",
    era: "ERA_1990s",
    eraIndex: 3,
    position: "MID",
  }));
}

const FIXTURE: Fixture = {
  index: 0,
  archetypeId: "ARCH_FORTRESS_KEEPER",
  modifiers: [{ kind: "position", value: "GK", mult: 3.08 }],
  threshold: 1151,
  isBoss: false,
};

const NEXT_FIXTURE: Fixture = {
  index: 1,
  archetypeId: "ARCH_WALL",
  modifiers: [{ kind: "position", value: "DEF", mult: 2.69 }],
  threshold: 1456,
  isBoss: false,
};

/** Hints for BOTH the played fixture (0, bench strip) and the next (1, decision). */
function hintsFor(fixtureIndex: number): DrawRunView["hints"] {
  const byCard: Record<string, FormHint> = {};
  squad().forEach((c, i) => {
    byCard[c.id] = i % 2 === 0 ? "HOT" : "COLD";
  });
  return [{ fixtureIndex, byCard }];
}

function round1(): RoundBreakdown {
  return {
    fixtureIndex: 0,
    threshold: FIXTURE.threshold,
    benchedCardId: "CARD_00",
    baseSum: 717.33,
    synergies: [{ family: "club", tag: "CLUB_D", chain: 4, mult: 1.4818 }],
    synergyMult: 1.4818,
    score: 1418.98,
    cleared: true,
    cards: [
      { cardId: "CARD_01", rating: 82, form: 1.12, fixtureMult: 3.08, contribution: 282.94 },
      { cardId: "CARD_02", rating: 91, form: 0.94, fixtureMult: 2.69, contribution: 230.11 },
      { cardId: "CARD_03", rating: 74, form: 1, fixtureMult: 1, contribution: 74 },
      { cardId: "CARD_04", rating: 60, form: 1.31, fixtureMult: 0.37, contribution: 29.08 },
      { cardId: "CARD_05", rating: 88, form: 0.71, fixtureMult: 1.62, contribution: 101.2 },
    ],
  };
}

function draftView(): DrawRunView {
  const s = squad();
  return {
    boardNumber: 1,
    phase: "draft",
    rowIndex: 0,
    currentRow: [s[0], s[1], s[2]],
    squad: [],
    fixtures: [FIXTURE, NEXT_FIXTURE],
    fixtureIndex: 0,
    cumulative: 0,
    rounds: [],
    outcome: null,
    finalScore: null,
    fullBoard: null,
    hints: null,
  };
}

/** Bench (select) phase — round 1 pre-resolution; hints for the played fixture. */
function benchView(): DrawRunView {
  return {
    boardNumber: 1,
    phase: "bench",
    rowIndex: 6,
    currentRow: null,
    squad: squad(),
    fixtures: [FIXTURE, NEXT_FIXTURE],
    fixtureIndex: 0,
    cumulative: 0,
    rounds: [],
    outcome: null,
    finalScore: null,
    fullBoard: null,
    hints: hintsFor(0),
  };
}

/** Decision phase — fixture 1 resolved; hints for the NEXT fixture (the push). */
function decisionView(): DrawRunView {
  return {
    boardNumber: 1,
    phase: "decision",
    rowIndex: 6,
    currentRow: null,
    squad: squad(),
    fixtures: [FIXTURE, NEXT_FIXTURE],
    fixtureIndex: 0,
    cumulative: round1().score,
    rounds: [round1()],
    outcome: null,
    finalScore: null,
    fullBoard: null,
    hints: hintsFor(1),
  };
}

/** Bench (select) phase for fixture 2 — reached after a PUSH; hints for it. */
function bench2View(): DrawRunView {
  return {
    boardNumber: 1,
    phase: "bench",
    rowIndex: 6,
    currentRow: null,
    squad: squad(),
    fixtures: [FIXTURE, NEXT_FIXTURE],
    fixtureIndex: 1,
    cumulative: round1().score,
    rounds: [round1()],
    outcome: null,
    finalScore: null,
    fullBoard: null,
    hints: hintsFor(1),
  };
}

function renderDraft(view: DrawRunView) {
  return render(<DraftStage view={view} rules={RULES} locked={false} onPick={noop} />);
}

function renderRound(view: DrawRunView) {
  return render(
    <RoundStage
      view={view}
      rules={RULES}
      locked={false}
      revealMs={0}
      onBench={noop}
      onBank={noop}
      onPush={noop}
      onContinue={noop}
    />,
  );
}

function markReturning() {
  window.localStorage.setItem(DRAW_INTRO_KEY, "1");
}

describe("Ticket D2 — first-run de-noising", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("first-run draft: the fit strip is withheld but its slot stays reserved", () => {
    renderDraft(draftView());

    const slot = screen.getByTestId("draw-pick-impact");
    // Render-level hide (content not mounted), height reserved — no layout jump.
    expect(slot).toHaveAttribute("data-hidden", "true");
    expect(slot.style.height).toBe(`${PICK_IMPACT_H}px`);

    // Selecting an offer must NOT reveal the F1–F5 cells or the label.
    fireEvent.click(screen.getByTestId("draw-offer-0"));
    expect(screen.queryByText(/VS THE GAUNTLET/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("draw-pick-impact-0")).not.toBeInTheDocument();
    // Everything else the draft shows still renders as today.
    expect(screen.getByTestId("draw-offer-0")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("draw-synergy-meters")).toBeInTheDocument();
  });

  it("first-run round 1: the bench-strip form icons are hidden pre-resolution", () => {
    renderRound(benchView());
    for (let i = 0; i < RULES.rows; i++) {
      expect(screen.queryByTestId(`draw-hint-chip-${i}`)).not.toBeInTheDocument();
    }
    // The strip itself and the ratings still render — only the icons are gone.
    expect(screen.getByTestId("draw-squad-chip-0")).toBeInTheDocument();
  });

  it("after fixture 1: ONE intro mark with the amended copy; dismissing it un-hides both", () => {
    renderRound(decisionView());

    // The intro mark lands at the trigger (decision phase, verdict shown).
    const mark = screen.getByTestId("draw-coach-introduced");
    expect(mark).toHaveTextContent(
      "🔥/❄ show a player's form once rounds resolve. F1–F5 show how each card fits the five fixtures. Both are live from now on.",
    );
    // Still hidden until it is dismissed.
    expect(screen.queryByTestId("draw-hint-chip-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("draw-coach-introduced-got-it"));

    // Mark gone, icons live, sentinel persisted.
    expect(screen.queryByTestId("draw-coach-introduced")).not.toBeInTheDocument();
    expect(screen.getByTestId("draw-hint-chip-1")).toBeInTheDocument();
    expect(window.localStorage.getItem(DRAW_INTRO_KEY)).toBe("1");

    // And a freshly-mounted draft now shows the fit strip (the sentinel is set).
    cleanup();
    renderDraft(draftView());
    fireEvent.click(screen.getByTestId("draw-offer-0"));
    expect(screen.getByTestId("draw-pick-impact")).not.toHaveAttribute("data-hidden");
    expect(screen.getByTestId("draw-pick-impact-0")).toBeInTheDocument();
    expect(screen.getByText(/VS THE GAUNTLET/)).toBeInTheDocument();
  });

  it("returning player (sentinel present): fit strip + form icons render from pick 1, no intro mark", () => {
    markReturning();

    renderDraft(draftView());
    fireEvent.click(screen.getByTestId("draw-offer-0"));
    expect(screen.getByTestId("draw-pick-impact-0")).toBeInTheDocument();
    cleanup();

    renderRound(benchView());
    expect(screen.getByTestId("draw-hint-chip-0")).toBeInTheDocument();
    cleanup();

    renderRound(decisionView());
    expect(screen.queryByTestId("draw-coach-introduced")).not.toBeInTheDocument();
    expect(screen.getByTestId("draw-hint-chip-1")).toBeInTheDocument();
  });

  it("SKIP ALL earlier: no intro mark at the trigger, but it still un-hides and writes the sentinel", () => {
    // Player pressed SKIP ALL on an earlier mark — the whole coach set is seen,
    // but the intro sentinel was deliberately NOT written then (mid-draft).
    window.localStorage.setItem(DRAW_COACH_KEY, JSON.stringify([...COACH_IDS]));

    renderRound(decisionView());

    // No mark is shown…
    expect(screen.queryByTestId("draw-coach-introduced")).not.toBeInTheDocument();
    // …yet the introduction completes at the trigger: icons live, sentinel set.
    expect(screen.getByTestId("draw-hint-chip-1")).toBeInTheDocument();
    expect(window.localStorage.getItem(DRAW_INTRO_KEY)).toBe("1");
  });

  it("SKIP ALL on the intro mark itself un-hides and writes the sentinel", () => {
    renderRound(decisionView());
    fireEvent.click(screen.getByTestId("draw-coach-introduced-skip"));
    expect(screen.queryByTestId("draw-coach-introduced")).not.toBeInTheDocument();
    expect(screen.getByTestId("draw-hint-chip-1")).toBeInTheDocument();
    expect(window.localStorage.getItem(DRAW_INTRO_KEY)).toBe("1");
  });

  it("mid-run reload after introduction: form icons stay visible, no mark re-shown", () => {
    markReturning();
    // A reload lands straight back at the decision phase.
    renderRound(decisionView());
    expect(screen.queryByTestId("draw-coach-introduced")).not.toBeInTheDocument();
    expect(screen.getByTestId("draw-hint-chip-1")).toBeInTheDocument();
  });

  it("D2.1 — PUSH at fixture 1 without dismissing the mark still introduces", () => {
    // The V2 gap: mark showing, player pushes on without GOT IT / SKIP ALL.
    const pushes: number[] = [];
    render(
      <RoundStage
        view={decisionView()}
        rules={RULES}
        locked={false}
        revealMs={0}
        onBench={noop}
        onBank={noop}
        onPush={() => pushes.push(1)}
        onContinue={noop}
      />,
    );

    // Mark is up and the sentinel is still unwritten.
    expect(screen.getByTestId("draw-coach-introduced")).toBeInTheDocument();
    expect(window.localStorage.getItem(DRAW_INTRO_KEY)).toBeNull();

    // Leave via PUSH, never touching the mark's buttons.
    fireEvent.click(screen.getByTestId("draw-push"));
    expect(pushes).toEqual([1]);
    expect(window.localStorage.getItem(DRAW_INTRO_KEY)).toBe("1");

    // Fixture 2 now renders form icons and re-shows no intro mark.
    cleanup();
    renderRound(bench2View());
    expect(screen.getByTestId("draw-hint-chip-0")).toBeInTheDocument();
    expect(screen.queryByTestId("draw-coach-introduced")).not.toBeInTheDocument();
  });

  it("D2.1 — BANK at fixture 1 without dismissing the mark still introduces", () => {
    // BANK ends the run; assert the sentinel is written so the NEXT board is
    // un-hidden from pick 1.
    const banks: number[] = [];
    render(
      <RoundStage
        view={decisionView()}
        rules={RULES}
        locked={false}
        revealMs={0}
        onBench={noop}
        onBank={() => banks.push(1)}
        onPush={noop}
        onContinue={noop}
      />,
    );

    expect(screen.getByTestId("draw-coach-introduced")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("draw-bank"));
    expect(banks).toEqual([1]);
    expect(window.localStorage.getItem(DRAW_INTRO_KEY)).toBe("1");

    // Next board's draft shows the fit strip from pick 1.
    cleanup();
    renderDraft(draftView());
    fireEvent.click(screen.getByTestId("draw-offer-0"));
    expect(screen.getByTestId("draw-pick-impact-0")).toBeInTheDocument();
  });
});
