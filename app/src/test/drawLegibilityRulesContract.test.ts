/**
 * Ticket F — the DrawRules gap-fill in ConvexDrawApi.
 *
 * F3's band needs formSpread and maxSynergyFamilies, and convex/draw.ts's
 * `rulesView` publishes neither. Ticket F's scope fences convex/ off, so the
 * adapter fills both from the pinned C13V1_CONFIG (see convexApi.ts#rulesView
 * for the full argument). This is the test that keeps that compromise honest:
 *
 *  - it pins the filled values to the pinned config, so a retune cannot leave
 *    the UI describing numbers the server no longer uses without a red test;
 *  - it proves the fallback YIELDS the moment the server does send the knobs,
 *    which is what makes this dead code rather than a permanent fork.
 *
 * When the follow-up serving ticket adds both to `rulesView`, the first test
 * here becomes vacuous and should be deleted with the fallback.
 */

import { describe, it, expect } from "vitest";
import { ConvexDrawApi } from "@/lib/drawApi";
import type { DrawConvexClient } from "@/lib/drawApi";
import { C13V1_CONFIG } from "@/lib/drawEngine/configs/c13v1";
import { MOCK_ENGINE_CONFIG } from "@/lib/drawApi/mockConfig";

/** The subset convex/draw.ts#rulesView actually sends today. */
const SERVER_RULES = {
  rows: 6,
  offersPerRow: 3,
  fixtureCount: 5,
  synergyTable: [1, 1, 1, 1.335, 1.4818, 1.6285],
  bustKeep: 0.1501,
  fullClearBonus: 1.4664,
};

const FIXTURES = [
  { index: 0, archetypeId: "ARCH_WALL", modifiers: [], threshold: 350, isBoss: false },
];

function clientServing(rules: Record<string, unknown>): DrawConvexClient {
  return {
    async query<T>(): Promise<T> {
      return {
        dateKey: "2026-07-16",
        boardNumber: 37,
        nextBoardAt: 0,
        streak: 0,
        boardReady: true,
        fixtures: FIXTURES,
        rules,
        playState: "unplayed",
        run: null,
      } as T;
    },
    async mutation<T>(): Promise<T> {
      throw new Error("not used");
    },
  };
}

describe("Draw rules gap-fill (Ticket F, F3)", () => {
  it("fills formSpread + maxSynergyFamilies from the pinned config when absent", async () => {
    const api = new ConvexDrawApi(clientServing(SERVER_RULES));
    const today = await api.getToday();

    expect(today.rules.formSpread).toBe(C13V1_CONFIG.formSpread);
    expect(today.rules.maxSynergyFamilies).toBe(C13V1_CONFIG.maxSynergyFamilies);
    // The values the UI computes bands from are the same numbers the mock and
    // the server generate boards with — the single-source guarantee this
    // fallback is leaning on.
    expect(today.rules.formSpread).toBe(MOCK_ENGINE_CONFIG.formSpread);
  });

  it("prefers served values — the fallback yields the moment rulesView grows", async () => {
    const api = new ConvexDrawApi(
      clientServing({ ...SERVER_RULES, formSpread: 0.25, maxSynergyFamilies: 2 }),
    );
    const today = await api.getToday();

    expect(today.rules.formSpread).toBe(0.25);
    expect(today.rules.maxSynergyFamilies).toBe(2);
  });

  it("still copies field-by-field — no server payload is spread through", async () => {
    const api = new ConvexDrawApi(
      clientServing({ ...SERVER_RULES, secretSeed: "draw|2026-07-16|k0" }),
    );
    const today = await api.getToday();

    // The adapter's standing rule: named fields only. An unknown field on the
    // server payload must not ride along into the client contract.
    expect(Object.keys(today.rules).sort()).toEqual([
      "bustKeep",
      "fixtureCount",
      "formSpread",
      "fullClearBonus",
      "maxSynergyFamilies",
      "offersPerRow",
      "rows",
      "synergyTable",
    ]);
    expect(JSON.stringify(today)).not.toContain("secretSeed");
  });
});
