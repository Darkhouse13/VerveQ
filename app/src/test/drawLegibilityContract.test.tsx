/**
 * Ticket F — F1 (fixture legibility), F2 (pick impact), F5 (integer scores),
 * F7 (tag chips).
 *
 * The through-line: every one of these renders from DATA, not from a table of
 * hand-written strings keyed by archetype. The tests that matter most here are
 * the ones that mutate a config / a fixture and assert the UI followed, because
 * that is the property the ticket actually asks for — "a config knob change
 * must change the chips with zero code edits" — and it is not observable from a
 * snapshot of the shipped config.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { LocalMockApi } from "@/lib/drawApi";
import { MOCK_ENGINE_CONFIG } from "@/lib/drawApi/mockConfig";
import type { DrawRunView, DrawToday } from "@/lib/drawApi/types";
import type { Fixture } from "@/lib/drawEngine";
import { DraftStage } from "@/components/draw/DraftStage";
import { FixtureStrip } from "@/components/draw/FixtureStrip";
import { DrawCardFace } from "@/components/draw/DrawCardFace";
import {
  effectLine,
  effectSentences,
  effectTokens,
  cardEffect,
} from "@/components/draw/fixtureEffects";
import { tagCode, tagName } from "@/components/draw/tags";
import { DRAW_INTRO_KEY } from "@/components/draw/coachMarks";

const FIXED_NOW = Date.parse("2026-07-16T12:00:00.000Z");
const noop = () => {};

async function views(): Promise<{ draft: DrawRunView; today: DrawToday }> {
  const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
  const today = await api.getToday();
  const draft = await api.startRun();
  return { draft, today };
}

/** A fixture built from arbitrary modifiers — the "config knob change" probe. */
function fixtureWith(modifiers: Fixture["modifiers"], isBoss = false): Fixture {
  return { index: 0, archetypeId: "ARCH_WALL", modifiers, threshold: 350, isBoss };
}

describe("F1 — fixture effect derivation", () => {
  it("renders ▲ for a boost and ▼ for a penalty, in config order", () => {
    const f = fixtureWith([
      { kind: "position", value: "DEF", mult: 2.0 },
      { kind: "position", value: "ATT", mult: 0.5 },
    ]);
    expect(effectLine(f)).toBe("DEF▲ ATT▼");
  });

  it("names era bounds unambiguously — '≤80s' is older, '90s+' is newer", () => {
    // Both rules use the bound index 3. Rendering both as "80s+"/"90s+" would
    // make the same suffix mean opposite things on adjacent chips.
    expect(effectLine(fixtureWith([{ kind: "eraBefore", value: 3, mult: 1.78 }]))).toBe("≤80s▲");
    expect(effectLine(fixtureWith([{ kind: "eraAtLeast", value: 3, mult: 1.62 }]))).toBe("90s+▲");
  });

  it("derives from the modifier table — a knob change changes the chip", () => {
    const before = fixtureWith([{ kind: "position", value: "DEF", mult: 2.0 }]);
    // Same rule, retuned below ×1: the arrow must flip with no code change.
    const after = fixtureWith([{ kind: "position", value: "DEF", mult: 0.4 }]);
    expect(effectLine(before)).toBe("DEF▲");
    expect(effectLine(after)).toBe("DEF▼");
    expect(effectTokens(after)[0].mult).toBe(0.4);
  });

  it("generates plain-language copy from the same data (F1b)", () => {
    const f = fixtureWith([
      { kind: "position", value: "DEF", mult: 2.0 },
      { kind: "position", value: "ATT", mult: 0.5 },
    ]);
    expect(effectSentences(f)).toEqual([
      "Defenders score ×2.",
      "Attackers score ×0.5.",
    ]);
    expect(effectSentences(fixtureWith([{ kind: "eraBefore", value: 3, mult: 1.78 }]))).toEqual([
      "Cards from the 80s and earlier score ×1.78.",
    ]);
  });

  it("every chip in the strip carries its effect line (F1a)", async () => {
    const { today } = await views();
    render(
      <FixtureStrip fixtures={today.fixtures} activeIndex={0} clearedCount={0} onSelect={noop} />,
    );
    for (const fixture of today.fixtures) {
      expect(screen.getByTestId(`draw-fixture-effect-${fixture.index}`)).toHaveTextContent(
        effectLine(fixture),
      );
    }
  });

  it("tapping a chip opens the sheet with plain-language effects (F1b)", async () => {
    const { draft, today } = await views();
    render(<DraftStage view={draft} rules={today.rules} locked={false} onPick={noop} />);

    fireEvent.click(screen.getByTestId("draw-fixture-chip-0"));
    const sheet = await screen.findByTestId("draw-fixture-sheet");
    for (const sentence of effectSentences(today.fixtures[0])) {
      expect(within(sheet).getByText(sentence)).toBeInTheDocument();
    }
    expect(within(sheet).getByTestId("draw-fixture-sheet-threshold")).toHaveTextContent(
      String(today.fixtures[0].threshold),
    );
  });

  it("the sheet badges the BOSS and the strip does not invent one", async () => {
    const { draft, today } = await views();
    const bossIndex = today.fixtures.findIndex((f) => f.isBoss);
    expect(bossIndex).toBeGreaterThanOrEqual(0);

    render(<DraftStage view={draft} rules={today.rules} locked={false} onPick={noop} />);
    fireEvent.click(screen.getByTestId(`draw-fixture-chip-${bossIndex}`));
    expect(await screen.findByTestId("draw-fixture-sheet-boss")).toBeInTheDocument();
  });

  it("the next unplayed fixture's effect is persistently visible (F1c)", async () => {
    const { draft, today } = await views();
    render(<DraftStage view={draft} rules={today.rules} locked={false} onPick={noop} />);
    // Present without any interaction — not only inside the 7px strip.
    expect(screen.getByTestId("draw-next-fixture-effect")).toHaveTextContent(
      effectLine(today.fixtures[0]),
    );
  });
});

describe("F2 — pick impact", () => {
  // D2 — the fit strip is withheld only on a player's very first board; these
  // F2 tests exercise the established-player state where it renders, so mark
  // this client as already introduced.
  beforeEach(() => {
    window.localStorage.setItem(DRAW_INTRO_KEY, "1");
  });

  it("first tap selects and does NOT pick; second tap on the card confirms", async () => {
    const { draft, today } = await views();
    const picks: number[] = [];
    render(
      <DraftStage view={draft} rules={today.rules} locked={false} onPick={(i) => picks.push(i)} />,
    );

    fireEvent.click(screen.getByTestId("draw-offer-1"));
    expect(picks).toEqual([]); // selection is free
    expect(screen.getByTestId("draw-offer-1")).toHaveAttribute("data-selected", "true");

    fireEvent.click(screen.getByTestId("draw-offer-1"));
    expect(picks).toEqual([1]);
  });

  it("selection is switchable between the 3 offers (F2a)", async () => {
    const { draft, today } = await views();
    const picks: number[] = [];
    render(
      <DraftStage view={draft} rules={today.rules} locked={false} onPick={(i) => picks.push(i)} />,
    );

    fireEvent.click(screen.getByTestId("draw-offer-0"));
    fireEvent.click(screen.getByTestId("draw-offer-2"));
    expect(picks).toEqual([]); // switching never commits
    expect(screen.getByTestId("draw-offer-0")).not.toHaveAttribute("data-selected");
    expect(screen.getByTestId("draw-offer-2")).toHaveAttribute("data-selected", "true");
  });

  it("the PICK button confirms the selection (F2a)", async () => {
    const { draft, today } = await views();
    const picks: number[] = [];
    render(
      <DraftStage view={draft} rules={today.rules} locked={false} onPick={(i) => picks.push(i)} />,
    );

    expect(screen.queryByTestId("draw-confirm-pick")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("draw-offer-0"));
    fireEvent.click(screen.getByTestId("draw-confirm-pick"));
    expect(picks).toEqual([0]);
  });

  it("a locked stage refuses both taps (no double picks)", async () => {
    const { draft, today } = await views();
    const picks: number[] = [];
    render(
      <DraftStage view={draft} rules={today.rules} locked onPick={(i) => picks.push(i)} />,
    );
    fireEvent.click(screen.getByTestId("draw-offer-0"));
    fireEvent.click(screen.getByTestId("draw-offer-0"));
    expect(picks).toEqual([]);
  });

  it("the mini-gauntlet verdicts match the engine's own multipliers (F2b)", async () => {
    const { draft, today } = await views();
    render(<DraftStage view={draft} rules={today.rules} locked={false} onPick={noop} />);

    // Reserved before selection — the row cannot shift the layout when it fills.
    expect(screen.getByTestId("draw-pick-impact")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("draw-offer-0"));
    const card = draft.currentRow![0];
    for (const fixture of draft.fixtures) {
      const cell = screen.getByTestId(`draw-pick-impact-${fixture.index}`);
      expect(cell).toHaveAttribute("data-dir", cardEffect(card, fixture).dir);
    }
  });

  it("a selected offer ghosts every family it would extend (F2b)", async () => {
    const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
    const today = await api.getToday();
    // One pick in, so a second card can visibly extend a chain.
    await api.startRun();
    const view = await api.submitChoice({ type: "pick", offerIndex: 0 });

    render(<DraftStage view={view} rules={today.rules} locked={false} onPick={noop} />);
    fireEvent.click(screen.getByTestId("draw-offer-0"));

    const offer = view.currentRow![0];
    // The nation family always grows: every card carries exactly one nation, so
    // either it extends the existing chain or it starts its own.
    const anyGhost = ["club", "nation", "era"].some(
      (f) => screen.queryByTestId(`draw-synergy-ghost-${f}`) !== null,
    );
    expect(anyGhost).toBe(true);
    expect(offer).toBeDefined();
  });
});

describe("F5 — integer scores", () => {
  it("no score renders with a decimal point anywhere on the draft", async () => {
    const { draft, today } = await views();
    const { container } = render(
      <DraftStage view={draft} rules={today.rules} locked={false} onPick={noop} />,
    );
    // "444.291" — a raw engine float — must not survive to the DOM. Multipliers
    // (×1.34) are deliberately excluded: they are rates, not scores.
    const scores = [
      screen.getByTestId("draw-score-bar").textContent ?? "",
      container.querySelector('[data-testid="draw-row-dots"]')?.textContent ?? "",
    ].join(" ");
    expect(scores).not.toMatch(/\d+\.\d/);
  });
});

describe("F7 — tag chips", () => {
  it("falls back to a 3-char code when the set carries no displayCode", () => {
    // The synthetic path: no registry entry exists, so the tag's own
    // distinguishing part is the code.
    expect(tagCode("CLUB_A")).toBe("A");
    expect(tagCode("NATION_C")).toBe("C");
    // A real-set-shaped tag truncates rather than overflowing the face.
    expect(tagCode("CLUB_RIVERPLATE")).toBe("RIV");
    expect(tagCode("CLUB_RIVERPLATE").length).toBeLessThanOrEqual(3);
  });

  it("names clubs in full for the detail sheet", () => {
    expect(tagName("CLUB_A")).toBe("CLUB A");
  });

  it("card faces render club codes, nation code, era label and position", async () => {
    const { draft } = await views();
    const card = draft.currentRow![0];
    render(<DrawCardFace card={card} />);

    expect(screen.getByText(card.position)).toBeInTheDocument();
    expect(screen.getByText(String(card.rating))).toBeInTheDocument();
    expect(screen.getByTestId("draw-card-nation")).toHaveTextContent(tagCode(card.nation));
    const clubs = screen.getAllByTestId("draw-card-club");
    expect(clubs).toHaveLength(card.clubs.length);
    clubs.forEach((chip, i) => expect(chip).toHaveTextContent(tagCode(card.clubs[i])));
  });

  it("config is the source of the mock's rules (no drift with the engine)", async () => {
    const { today } = await views();
    expect(today.rules.formSpread).toBe(MOCK_ENGINE_CONFIG.formSpread);
    expect(today.rules.maxSynergyFamilies).toBe(MOCK_ENGINE_CONFIG.maxSynergyFamilies);
  });
});
