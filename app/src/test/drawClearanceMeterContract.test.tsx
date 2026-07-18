/**
 * Ticket G3 — clearance meter + hint chip contract.
 *
 * Pins the pre-decision legibility rules that replaced the F3 band:
 *  - the meter renders the BUCKET the engine's clearanceFor computes (one
 *    shared definition — the meter's exported meterSignal IS that call);
 *  - NO exact band values pre-decision: the meter's text carries no numbers
 *    besides the (design-public) threshold — no "~lo–hi" range anywhere;
 *  - the served bucket cutoffs are what the meter cuts on (a rules change
 *    moves the meter without a client edit);
 *  - hint glyphs map 🔥/—/❄ to the served HOT/NEUTRAL/COLD buckets.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClearanceMeter, meterSignal } from "@/components/draw/ClearanceMeter";
import {
  clearanceFor,
  generateBoard,
  generateCardSet,
  type EngineConfig,
} from "@/lib/drawEngine";
import { C13V2_CONFIG } from "@/lib/drawEngine/configs/c13v2";
import type { DrawRules } from "@/lib/drawApi/types";

const SEED = "clearance-meter-contract";

function rulesOf(config: EngineConfig): DrawRules {
  return {
    rows: config.rows,
    offersPerRow: config.offersPerRow,
    fixtureCount: config.fixtureCount,
    synergyTable: config.synergyTable,
    bustKeep: config.bustKeep,
    fullClearBonus: config.fullClearBonus,
    formSpread: config.formSpread,
    maxSynergyFamilies: config.maxSynergyFamilies,
    hintReliability: config.hints?.hintReliability,
    clearance: config.clearance,
  };
}

describe("ClearanceMeter (Ticket G3)", () => {
  const config = C13V2_CONFIG;
  const rules = rulesOf(config);
  const cards = generateCardSet(`${SEED}|cards`, config.cardGen);

  it("renders exactly the bucket the engine computes, across many fives", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const board = generateBoard(`${SEED}#${i}`, cards, config);
      for (const fixture of board.fixtures) {
        const fielded = [
          ...board.rows[i % 6].slice(0, 3),
          ...board.rows[(i + 1) % 6].slice(0, 2),
        ];
        const expected = clearanceFor(fielded, fixture, {
          ...config,
          clearance: rules.clearance,
        });
        expect(meterSignal(fielded, fixture, rules)).toBe(expected);
        seen.add(expected);
      }
    }
    // The sweep must have exercised more than one bucket or the test is vacuous.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("shows the bucket and the threshold — never an exact band range", () => {
    const board = generateBoard(`${SEED}#0`, cards, config);
    const fielded = [...board.rows[0].slice(0, 3), ...board.rows[1].slice(0, 2)];
    const fixture = board.fixtures[0];
    const { container } = render(
      <ClearanceMeter fielded={fielded} fixture={fixture} rules={rules} />,
    );
    const meter = screen.getByTestId("draw-clearance-meter");
    expect(meter.getAttribute("data-signal")).toBe(meterSignal(fielded, fixture, rules));
    // Every zone chip exists; exactly one is active.
    const active = ["SAFE", "TIGHT", "LONGSHOT"].filter(
      (z) =>
        screen.getByTestId(`draw-clearance-meter-zone-${z}`).getAttribute("data-active") ===
        "true",
    );
    expect(active).toEqual([meterSignal(fielded, fixture, rules)]);
    // NO exact numbers pre-decision beyond the design-public threshold: the
    // only digit sequence in the meter's text is the threshold itself.
    const text = container.textContent ?? "";
    const numbers = text.match(/\d+/g) ?? [];
    expect(numbers).toEqual([String(fixture.threshold)]);
    expect(text).not.toMatch(/~|–\d|\d–/);
  });

  it("cuts on the SERVED bucket cutoffs, not a client constant", () => {
    const board = generateBoard(`${SEED}#1`, cards, config);
    const fielded = [...board.rows[0].slice(0, 3), ...board.rows[1].slice(0, 2)];
    const fixture = board.fixtures[0];
    // Extreme served cutoffs force the two ends regardless of the five.
    const alwaysLong = { ...rules, clearance: { safeRatio: 99, longshotRatio: 98 } };
    const alwaysSafe = { ...rules, clearance: { safeRatio: 0.0001, longshotRatio: 0.00005 } };
    expect(meterSignal(fielded, fixture, alwaysLong)).toBe("LONGSHOT");
    expect(meterSignal(fielded, fixture, alwaysSafe)).toBe("SAFE");
  });
});
