/**
 * Oracle bot: exhaustive over all offersPerRow^rows draft lines with form
 * known (it reads the true eff matrix).
 *
 * Bank/push is resolved analytically per line: round scores are strictly
 * positive, so the optimal stop policy is provably "push until the first
 * future fail, bank just before it" (or ride a clean line to full clear).
 * This is exhaustive-equivalent over draft × stop policies — see DECISIONS.md.
 *
 * Also produces, from the same enumeration:
 *  - dead-board detection (no line full-clears),
 *  - P4 line diversity (two lines ≥3 slots apart, both within 15% of best),
 *  - the best plan executed through the real engine (consistency-asserted).
 */

import { applyChoice, initRun, toResult, type Choice, type RunResult } from "../../src/lib/drawEngine";
import { synergyMultFromMaxima, type BoardContext } from "./boardContext";

export interface OracleOutcome {
  result: RunResult;
  bestFinal: number;
  /** Offer index chosen per row in the best line. */
  bestLine: number[];
  /** Rounds cleared in the best plan (R = full clear). */
  bestBankAfter: number;
  fullClearPossible: boolean;
  /** Enumeration tree nodes visited. */
  nodes: number;
  ms: number;
  /** P4: two qualifying lines differing in ≥ minSlotDiff slots. */
  diversityOk: boolean;
}

const DIVERSITY_WINDOW = 0.15;
const DIVERSITY_MIN_SLOT_DIFF = 3;

export function runOracle(ctx: BoardContext): OracleOutcome {
  const t0 = performance.now();
  const { rows, offers, R, N, eff, thresholds, config } = ctx;
  const lineCount = Math.pow(offers, rows);
  const finals = new Float64Array(lineCount);
  const clearedCounts = new Int32Array(lineCount);

  const roundSums = new Float64Array(R);
  const clubCounts = new Int32Array(ctx.numClubs);
  const nationCounts = new Int32Array(ctx.numNations);
  const eraCounts = new Int32Array(ctx.numEras);
  const picks = new Int32Array(rows);

  let nodes = 0;
  let bestFinal = -1;
  let bestLeaf = -1;
  let bestBankAfter = 0;
  let fullClearPossible = false;

  const visit = (row: number, leafBase: number): void => {
    nodes++;
    if (row === rows) {
      let maxClub = 0;
      for (let i = 0; i < clubCounts.length; i++) if (clubCounts[i] > maxClub) maxClub = clubCounts[i];
      let maxNation = 0;
      for (let i = 0; i < nationCounts.length; i++) if (nationCounts[i] > maxNation) maxNation = nationCounts[i];
      let maxEra = 0;
      for (let i = 0; i < eraCounts.length; i++) if (eraCounts[i] > maxEra) maxEra = eraCounts[i];
      const synMult = synergyMultFromMaxima(config, maxClub, maxNation, maxEra);

      // Walk the gauntlet: bank right before the first fail, or full-clear.
      let cumulative = 0;
      let final = 0;
      let bankAfter = 0;
      let failed = false;
      for (let r = 0; r < R; r++) {
        const score = roundSums[r] * synMult;
        if (score < thresholds[r]) {
          failed = true;
          final = cumulative; // bank after r cleared rounds (0 ⇒ forced bust for 0)
          bankAfter = r;
          break;
        }
        cumulative += score;
      }
      if (!failed) {
        fullClearPossible = true;
        const fullClear = cumulative * config.fullClearBonus;
        const bankBeforeBoss = cumulative - roundSums[R - 1] * synMult;
        if (fullClear >= bankBeforeBoss) {
          final = fullClear;
          bankAfter = R;
        } else {
          final = bankBeforeBoss;
          bankAfter = R - 1;
        }
      }
      finals[leafBase] = final;
      clearedCounts[leafBase] = bankAfter;
      if (final > bestFinal) {
        bestFinal = final;
        bestLeaf = leafBase;
        bestBankAfter = bankAfter;
      }
      return;
    }

    for (let o = 0; o < offers; o++) {
      const c = row * offers + o;
      picks[row] = o;
      for (let r = 0; r < R; r++) roundSums[r] += eff[r * N + c];
      for (const id of ctx.clubIds[c]) clubCounts[id]++;
      nationCounts[ctx.nationIds[c]]++;
      eraCounts[ctx.eraIds[c]]++;

      visit(row + 1, leafBase * offers + o);

      for (let r = 0; r < R; r++) roundSums[r] -= eff[r * N + c];
      for (const id of ctx.clubIds[c]) clubCounts[id]--;
      nationCounts[ctx.nationIds[c]]--;
      eraCounts[ctx.eraIds[c]]--;
    }
  };
  visit(0, 0);

  // P4 line diversity: any two qualifying lines ≥3 slots apart.
  const qualifying: number[] = [];
  const cutoff = bestFinal * (1 - DIVERSITY_WINDOW);
  for (let i = 0; i < lineCount; i++) if (finals[i] >= cutoff) qualifying.push(i);
  let diversityOk = false;
  outer: for (let a = 0; a < qualifying.length; a++) {
    for (let b = a + 1; b < qualifying.length; b++) {
      let x = qualifying[a];
      let y = qualifying[b];
      let diff = 0;
      for (let r = 0; r < rows; r++) {
        if (x % offers !== y % offers) diff++;
        x = Math.floor(x / offers);
        y = Math.floor(y / offers);
      }
      if (diff >= DIVERSITY_MIN_SLOT_DIFF) {
        diversityOk = true;
        break outer;
      }
    }
  }

  // Decode the best line (leaf index digits are row-major, most significant first).
  const bestLine: number[] = new Array(rows);
  let idx = bestLeaf;
  for (let r = rows - 1; r >= 0; r--) {
    bestLine[r] = idx % offers;
    idx = Math.floor(idx / offers);
  }

  // Execute the best plan through the real engine.
  const log: Choice[] = bestLine.map((offerIndex) => ({ type: "pick", offerIndex }));
  let state = initRun(ctx.board);
  for (const choice of log) state = applyChoice(ctx.board, config, state, choice);
  // Decisions: (bankAfter - 1) pushes then bank, or pushes to the boss.
  while (state.phase === "decision") {
    const cleared = state.rounds.length; // all cleared so far in decision phase
    const wantMore = bestBankAfter > cleared;
    state = applyChoice(ctx.board, config, state, wantMore ? { type: "push" } : { type: "bank" });
  }
  const result = toResult(state);
  if (Math.abs(result.finalScore - bestFinal) > 1e-6 * Math.max(1, bestFinal)) {
    throw new Error(
      `Oracle fast path (${bestFinal}) disagrees with engine replay (${result.finalScore}) on board ${ctx.board.seed}`,
    );
  }

  return {
    result,
    bestFinal,
    bestLine,
    bestBankAfter,
    fullClearPossible,
    nodes,
    ms: performance.now() - t0,
    diversityOk,
  };
}

/**
 * Dead-board detector: a board is dead when NO draft line can full-clear even
 * with form known. Exact by construction — shares the oracle enumeration.
 * Standalone entry point for production board generation.
 */
export function detectDeadBoard(ctx: BoardContext): boolean {
  return !runOracle(ctx).fullClearPossible;
}
