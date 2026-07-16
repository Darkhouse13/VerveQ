/**
 * F3c — the projected band's two obligations.
 *
 * 1. CONTAINMENT (the property): over many mock runs, every realized fielded
 *    round score lies inside the band the UI displayed before that round
 *    resolved. A band that can exclude the truth is worse than no band — it
 *    would teach the player a wrong model of the game and make bench and
 *    bank/push decisions on a lie.
 *
 * 2. SANITIZATION: the band is computed only from already-revealed values. The
 *    proof here is by CONSTRUCTION rather than by assertion — projectRound is
 *    handed nothing but cards, a fixture and DrawRules, all of which the client
 *    already holds. The board seed (from which form derives) is not in scope,
 *    so a form pre-resolution is not expressible. What's asserted instead is
 *    the observable consequence: the band does not know which way form will
 *    break, so it must straddle every outcome.
 */

import { describe, it, expect } from "vitest";
import { LocalMockApi } from "@/lib/drawApi";
import { MOCK_ENGINE_CONFIG } from "@/lib/drawApi/mockConfig";
import type { DrawRules } from "@/lib/drawApi/types";
import type { Card } from "@/lib/drawEngine";
import { projectRound, bandFraction, bustKeepValue } from "@/components/draw/projection";

const DAY_MS = 24 * 60 * 60 * 1000;
const RUNS = 220;

function rulesOf(): DrawRules {
  const c = MOCK_ENGINE_CONFIG;
  return {
    rows: c.rows,
    offersPerRow: c.offersPerRow,
    fixtureCount: c.fixtureCount,
    synergyTable: c.synergyTable,
    bustKeep: c.bustKeep,
    fullClearBonus: c.fullClearBonus,
    formSpread: c.formSpread,
    maxSynergyFamilies: c.maxSynergyFamilies,
  };
}

/**
 * Play one run to completion, recording for every round the band computed from
 * the pre-round state alongside the score the engine actually produced.
 *
 * The bands are computed BEFORE the choice is submitted — from the view the UI
 * had at that moment — so this exercises the real "what could the screen have
 * known" question rather than reconstructing it after the fact.
 */
async function playRun(dayOffset: number, rules: DrawRules) {
  const now = Date.parse("2026-07-16T12:00:00.000Z") + dayOffset * DAY_MS;
  const api = new LocalMockApi({ now: () => now, storage: null });
  let view = await api.startRun();

  // Vary the draft line by day so the squads under test differ.
  while (view.phase === "draft") {
    view = await api.submitChoice({
      type: "pick",
      offerIndex: (dayOffset + view.rowIndex) % rules.offersPerRow,
    });
  }

  const samples: Array<{ low: number; high: number; score: number }> = [];
  while (view.phase !== "done") {
    if (view.phase === "bench") {
      const benchIndex = (dayOffset + view.fixtureIndex) % view.squad.length;
      const fielded: Card[] = view.squad.filter((_, i) => i !== benchIndex);
      const fixture = view.fixtures[view.fixtureIndex];
      // What the UI shows pre-CONFIRM.
      const band = projectRound(fielded, fixture, rules);
      view = await api.submitChoice({ type: "bench", squadIndex: benchIndex });
      const round = view.rounds[view.rounds.length - 1];
      samples.push({ low: band.low, high: band.high, score: round.score });
    } else if (view.phase === "decision") {
      // Always push, so later fixtures (and busts) are exercised too.
      view = await api.submitChoice({ type: "push" });
    }
  }
  return samples;
}

describe("Draw projected band (F3)", () => {
  it("every realized fielded round score lies inside the displayed band", async () => {
    const rules = rulesOf();
    const all: Array<{ low: number; high: number; score: number }> = [];
    for (let day = 0; day < RUNS; day++) all.push(...(await playRun(day, rules)));

    // The sweep must actually have played rounds, or this asserts nothing.
    expect(all.length).toBeGreaterThan(RUNS);

    const escapes = all.filter((s) => s.score < s.low || s.score > s.high);
    expect(escapes).toEqual([]);
  });

  it("the band is tight: realized scores reach both halves of it", async () => {
    // Containment is trivially satisfiable by an absurdly wide band, so pin
    // that the bounds are informative — scores land above AND below the centre.
    const rules = rulesOf();
    const all: Array<{ low: number; high: number; score: number }> = [];
    for (let day = 0; day < 40; day++) all.push(...(await playRun(day, rules)));

    const fractions = all.map((s) =>
      bandFraction({ low: s.low, high: s.high, mid: 0, synergyMult: 1 }, s.score),
    );
    expect(Math.min(...fractions)).toBeLessThan(0.45);
    expect(Math.max(...fractions)).toBeGreaterThan(0.55);
  });

  it("the band widens with formSpread and collapses to a point at zero", () => {
    const rules = rulesOf();
    const card: Card = {
      id: "C1",
      name: "TEST",
      rating: 80,
      clubs: ["CLUB_A"],
      nation: "NATION_A",
      era: "ERA_1990s",
      eraIndex: 3,
      position: "MID",
    };
    const fixture = {
      index: 0,
      archetypeId: "ARCH_NONE",
      modifiers: [],
      threshold: 100,
      isBoss: false,
    };

    // Zero spread ⇒ form is exactly ×1 ⇒ the score is knowable exactly.
    const exact = projectRound([card], fixture, { ...rules, formSpread: 0 });
    expect(exact.low).toBeCloseTo(80);
    expect(exact.high).toBeCloseTo(80);

    // A config knob change moves the band with no code change (F1's rule,
    // applied to F3): the band is data-driven, not hard-coded.
    const wide = projectRound([card], fixture, { ...rules, formSpread: 0.5 });
    expect(wide.low).toBeCloseTo(40);
    expect(wide.high).toBeCloseTo(120);
  });

  it("bust keeps floor(cumulative × bustKeep) — never a rounded-up payout", () => {
    const rules = { ...rulesOf(), bustKeep: 0.1501 };
    expect(bustKeepValue(1000, rules)).toBe(150);
    // 0.1501 × 999 = 149.94… — floor, so a bust cannot round UP into 150.
    expect(bustKeepValue(999, rules)).toBe(149);
    expect(bustKeepValue(0, rules)).toBe(0);
  });
});
