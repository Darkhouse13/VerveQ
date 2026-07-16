/**
 * P5 — determinism property tests for THE DRAW engine.
 * seed + choiceLog ⇒ identical result; state serialization round-trips;
 * form never depends on user choices; applyChoice never mutates its input.
 */

import { describe, expect, it } from "vitest";
import {
  applyChoice,
  DEFAULT_ENGINE_CONFIG,
  deserializeRunState,
  formFor,
  generateBoard,
  generateCardSet,
  initRun,
  replay,
  rngFromString,
  rngInt,
  serializeRunState,
  toResult,
  type BoardSpec,
  type Choice,
  type EngineConfig,
  type RunResult,
  type RunState,
} from "@/lib/drawEngine";

const config = DEFAULT_ENGINE_CONFIG;
const cardSet = generateCardSet("determinism-cards", config.cardGen);

function board(seed: string): BoardSpec {
  return generateBoard(seed, cardSet, config);
}

/** Seeded random choice for the current phase (bench picks included — Ticket 0.2). */
function randomChoice(state: RunState, cfg: EngineConfig, rng: () => number): Choice {
  if (state.phase === "draft") return { type: "pick", offerIndex: rngInt(rng, cfg.offersPerRow) };
  if (state.phase === "bench") return { type: "bench", squadIndex: rngInt(rng, state.squad.length) };
  return { type: rng() < 0.5 ? "push" : "bank" };
}

/** Seeded random player producing a finished run through the real engine. */
function randomRun(b: BoardSpec, cfg: EngineConfig, rngSeed: string): RunResult {
  const rng = rngFromString(rngSeed);
  let state = initRun(b);
  while (state.phase !== "done") {
    state = applyChoice(b, cfg, state, randomChoice(state, cfg, rng));
  }
  return toResult(state);
}

describe("board determinism", () => {
  it("same (seed, cardSet, config) produces an identical board", () => {
    for (let i = 0; i < 25; i++) {
      const seed = `det-board-${i}`;
      expect(generateBoard(seed, cardSet, config)).toEqual(generateBoard(seed, cardSet, config));
    }
  });

  it("same seed and config produce an identical card set", () => {
    expect(generateCardSet("twice", config.cardGen)).toEqual(generateCardSet("twice", config.cardGen));
  });

  it("different seeds produce different boards", () => {
    const a = board("det-a");
    const c = board("det-b");
    expect(JSON.stringify(a.rows)).not.toEqual(JSON.stringify(c.rows));
  });
});

describe("replay identity (seed + choiceLog => identical result)", () => {
  it("holds across 150 random runs, benchChoice entries included", () => {
    let benchEntries = 0;
    for (let i = 0; i < 150; i++) {
      const b = board(`replay-${i}`);
      const original = randomRun(b, config, `bot-${i}`);
      benchEntries += original.choiceLog.filter((c) => c.type === "bench").length;
      // Every played round must have exactly one bench entry in the log.
      expect(original.choiceLog.filter((c) => c.type === "bench").length).toBe(
        original.rounds.length,
      );
      const replayed = replay(b, config, original.choiceLog);
      expect(replayed).toEqual(original);
    }
    expect(benchEntries).toBeGreaterThan(150); // every run benches at least once
  });
});

describe("state serialization round-trip", () => {
  it("a JSON round-tripped mid-run state finishes identically", () => {
    for (let i = 0; i < 50; i++) {
      const b = board(`serialize-${i}`);
      const rng = rngFromString(`serialize-bot-${i}`);
      const nextChoice = (state: RunState): Choice => randomChoice(state, config, rng);

      // Play a random prefix (may end mid-draft, in a bench phase, or at a
      // decision), snapshot through JSON, then finish both copies with the
      // same recorded choices.
      let live = initRun(b);
      const prefixLen = 1 + rngInt(rng, config.rows + 2);
      for (let j = 0; j < prefixLen && live.phase !== "done"; j++) {
        live = applyChoice(b, config, live, nextChoice(live));
      }
      let thawed = deserializeRunState(serializeRunState(live));
      expect(thawed).toEqual(live);
      while (live.phase !== "done") {
        const choice = nextChoice(live);
        live = applyChoice(b, config, live, choice);
        thawed = applyChoice(b, config, thawed, choice);
      }
      expect(toResult(thawed)).toEqual(toResult(live));
    }
  });
});

describe("form is a pure function of (boardSeed, cardId, roundIndex)", () => {
  it("formFor is stable and inside [1-f, 1+f]", () => {
    const f = config.formSpread;
    for (let i = 0; i < 200; i++) {
      const value = formFor("form-seed", `CARD_${i}`, i % 5, f);
      expect(value).toBe(formFor("form-seed", `CARD_${i}`, i % 5, f));
      expect(value).toBeGreaterThanOrEqual(1 - f);
      expect(value).toBeLessThanOrEqual(1 + f);
    }
  });

  it("a shared card has identical form across two different draft paths", () => {
    const b = board("form-paths");
    // Both paths pick offer 0 in row 0, then diverge completely; both bench
    // the last squad slot for F1, so the shared card is fielded either way.
    const draft = (laterOffer: number): RunState => {
      let state = initRun(b);
      for (let r = 0; r < config.rows; r++) {
        state = applyChoice(b, config, state, { type: "pick", offerIndex: r === 0 ? 0 : laterOffer });
      }
      state = applyChoice(b, config, state, { type: "bench", squadIndex: config.rows - 1 });
      return state;
    };
    const sharedId = b.rows[0][0].id;
    const formA = draft(1).rounds[0].cards.find((c) => c.cardId === sharedId)?.form;
    const formB = draft(2).rounds[0].cards.find((c) => c.cardId === sharedId)?.form;
    expect(formA).toBeDefined();
    expect(formA).toBe(formB);
  });
});

describe("engine purity", () => {
  it("applyChoice does not mutate its input state", () => {
    const b = board("purity");
    let state = initRun(b);
    while (state.phase !== "done") {
      const frozen = JSON.parse(JSON.stringify(state)) as RunState;
      Object.freeze(state);
      Object.freeze(state.squad);
      Object.freeze(state.rounds);
      Object.freeze(state.choiceLog);
      const choice: Choice =
        state.phase === "draft"
          ? { type: "pick", offerIndex: 0 }
          : state.phase === "bench"
            ? { type: "bench", squadIndex: 0 }
            : { type: "push" };
      const next = applyChoice(b, config, state, choice);
      expect(state).toEqual(frozen);
      state = next;
    }
  });
});
