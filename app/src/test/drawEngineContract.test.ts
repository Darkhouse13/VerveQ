/**
 * THE DRAW — game-rules contract tests: board shape, synthetic-only content,
 * synergy math, fixture modifiers, bank/push/bust/fullclear settlement,
 * choice validation, and the layout eligibility check.
 */

import { describe, expect, it } from "vitest";
import {
  applyChoice,
  checkLayout,
  DEFAULT_ENGINE_CONFIG,
  generateBoard,
  generateCardSet,
  initRun,
  mergeConfig,
  scoreRound,
  squadSynergies,
  toResult,
  type BoardSpec,
  type Card,
  type Choice,
  type EngineConfig,
  type Fixture,
  type RunState,
} from "@/lib/drawEngine";

const config = DEFAULT_ENGINE_CONFIG;
const cardSet = generateCardSet("contract-cards", config.cardGen);

describe("board contract", () => {
  const board = generateBoard("contract-board", cardSet, config);

  it("deals 6 rows of 3 distinct cards and 5 fixtures with the boss last", () => {
    expect(board.rows).toHaveLength(6);
    for (const row of board.rows) expect(row).toHaveLength(3);
    const ids = board.rows.flat().map((c) => c.id);
    expect(new Set(ids).size).toBe(18);
    expect(board.fixtures).toHaveLength(5);
    expect(board.fixtures.map((f) => f.isBoss)).toEqual([false, false, false, false, true]);
  });

  it("exposes the whole gauntlet with thresholds from board start", () => {
    const { base, growth, bossMult } = config.thresholds;
    board.fixtures.forEach((fixture, i) => {
      expect(fixture.index).toBe(i);
      expect(fixture.archetypeId).toMatch(/^ARCH_/);
      expect(fixture.threshold).toBe(Math.round(base * Math.pow(growth, i) * (fixture.isBoss ? bossMult : 1)));
    });
    // Thresholds strictly increase with the default curve.
    for (let i = 1; i < 5; i++) {
      expect(board.fixtures[i].threshold).toBeGreaterThan(board.fixtures[i - 1].threshold);
    }
  });

  it("applies the optional thresholdShape as a per-fixture multiplier (Ticket 0.1 C3)", () => {
    const shape = [1, 1.2, 1, 0.9, 1.5];
    const shaped = generateBoard("contract-board", cardSet, {
      ...config,
      thresholds: { ...config.thresholds, thresholdShape: shape },
    });
    const { base, growth, bossMult } = config.thresholds;
    shaped.fixtures.forEach((fixture, i) => {
      expect(fixture.threshold).toBe(
        Math.round(base * Math.pow(growth, i) * (fixture.isBoss ? bossMult : 1) * shape[i]),
      );
    });
    // Omitting thresholdShape reproduces the v0 curve exactly.
    const bare = generateBoard("contract-board", cardSet, {
      ...config,
      thresholds: { base, growth, bossMult },
    });
    expect(bare.fixtures.map((f) => f.threshold)).toEqual(board.fixtures.map((f) => f.threshold));
  });
});

describe("synthetic-only card content", () => {
  it("uses generated tag vocabularies and fake names, ratings 60-95", () => {
    for (const card of cardSet) {
      expect(card.rating).toBeGreaterThanOrEqual(60);
      expect(card.rating).toBeLessThanOrEqual(95);
      expect(card.clubs.length).toBeGreaterThanOrEqual(1);
      expect(card.clubs.length).toBeLessThanOrEqual(3);
      for (const club of card.clubs) expect(club).toMatch(/^CLUB_[A-Z]+$/);
      expect(card.nation).toMatch(/^NATION_[A-Z]+$/);
      expect(card.era).toMatch(/^ERA_\d{4}s$/);
      expect(["GK", "DEF", "MID", "ATT"]).toContain(card.position);
      expect(card.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    }
  });
});

/** Hand-built fixtures/cards for exact-math tests (formSpread 0 => form = 1). */
function mkCard(id: string, rating: number, overrides: Partial<Card> = {}): Card {
  return {
    id,
    name: "Testcard Testcard",
    rating,
    clubs: ["CLUB_A"],
    nation: "NATION_A",
    era: "ERA_1990s",
    eraIndex: 3,
    position: "MID",
    ...overrides,
  };
}

function mkFixture(index: number, threshold: number, opts: Partial<Fixture> = {}): Fixture {
  return { index, archetypeId: "ARCH_TEST", modifiers: [], threshold, isBoss: false, ...opts };
}

const exactConfig: EngineConfig = {
  ...config,
  rows: 2,
  offersPerRow: 2,
  fixtureCount: 2,
  formSpread: 0,
};

function mkBoard(rows: Card[][], fixtures: Fixture[]): BoardSpec {
  return { seed: "exact-board", rows, fixtures };
}

function draftAll(board: BoardSpec, cfg: EngineConfig, offerIndex = 0): RunState {
  let state = initRun(board);
  for (let r = 0; r < cfg.rows; r++) state = applyChoice(board, cfg, state, { type: "pick", offerIndex });
  return state;
}

describe("synergy math", () => {
  it("grants the table multiplier for the largest chain per family and stacks families", () => {
    const squad = [
      mkCard("S1", 80, { clubs: ["CLUB_A", "CLUB_B"], nation: "NATION_A", era: "ERA_1990s" }),
      mkCard("S2", 80, { clubs: ["CLUB_A"], nation: "NATION_A", era: "ERA_1990s" }),
      mkCard("S3", 80, { clubs: ["CLUB_A"], nation: "NATION_A", era: "ERA_2000s", eraIndex: 4 }),
      mkCard("S4", 80, { clubs: ["CLUB_A"], nation: "NATION_B", era: "ERA_2000s", eraIndex: 4 }),
    ];
    const synergies = squadSynergies(squad, config);
    // club: CLUB_A chain 4 => x2.0; nation: NATION_A chain 3 => x1.5; era: max chain 2 => nothing.
    expect(synergies).toEqual([
      { family: "club", tag: "CLUB_A", chain: 4, mult: 2.0 },
      { family: "nation", tag: "NATION_A", chain: 3, mult: 1.5 },
    ]);
  });

  it("chains below 3 grant nothing; chain 5 grants x2.5; length clamps to the table end", () => {
    const five = Array.from({ length: 5 }, (_, i) => mkCard(`C${i}`, 70));
    const club = squadSynergies(five, config).find((s) => s.family === "club");
    expect(club).toEqual({ family: "club", tag: "CLUB_A", chain: 5, mult: 2.5 });
    // Longer lists (not reachable with a 5-card field) clamp to the table end.
    const six = Array.from({ length: 6 }, (_, i) => mkCard(`C${i}`, 70));
    expect(squadSynergies(six, config).find((s) => s.family === "club")?.mult).toBe(2.5);
    const pair = squadSynergies(five.slice(0, 2), config);
    expect(pair).toEqual([]);
  });

  it("caps granted families at maxSynergyFamilies, keeping the largest multipliers", () => {
    const squad = Array.from({ length: 4 }, (_, i) => mkCard(`C${i}`, 70)); // 4-chain in all 3 families
    const capped = squadSynergies(squad, { ...config, maxSynergyFamilies: 1 });
    expect(capped).toHaveLength(1);
    expect(capped[0].mult).toBe(2.0);
  });
});

describe("round scoring with fixture modifiers", () => {
  it("score = sum(rating x form x fixtureMult) x synergyMult, form=1 at spread 0", () => {
    const squad = [
      mkCard("A", 80, { position: "DEF", clubs: ["CLUB_A"] }),
      mkCard("B", 60, { position: "ATT", clubs: ["CLUB_B"] }),
    ];
    const fixture = mkFixture(0, 100, {
      modifiers: [
        { kind: "position", value: "DEF", mult: 2.0 },
        { kind: "position", value: "ATT", mult: 0.5 },
      ],
    });
    const round = scoreRound("exact-board", squad, fixture, exactConfig);
    // 80*2 + 60*0.5 = 190, no chain >= 3 => synergy x1.
    expect(round.baseSum).toBe(190);
    expect(round.synergyMult).toBe(1);
    expect(round.score).toBe(190);
    expect(round.cleared).toBe(true);
  });

  it("a card matching several modifiers multiplies them all; era comparisons work", () => {
    const squad = [mkCard("A", 100, { position: "DEF", eraIndex: 1, era: "ERA_1970s" })];
    const fixture = mkFixture(0, 1, {
      modifiers: [
        { kind: "position", value: "DEF", mult: 2.0 },
        { kind: "eraBefore", value: 3, mult: 1.5 },
        { kind: "eraAtLeast", value: 3, mult: 9 }, // must NOT match
      ],
    });
    const round = scoreRound("exact-board", squad, fixture, exactConfig);
    expect(round.cards[0].fixtureMult).toBe(3.0);
    expect(round.score).toBe(300);
  });
});

describe("bench mechanic (Ticket 0.2 A1/A2)", () => {
  // rows = 4 → squad 4, fielded 3. Offer 0 squad: three CLUB_A 80s + one CLUB_X 80.
  const benchConfig: EngineConfig = { ...exactConfig, rows: 4, fixtureCount: 2 };
  // A/B/C share only CLUB_A (distinct nations/eras keep the other families quiet).
  const rows = [
    [mkCard("A", 80), mkCard("A2", 60)],
    [mkCard("B", 80, { nation: "NATION_B", era: "ERA_2000s", eraIndex: 4 }), mkCard("B2", 60)],
    [mkCard("C", 80, { nation: "NATION_C", era: "ERA_1980s", eraIndex: 2 }), mkCard("C2", 60)],
    [mkCard("D", 80, { clubs: ["CLUB_X"], nation: "NATION_X", era: "ERA_1960s", eraIndex: 0 }), mkCard("D2", 60)],
  ];
  const board = mkBoard(rows, [mkFixture(0, 100), mkFixture(1, 100, { isBoss: true })]);

  it("synergy counts fielded cards only; the benched card's tags are excluded", () => {
    // Bench D → fielded A,B,C: CLUB_A chain 3 ⇒ (3×80) × 1.5 = 360.
    const state = draftAll(board, benchConfig);
    expect(state.phase).toBe("bench");
    const viaD = applyChoice(board, benchConfig, state, { type: "bench", squadIndex: 3 });
    expect(viaD.rounds[0].benchedCardId).toBe("D");
    expect(viaD.rounds[0].cards).toHaveLength(3);
    expect(viaD.rounds[0].score).toBe(360);
    // Bench C → fielded A,B,D: largest CLUB_A chain 2 ⇒ no synergy, 240.
    const viaC = applyChoice(board, benchConfig, state, { type: "bench", squadIndex: 2 });
    expect(viaC.rounds[0].benchedCardId).toBe("C");
    expect(viaC.rounds[0].score).toBe(240);
  });

  it("every round takes its own bench pick and it is replayed from the log", () => {
    let state = draftAll(board, benchConfig);
    state = applyChoice(board, benchConfig, state, { type: "bench", squadIndex: 3 });
    state = applyChoice(board, benchConfig, state, { type: "push" });
    expect(state.phase).toBe("bench");
    state = applyChoice(board, benchConfig, state, { type: "bench", squadIndex: 0 });
    const result = toResult(state);
    expect(result.rounds.map((r) => r.benchedCardId)).toEqual(["D", "A"]);
    expect(result.choiceLog.filter((c) => c.type === "bench")).toHaveLength(2);
  });
});

describe("run settlement", () => {
  const rows = [
    [mkCard("R0A", 80), mkCard("R0B", 70)],
    [mkCard("R1A", 80, { clubs: ["CLUB_B"] }), mkCard("R1B", 70)],
  ];
  // Squad via offer 0: R0A + R1A; benching index 1 fields R0A alone ⇒ 80 per
  // round (form 1 at spread 0, no modifiers, no chain).
  const bench1: Choice = { type: "bench", squadIndex: 1 };

  it("bank ends the run with final = cumulative", () => {
    const board = mkBoard(rows, [mkFixture(0, 50), mkFixture(1, 50, { isBoss: true })]);
    let state = draftAll(board, exactConfig);
    expect(state.phase).toBe("bench");
    state = applyChoice(board, exactConfig, state, bench1);
    expect(state.phase).toBe("decision");
    expect(state.cumulative).toBe(80);
    state = applyChoice(board, exactConfig, state, { type: "bank" });
    const result = toResult(state);
    expect(result.outcome).toBe("banked");
    expect(result.finalScore).toBe(80);
    expect(result.roundsCleared).toBe(1);
  });

  it("failing a round busts: final = cumulative x bustKeep", () => {
    const board = mkBoard(rows, [mkFixture(0, 50), mkFixture(1, 10000, { isBoss: true })]);
    let state = draftAll(board, exactConfig);
    state = applyChoice(board, exactConfig, state, bench1);
    state = applyChoice(board, exactConfig, state, { type: "push" });
    state = applyChoice(board, exactConfig, state, bench1);
    const result = toResult(state);
    expect(result.outcome).toBe("busted");
    expect(result.finalScore).toBe(80 * exactConfig.bustKeep);
    expect(result.roundsCleared).toBe(1);
    expect(result.rounds).toHaveLength(2);
  });

  it("failing F1 immediately settles at 0", () => {
    const board = mkBoard(rows, [mkFixture(0, 10000), mkFixture(1, 10000, { isBoss: true })]);
    let state = draftAll(board, exactConfig);
    state = applyChoice(board, exactConfig, state, bench1);
    const result = toResult(state);
    expect(result.outcome).toBe("busted");
    expect(result.finalScore).toBe(0);
    expect(result.roundsCleared).toBe(0);
  });

  it("clearing the boss grants the full-clear bonus", () => {
    const board = mkBoard(rows, [mkFixture(0, 50), mkFixture(1, 50, { isBoss: true })]);
    let state = draftAll(board, exactConfig);
    state = applyChoice(board, exactConfig, state, bench1);
    state = applyChoice(board, exactConfig, state, { type: "push" });
    state = applyChoice(board, exactConfig, state, bench1);
    const result = toResult(state);
    expect(result.outcome).toBe("fullclear");
    expect(result.finalScore).toBe(160 * exactConfig.fullClearBonus);
    expect(result.roundsCleared).toBe(2);
  });

  it("rejects illegal choices", () => {
    const board = mkBoard(rows, [mkFixture(0, 50), mkFixture(1, 50, { isBoss: true })]);
    const fresh = initRun(board);
    expect(() => applyChoice(board, exactConfig, fresh, { type: "bank" })).toThrow();
    expect(() => applyChoice(board, exactConfig, fresh, { type: "bench", squadIndex: 0 })).toThrow();
    expect(() => applyChoice(board, exactConfig, fresh, { type: "pick", offerIndex: 2 })).toThrow();
    const benchPhase = draftAll(board, exactConfig);
    expect(() => applyChoice(board, exactConfig, benchPhase, { type: "pick", offerIndex: 0 })).toThrow();
    expect(() => applyChoice(board, exactConfig, benchPhase, { type: "push" })).toThrow();
    expect(() => applyChoice(board, exactConfig, benchPhase, { type: "bench", squadIndex: 2 })).toThrow();
    expect(() => applyChoice(board, exactConfig, benchPhase, { type: "bench", squadIndex: -1 })).toThrow();
    const decided = applyChoice(board, exactConfig, benchPhase, bench1);
    expect(() => applyChoice(board, exactConfig, decided, { type: "bench", squadIndex: 0 })).toThrow();
    const done = applyChoice(board, exactConfig, decided, { type: "bank" });
    expect(() => applyChoice(board, exactConfig, done, { type: "push" })).toThrow();
  });
});

describe("oracle bench property (Ticket 0.2 A3)", () => {
  it("per-round argmax bench is exhaustive-equivalent (rounds are bench-independent)", () => {
    // Thresholds low enough that every sequence full-clears: independence and
    // optimality can then be asserted over ALL 6^5 bench sequences.
    const cfg: EngineConfig = {
      ...config,
      thresholds: { base: 10, growth: 1.01, bossMult: 1 },
    };
    const set = generateCardSet("bench-property-cards", cfg.cardGen);
    const b = generateBoard("bench-property-board", set, cfg);
    const R = cfg.fixtureCount;
    const S = cfg.rows;

    const runWith = (benchSeq: number[]): { final: number; scores: number[] } => {
      let state = initRun(b);
      for (let r = 0; r < S; r++) state = applyChoice(b, cfg, state, { type: "pick", offerIndex: 0 });
      for (let r = 0; r < R; r++) {
        state = applyChoice(b, cfg, state, { type: "bench", squadIndex: benchSeq[r] });
        if (state.phase === "decision") state = applyChoice(b, cfg, state, { type: "push" });
      }
      const result = toResult(state);
      return { final: result.finalScore, scores: result.rounds.map((x) => x.score) };
    };

    // Per-round single-bench scores from S probe sequences.
    const single: number[][] = Array.from({ length: R }, () => new Array(S).fill(0));
    for (let j = 0; j < S; j++) {
      const probe = runWith(new Array(R).fill(j));
      for (let r = 0; r < R; r++) single[r][j] = probe.scores[r];
    }
    const argmax = single.map((scores) => scores.indexOf(Math.max(...scores)));
    const argmaxFinal = runWith(argmax).final;

    // Exhaustive: every sequence's rounds match the single-bench scores
    // (independence) and none beats the per-round argmax plan.
    let bestFinal = -1;
    const seq = new Array(R).fill(0);
    const total = Math.pow(S, R);
    for (let n = 0; n < total; n++) {
      let x = n;
      for (let r = 0; r < R; r++) {
        seq[r] = x % S;
        x = Math.floor(x / S);
      }
      const run = runWith(seq);
      for (let r = 0; r < R; r++) expect(run.scores[r]).toBe(single[r][seq[r]]);
      if (run.final > bestFinal) bestFinal = run.final;
    }
    expect(argmaxFinal).toBe(bestFinal);
  });
});

describe("layout eligibility", () => {
  it("accepts the default config", () => {
    expect(checkLayout(config)).toMatchObject({ eligible: true, violations: [] });
  });

  it("rejects configs over the hard caps", () => {
    expect(checkLayout({ ...config, offersPerRow: 4 }).eligible).toBe(false);
    expect(checkLayout({ ...config, rows: 7 }).eligible).toBe(false);
    expect(checkLayout({ ...config, fixtureCount: 6 }).eligible).toBe(false);
    expect(checkLayout({ ...config, maxSynergyFamilies: 4 }).eligible).toBe(false);
  });
});

describe("config merging", () => {
  it("deep-merges partial overrides onto the defaults", () => {
    const merged = mergeConfig({ thresholds: { base: 500 }, bustKeep: 0.3 });
    expect(merged.thresholds.base).toBe(500);
    expect(merged.thresholds.growth).toBe(config.thresholds.growth);
    expect(merged.bustKeep).toBe(0.3);
    expect(merged.rows).toBe(6);
  });
});
