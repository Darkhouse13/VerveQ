/**
 * Ticket G2 — coarse clearance signal contract.
 *
 * Pins:
 *  - bucket semantics: SAFE/TIGHT/LONGSHOT cut exactly at safeRatio ×
 *    threshold and longshotRatio × threshold, on the F3 band centre;
 *  - bandMidFor agrees with the engine's own formless scoring (the signal is
 *    the same arithmetic the F3 band draws — no second implementation);
 *  - contract additivity: EngineConfig.clearance is optional, absent by
 *    default;
 *  - the analytic sim path (calibrate) and the real coarse bots agree
 *    run-for-run, and the coarseReader degenerates to coarseAssisted's bench
 *    at uninformative reliability.
 */
import { describe, expect, it } from "vitest";
import {
  bandMidFor,
  clearanceSignal,
  generateBoard,
  generateCardSet,
  mergeConfig,
  scoreRound,
  DEFAULT_CLEARANCE,
  type EngineConfig,
} from "@/lib/drawEngine";
import { C13V1_CONFIG } from "@/lib/drawEngine/configs/c13v1";
import { C13V2_CONFIG, C13V2_CONFIG_VERSION } from "@/lib/drawEngine/configs/c13v2";
import { DRAW_ACTIVE_CONFIG, DRAW_CONFIG_VERSION } from "../../convex/drawSeed";
import { buildContext } from "../../scripts/drawSim/boardContext";
import { runCoarseAssisted, runCoarseReader } from "../../scripts/drawSim/bots";
import {
  coarseReaderDataFor,
  precomputeBoard,
  signalRounds,
} from "../../scripts/drawSim/calibrate";

const SEED = "clearance-contract-v1";

describe("clearanceSignal semantics", () => {
  const cfg = { safeRatio: 1.25, longshotRatio: 0.9 };
  it("cuts exactly at the knob boundaries", () => {
    expect(clearanceSignal(1250, 1000, cfg)).toBe("SAFE"); // == safe edge inclusive
    expect(clearanceSignal(1249.999, 1000, cfg)).toBe("TIGHT");
    expect(clearanceSignal(900, 1000, cfg)).toBe("TIGHT"); // == longshot edge stays TIGHT
    expect(clearanceSignal(899.999, 1000, cfg)).toBe("LONGSHOT");
  });
  it("clearance knob is optional and absent by default", () => {
    expect(mergeConfig(undefined).clearance).toBeUndefined();
    expect(C13V1_CONFIG.clearance).toBeUndefined();
    const withIt = mergeConfig({ clearance: { safeRatio: 1.3, longshotRatio: 0.95 } });
    expect(withIt.clearance).toEqual({ safeRatio: 1.3, longshotRatio: 0.95 });
    expect(DEFAULT_CLEARANCE.safeRatio).toBeGreaterThan(DEFAULT_CLEARANCE.longshotRatio);
  });
});

describe("c13-2 module (Ticket G2 — accepted, NOT activated)", () => {
  it("pins the accepted c13-2 knobs (a retune must be a NEW version module)", () => {
    expect(C13V2_CONFIG_VERSION).toBe("c13-2");
    expect(C13V2_CONFIG.formSpread).toBe(0.48);
    expect(C13V2_CONFIG.thresholds).toEqual({
      base: 375,
      growth: 1.29,
      bossMult: 1,
      thresholdShape: [1, 1, 1, 1, 1],
    });
    expect(C13V2_CONFIG.hints).toEqual({ hintReliability: 0.6 });
    expect(C13V2_CONFIG.clearance).toEqual({ safeRatio: 1.15, longshotRatio: 1.05 });
    // Content knobs are pinned unchanged from c13-1 (same objects, not copies).
    expect(C13V2_CONFIG.synergyTable).toBe(C13V1_CONFIG.synergyTable);
    expect(C13V2_CONFIG.archetypes).toBe(C13V1_CONFIG.archetypes);
    expect(C13V2_CONFIG.cardGen).toBe(C13V1_CONFIG.cardGen);
    expect(C13V2_CONFIG.bustKeep).toBe(C13V1_CONFIG.bustKeep);
    expect(C13V2_CONFIG.fullClearBonus).toBe(C13V1_CONFIG.fullClearBonus);
  });

  it("c13-2 is NOT the active serving config (activation is a separate owner ticket)", () => {
    expect(DRAW_CONFIG_VERSION).toBe("c13-1");
    expect(DRAW_ACTIVE_CONFIG).toBe(C13V1_CONFIG);
    expect(DRAW_ACTIVE_CONFIG.hints).toBeUndefined();
    expect(DRAW_ACTIVE_CONFIG.clearance).toBeUndefined();
  });
});

describe("bandMidFor = the engine's formless round score", () => {
  const config = C13V1_CONFIG;
  const cards = generateCardSet(`${SEED}|cards`, config.cardGen);
  it("matches scoreRound at formSpread 0 on real fielded fives", () => {
    const formless: EngineConfig = { ...config, formSpread: 0 };
    for (let i = 0; i < 25; i++) {
      const board = generateBoard(`${SEED}#${i}`, cards, config);
      for (const fixture of board.fixtures) {
        const fielded = board.rows[i % 6].slice(0, 3).concat(board.rows[(i + 1) % 6].slice(0, 2));
        const mid = bandMidFor(fielded, fixture, config);
        const engine = scoreRound(board.seed, fielded, fixture, formless).score;
        expect(mid).toBeCloseTo(engine, 9);
      }
    }
  });
});

describe("analytic harness ⇔ real coarse bots agreement (Ticket G2)", () => {
  const config: EngineConfig = {
    ...C13V1_CONFIG,
    hints: { hintReliability: 0.8 },
    clearance: { safeRatio: 1.25, longshotRatio: 0.9 },
  };
  const formless: EngineConfig = { ...config, formSpread: 0 };
  const cards = generateCardSet(`${SEED}|cards`, config.cardGen);
  const t = Array.from({ length: config.fixtureCount }, (_, r) =>
    Math.round(
      config.thresholds.base *
        Math.pow(config.thresholds.growth, r) *
        (r === config.fixtureCount - 1 ? config.thresholds.bossMult : 1) *
        (config.thresholds.thresholdShape?.[r] ?? 1),
    ),
  );

  it("coarseAssisted & coarseReader: analytic outcomes match the real engine on 40 boards", () => {
    for (let i = 0; i < 40; i++) {
      const board = generateBoard(`${SEED}#${i}`, cards, config);
      const ctx = buildContext(board, config);
      const { data } = precomputeBoard(config, formless, cards, SEED, i);

      const realA = runCoarseAssisted(ctx);
      const analyticA = signalRounds(
        data.coarseScores,
        data.coarseMids,
        t,
        config.bustKeep,
        config.fullClearBonus,
        config.clearance!.safeRatio,
      );
      expect(analyticA.rounds).toBe(realA.roundsCleared);
      expect(analyticA.final).toBeCloseTo(realA.finalScore, 9);
      expect(analyticA.fullClear).toBe(realA.outcome === "fullclear");

      const realR = runCoarseReader(ctx);
      const crd = coarseReaderDataFor(data, config, config.hints!.hintReliability);
      const analyticR = signalRounds(
        crd.scores,
        crd.mids,
        t,
        config.bustKeep,
        config.fullClearBonus,
        config.clearance!.longshotRatio,
      );
      expect(analyticR.rounds).toBe(realR.roundsCleared);
      expect(analyticR.final).toBeCloseTo(realR.finalScore, 9);
      expect(analyticR.fullClear).toBe(realR.outcome === "fullclear");
    }
  });

  it("at uninformative reliability the coarseReader's bench equals coarseAssisted's", () => {
    const flat: EngineConfig = { ...config, hints: { hintReliability: 1 / 3 } };
    for (let i = 0; i < 20; i++) {
      const board = generateBoard(`${SEED}#${i}`, cards, flat);
      const ctx = buildContext(board, flat);
      const a = runCoarseAssisted(ctx);
      const r = runCoarseReader(ctx);
      // Same draft (chain-first) and, with posterior form = 1 for every hint,
      // the same bench argmin — so the two runs share every bench pick up to
      // the length of the shorter run (push rules legitimately differ:
      // SAFE-only vs not-LONGSHOT).
      const benches = (log: typeof a.choiceLog) => log.filter((c) => c.type === "bench");
      const ab = benches(a.choiceLog);
      const rb = benches(r.choiceLog);
      for (let k = 0; k < Math.min(ab.length, rb.length); k++) {
        expect(rb[k]).toEqual(ab[k]);
      }
    }
  });
});
