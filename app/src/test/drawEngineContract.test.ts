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

  it("chains below 3 grant nothing; chain 6 grants x3; length clamps to the table end", () => {
    const six = Array.from({ length: 6 }, (_, i) => mkCard(`C${i}`, 70));
    const synergies = squadSynergies(six, config);
    const club = synergies.find((s) => s.family === "club");
    expect(club).toEqual({ family: "club", tag: "CLUB_A", chain: 6, mult: 3.0 });
    const pair = squadSynergies(six.slice(0, 2), config);
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

describe("run settlement", () => {
  const rows = [
    [mkCard("R0A", 80), mkCard("R0B", 70)],
    [mkCard("R1A", 80, { clubs: ["CLUB_B"] }), mkCard("R1B", 70)],
  ];
  // Squad via offer 0: 80 + 80 = 160 per round (no 3-chain, spread 0).

  it("bank ends the run with final = cumulative", () => {
    const board = mkBoard(rows, [mkFixture(0, 100), mkFixture(1, 100, { isBoss: true })]);
    let state = draftAll(board, exactConfig);
    expect(state.phase).toBe("decision");
    expect(state.cumulative).toBe(160);
    state = applyChoice(board, exactConfig, state, { type: "bank" });
    const result = toResult(state);
    expect(result.outcome).toBe("banked");
    expect(result.finalScore).toBe(160);
    expect(result.roundsCleared).toBe(1);
  });

  it("failing a round busts: final = cumulative x bustKeep", () => {
    const board = mkBoard(rows, [mkFixture(0, 100), mkFixture(1, 10000, { isBoss: true })]);
    let state = draftAll(board, exactConfig);
    state = applyChoice(board, exactConfig, state, { type: "push" });
    const result = toResult(state);
    expect(result.outcome).toBe("busted");
    expect(result.finalScore).toBe(160 * exactConfig.bustKeep);
    expect(result.roundsCleared).toBe(1);
    expect(result.rounds).toHaveLength(2);
  });

  it("failing F1 immediately settles at 0", () => {
    const board = mkBoard(rows, [mkFixture(0, 10000), mkFixture(1, 10000, { isBoss: true })]);
    const state = draftAll(board, exactConfig);
    const result = toResult(state);
    expect(result.outcome).toBe("busted");
    expect(result.finalScore).toBe(0);
    expect(result.roundsCleared).toBe(0);
  });

  it("clearing the boss grants the full-clear bonus", () => {
    const board = mkBoard(rows, [mkFixture(0, 100), mkFixture(1, 100, { isBoss: true })]);
    let state = draftAll(board, exactConfig);
    state = applyChoice(board, exactConfig, state, { type: "push" });
    const result = toResult(state);
    expect(result.outcome).toBe("fullclear");
    expect(result.finalScore).toBe(320 * exactConfig.fullClearBonus);
    expect(result.roundsCleared).toBe(2);
  });

  it("rejects illegal choices", () => {
    const board = mkBoard(rows, [mkFixture(0, 100), mkFixture(1, 100, { isBoss: true })]);
    const fresh = initRun(board);
    expect(() => applyChoice(board, exactConfig, fresh, { type: "bank" })).toThrow();
    expect(() => applyChoice(board, exactConfig, fresh, { type: "pick", offerIndex: 2 })).toThrow();
    const decided = draftAll(board, exactConfig);
    expect(() => applyChoice(board, exactConfig, decided, { type: "pick", offerIndex: 0 })).toThrow();
    const done = applyChoice(board, exactConfig, decided, { type: "bank" });
    expect(() => applyChoice(board, exactConfig, done, { type: "push" })).toThrow();
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
