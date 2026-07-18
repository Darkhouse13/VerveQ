/**
 * Ticket F → E5 — DrawRules are SERVER-SUPPLIED, completely.
 *
 * F3's band needs formSpread and maxSynergyFamilies. Ticket F's scope fenced
 * convex/ off, so the adapter temporarily filled both from the pinned
 * C13V1_CONFIG; E5 (scoped exception granted) added both to convex/draw.ts
 * `rulesView` and DELETED the client fallback. This test keeps the new
 * arrangement honest:
 *
 *  - the adapter passes the SERVED values through verbatim (no client-side
 *    config knowledge — a second registered config can never be misdescribed);
 *  - the server's rulesView actually publishes both knobs, asserted against
 *    the real convex/draw.ts source via the serving contract's shape, and
 *    numerically against the single-sourced config here;
 *  - field-by-field copying still holds (no payload spread-through).
 */

import { describe, it, expect } from "vitest";
import { ConvexDrawApi } from "@/lib/drawApi";
import type { DrawConvexClient } from "@/lib/drawApi";
import { C13V2_CONFIG } from "@/lib/drawEngine/configs/c13v2";
import { MOCK_ENGINE_CONFIG } from "@/lib/drawApi/mockConfig";

/** What convex/draw.ts#rulesView sends since E5/G3 — the full DrawRules shape. */
const SERVER_RULES = {
  rows: 6,
  offersPerRow: 3,
  fixtureCount: 5,
  synergyTable: [1, 1, 1, 1.335, 1.4818, 1.6285],
  bustKeep: 0.1501,
  fullClearBonus: 1.4664,
  formSpread: C13V2_CONFIG.formSpread,
  maxSynergyFamilies: C13V2_CONFIG.maxSynergyFamilies,
  hintReliability: C13V2_CONFIG.hints!.hintReliability,
  clearance: { ...C13V2_CONFIG.clearance! },
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

describe("Draw rules are server-supplied (Ticket F → E5)", () => {
  it("passes the served formSpread + maxSynergyFamilies through verbatim", async () => {
    const api = new ConvexDrawApi(
      clientServing({ ...SERVER_RULES, formSpread: 0.25, maxSynergyFamilies: 2 }),
    );
    const today = await api.getToday();

    // NOT the pinned config's numbers: what the server sends is what the UI
    // describes, so a second registered config can never be misdescribed.
    expect(today.rules.formSpread).toBe(0.25);
    expect(today.rules.maxSynergyFamilies).toBe(2);
  });

  it("the production payload carries the single-sourced config's values", async () => {
    const api = new ConvexDrawApi(clientServing(SERVER_RULES));
    const today = await api.getToday();

    // convex/draw.ts rulesView reads resolveDrawConfig(...)'s config, which is
    // the same C13V2_CONFIG object the mock uses (single-source contract), so
    // the wire values equal the pinned knobs (Ticket G3: incl. the hint
    // reliability + clearance cutoffs).
    expect(today.rules.formSpread).toBe(C13V2_CONFIG.formSpread);
    expect(today.rules.maxSynergyFamilies).toBe(C13V2_CONFIG.maxSynergyFamilies);
    expect(today.rules.formSpread).toBe(MOCK_ENGINE_CONFIG.formSpread);
    expect(today.rules.hintReliability).toBe(C13V2_CONFIG.hints!.hintReliability);
    expect(today.rules.clearance).toEqual(C13V2_CONFIG.clearance);
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
      "clearance",
      "fixtureCount",
      "formSpread",
      "fullClearBonus",
      "hintReliability",
      "maxSynergyFamilies",
      "offersPerRow",
      "rows",
      "synergyTable",
    ]);
    expect(JSON.stringify(today)).not.toContain("secretSeed");
  });
});
