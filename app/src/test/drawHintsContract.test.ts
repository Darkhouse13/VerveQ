/**
 * Ticket G — form-hint contract (engine v1.1).
 *
 * Pins the hint module's guarantees:
 *  - purity/determinism: formHint is a function of (boardSeed, cardId,
 *    roundIndex, hintReliability) only — same args ⇒ same hint, no user salt;
 *  - reliability semantics: P(hint band == realized form band) tracks the
 *    hintReliability knob, and the marginal hint distribution stays uniform
 *    (a HOT tag carries no population tell);
 *  - Bayes helpers: uninformative reliability (1/3) collapses the posterior
 *    to the prior (posterior form = 1), and the posterior stays
 *    mean-preserving across hints;
 *  - v1.0 back-compat: EngineConfig.hints is optional and absent by default;
 *  - the analytic sim path (calibrate) and the real bots (runAssisted /
 *    runReader) agree run-for-run — the harness cannot drift from the engine;
 *  - reader degenerates to assisted exactly at reliability 1/3.
 */
import { describe, expect, it } from "vitest";
import {
  formBandOf,
  formFor,
  formHint,
  generateBoard,
  generateCardSet,
  hintPosteriorForm,
  hintPosteriorMeanU,
  mergeConfig,
  unitFromString,
  FORM_HINT_BANDS,
  type EngineConfig,
} from "@/lib/drawEngine";
import { C13V1_CONFIG } from "@/lib/drawEngine/configs/c13v1";
import { buildContext } from "../../scripts/drawSim/boardContext";
import { assistedPushGate, runAssisted, runReader } from "../../scripts/drawSim/bots";
import {
  bandRounds,
  precomputeBoard,
  readerDataFor,
} from "../../scripts/drawSim/calibrate";

const SEED = "hints-contract-v1";

describe("formHint determinism & purity", () => {
  it("same args ⇒ same hint; different cards/rounds/seeds vary", () => {
    const a = formHint("board#1", "CARD_001", 2, 0.7);
    expect(formHint("board#1", "CARD_001", 2, 0.7)).toBe(a);
    // Not constant across the keyspace (probabilistic sanity, fixed seeds).
    const varied = new Set<string>();
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 10; c++) varied.add(formHint("board#1", `CARD_00${c}`, r, 0.7));
    expect(varied.size).toBe(3);
  });

  it("reliability 1 always names the realized form band", () => {
    for (let i = 0; i < 500; i++) {
      const cardId = `CARD_${i}`;
      const u = unitFromString(`b|form|${cardId}|3`);
      expect(formHint("b", cardId, 3, 1)).toBe(formBandOf(u));
    }
  });

  it("P(hint == true band) ≈ hintReliability and the hint marginal is uniform", () => {
    const r = 0.7;
    const n = 6000;
    let match = 0;
    const counts: Record<string, number> = { COLD: 0, NEUTRAL: 0, HOT: 0 };
    for (let i = 0; i < n; i++) {
      const cardId = `CARD_${i}`;
      const u = unitFromString(`stat|form|${cardId}|1`);
      const hint = formHint("stat", cardId, 1, r);
      counts[hint]++;
      if (hint === formBandOf(u)) match++;
    }
    expect(match / n).toBeGreaterThan(r - 0.02);
    expect(match / n).toBeLessThan(r + 0.02);
    for (const band of FORM_HINT_BANDS) {
      expect(counts[band] / n).toBeGreaterThan(1 / 3 - 0.025);
      expect(counts[band] / n).toBeLessThan(1 / 3 + 0.025);
    }
  });

  it("the hint never reveals the form draw beyond its band statistics", () => {
    // The noise stream is separate from the form stream: conditioned on the
    // same true band, the hint distribution is identical regardless of where
    // in the band the form draw landed (low vs high halves match).
    const r = 0.7;
    const lowHalf: Record<string, number> = { COLD: 0, NEUTRAL: 0, HOT: 0 };
    const highHalf: Record<string, number> = { COLD: 0, NEUTRAL: 0, HOT: 0 };
    let low = 0;
    let high = 0;
    for (let i = 0; i < 20000; i++) {
      const cardId = `CARD_${i}`;
      const u = unitFromString(`leak|form|${cardId}|0`);
      if (formBandOf(u) !== "HOT") continue;
      const hint = formHint("leak", cardId, 0, r);
      const posInBand = (u - 2 / 3) * 3;
      if (posInBand < 0.5) {
        lowHalf[hint]++;
        low++;
      } else {
        highHalf[hint]++;
        high++;
      }
    }
    for (const band of FORM_HINT_BANDS) {
      expect(Math.abs(lowHalf[band] / low - highHalf[band] / high)).toBeLessThan(0.03);
    }
  });
});

describe("hint posterior helpers", () => {
  it("reliability 1/3 is uninformative: posterior form = 1 for every hint", () => {
    for (const band of FORM_HINT_BANDS) {
      expect(hintPosteriorMeanU(band, 1 / 3)).toBeCloseTo(0.5, 12);
      expect(hintPosteriorForm(band, 1 / 3, 0.39)).toBeCloseTo(1, 12);
    }
  });

  it("posterior is mean-preserving over the uniform hint marginal", () => {
    for (const r of [0.4, 0.6, 0.8, 1]) {
      const mean =
        FORM_HINT_BANDS.reduce((s, band) => s + hintPosteriorMeanU(band, r), 0) / 3;
      expect(mean).toBeCloseTo(0.5, 12);
    }
  });

  it("posterior ordering follows the hint direction for informative reliability", () => {
    const r = 0.7;
    expect(hintPosteriorMeanU("COLD", r)).toBeLessThan(hintPosteriorMeanU("NEUTRAL", r));
    expect(hintPosteriorMeanU("NEUTRAL", r)).toBeLessThan(hintPosteriorMeanU("HOT", r));
  });
});

describe("contract v1.1 additivity", () => {
  it("hints is optional and absent by default (v1.0 configs unchanged)", () => {
    expect(mergeConfig(undefined).hints).toBeUndefined();
    expect(C13V1_CONFIG.hints).toBeUndefined();
    const withHints = mergeConfig({ hints: { hintReliability: 0.7 } });
    expect(withHints.hints).toEqual({ hintReliability: 0.7 });
  });

  it("formFor is untouched by the hint module (same values as direct u mapping)", () => {
    const u = unitFromString(`x|form|CARD_1|2`);
    expect(formFor("x", "CARD_1", 2, 0.39)).toBeCloseTo(1 - 0.39 + 2 * 0.39 * u, 12);
  });
});

describe("analytic harness ⇔ real bots agreement (Ticket G)", () => {
  const config: EngineConfig = { ...C13V1_CONFIG, hints: { hintReliability: 0.7 } };
  const formless: EngineConfig = { ...config, formSpread: 0 };
  const cards = generateCardSet(`${SEED}|cards`, config.cardGen);
  const t = config.thresholds.thresholdShape
    ? Array.from({ length: config.fixtureCount }, (_, r) =>
        Math.round(
          config.thresholds.base *
            Math.pow(config.thresholds.growth, r) *
            (r === config.fixtureCount - 1 ? config.thresholds.bossMult : 1) *
            (config.thresholds.thresholdShape?.[r] ?? 1),
        ),
      )
    : [];

  it("assisted & reader: analytic outcomes match the real engine on 40 boards (both push tolerances)", () => {
    for (const kAssisted of [0.5, 0.35]) {
      const gate = assistedPushGate(config.formSpread, kAssisted);
      for (let i = 0; i < 40; i++) {
        const board = generateBoard(`${SEED}#${i}`, cards, config);
        const ctx = buildContext(board, config);
        const { data } = precomputeBoard(config, formless, cards, SEED, i);

        const realA = runAssisted(ctx, kAssisted);
        const analyticA = bandRounds(data.chaser, data.mids, t, config.bustKeep, config.fullClearBonus, gate);
        expect(analyticA.rounds).toBe(realA.roundsCleared);
        expect(analyticA.final).toBeCloseTo(realA.finalScore, 9);
        expect(analyticA.fullClear).toBe(realA.outcome === "fullclear");

        const realR = runReader(ctx, kAssisted);
        const rd = readerDataFor(data, config, 0.7);
        const analyticR = bandRounds(rd.scores, rd.mids, t, config.bustKeep, config.fullClearBonus, gate);
        expect(analyticR.rounds).toBe(realR.roundsCleared);
        expect(analyticR.final).toBeCloseTo(realR.finalScore, 9);
        expect(analyticR.fullClear).toBe(realR.outcome === "fullclear");
      }
    }
  });

  it("reader at reliability 1/3 plays exactly like assisted", () => {
    const flat: EngineConfig = { ...config, hints: { hintReliability: 1 / 3 } };
    const flatCards = generateCardSet(`${SEED}|cards`, flat.cardGen);
    for (let i = 0; i < 20; i++) {
      const board = generateBoard(`${SEED}#${i}`, flatCards, flat);
      const ctx = buildContext(board, flat);
      const a = runAssisted(ctx);
      const r = runReader(ctx);
      expect(r.finalScore).toBe(a.finalScore);
      expect(r.outcome).toBe(a.outcome);
      expect(r.choiceLog).toEqual(a.choiceLog);
    }
  });
});
