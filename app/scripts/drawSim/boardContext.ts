/**
 * Shared per-board fast path for the sim harness.
 *
 * Precomputes, once per board, everything the oracle enumeration and the P3
 * Monte-Carlo estimator need as flat arrays:
 *   eff[r*N + c]       = rating × form × fixtureMult   (form known — oracle)
 *   ratingMod[r*N + c] = rating × fixtureMult          (form unknown — P3 MC)
 * plus small integer tag ids for synergy chain counting.
 *
 * All values are computed with the engine's own scoring functions, so the
 * fast path cannot drift from the engine.
 */

import {
  fixtureMultFor,
  formFor,
  chainMult,
  type BoardSpec,
  type Card,
  type EngineConfig,
} from "../../src/lib/drawEngine";

export interface BoardContext {
  board: BoardSpec;
  config: EngineConfig;
  /** Flattened offers, row-major: cards[row * offers + offer]. */
  cards: Card[];
  rows: number;
  offers: number;
  /** Fixture count. */
  R: number;
  /** Total offer slots (rows × offers). */
  N: number;
  thresholds: number[];
  eff: Float64Array;
  ratingMod: Float64Array;
  /** Local club tag ids per card (0..numClubs-1). */
  clubIds: number[][];
  nationIds: Int32Array;
  eraIds: Int32Array;
  numClubs: number;
  numNations: number;
  numEras: number;
}

export function buildContext(board: BoardSpec, config: EngineConfig): BoardContext {
  const cards: Card[] = [];
  for (const row of board.rows) for (const card of row) cards.push(card);
  const N = cards.length;
  const R = board.fixtures.length;

  const eff = new Float64Array(R * N);
  const ratingMod = new Float64Array(R * N);
  for (let r = 0; r < R; r++) {
    const fixture = board.fixtures[r];
    for (let c = 0; c < N; c++) {
      const card = cards[c];
      const rm = card.rating * fixtureMultFor(card, fixture);
      ratingMod[r * N + c] = rm;
      eff[r * N + c] = rm * formFor(board.seed, card.id, r, config.formSpread);
    }
  }

  const clubMap = new Map<string, number>();
  const nationMap = new Map<string, number>();
  const eraMap = new Map<string, number>();
  const localId = (map: Map<string, number>, tag: string): number => {
    let id = map.get(tag);
    if (id === undefined) {
      id = map.size;
      map.set(tag, id);
    }
    return id;
  };
  const clubIds = cards.map((card) => card.clubs.map((t) => localId(clubMap, t)));
  const nationIds = new Int32Array(cards.map((card) => localId(nationMap, card.nation)));
  const eraIds = new Int32Array(cards.map((card) => localId(eraMap, card.era)));

  return {
    board,
    config,
    cards,
    rows: board.rows.length,
    offers: board.rows[0].length,
    R,
    N,
    thresholds: board.fixtures.map((f) => f.threshold),
    eff,
    ratingMod,
    clubIds,
    nationIds,
    eraIds,
    numClubs: clubMap.size,
    numNations: nationMap.size,
    numEras: eraMap.size,
  };
}

/**
 * Squad synergy multiplier from chain maxima, mirroring
 * squadSynergies/chainMult exactly: per family the largest chain's table
 * multiplier, granted only when > 1, top maxSynergyFamilies kept.
 */
export function synergyMultFromMaxima(
  config: EngineConfig,
  maxClub: number,
  maxNation: number,
  maxEra: number,
): number {
  const mults = [chainMult(maxClub, config), chainMult(maxNation, config), chainMult(maxEra, config)]
    .filter((m) => m > 1)
    .sort((a, b) => b - a)
    .slice(0, config.maxSynergyFamilies);
  let out = 1;
  for (const m of mults) out *= m;
  return out;
}
