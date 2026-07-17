/**
 * Ticket E4 — the Daily Deck slice ACCEPTANCE SCORER, pinned in one place.
 *
 * sliceDeck (engine, pure) takes an injected scorer; this module is the one
 * true implementation both the acceptance harness (calibrate --eval
 * --slicerotation) and the future serving layer must build with the SAME
 * pins, or they will pick different slices for the same dateSeed.
 *
 * The scorer probes each feasible candidate slice on FIXED internal seeds
 * ("sliceProbe#<i>" — unrelated to served board seeds and acceptance seeds,
 * so this is generator policy, not reroll assist) and scores a WEIGHTED trade
 * between the two gate-relevant probe measures:
 *   - dead probe boards (⇒ P0-set, budget ~0.5% = ~5/1024), and
 *   - chaser full-clears above the P1d ceiling (budget to the 25% band edge
 *     from the realized ~21–22% is ~36/1024).
 * Deeper chains lift both together — a narrow Pareto frontier — and the two
 * budgets differ ~7×, so one dead board trades against ~7 FC-excess boards
 * (FC_UNIT ≈ DEAD_UNIT/7). A lexicographic FC-first screen measured 0.3pp
 * WORSE on P0 while leaving 3.6pp of P1d unused; a pure dead-first screen
 * busts P1d at 26.6%. Triple count breaks ties toward chain-rich decks.
 *
 * The early-exit target accepts the first combo at or under the FC ceiling
 * with at most SLICE_PROBE_DEAD_MAX dead; otherwise best-of-comboCandidates
 * on the weighted score.
 *
 * Everything here is pure and deterministic, satisfying sliceDeck's callback
 * contract.
 */

import {
  generateBoard,
  sliceTripleScore,
  type Card,
  type EngineConfig,
} from "../../src/lib/drawEngine";
import { buildContext } from "./boardContext";
import { detectDeadBoard } from "./oracle";
import { runChaser } from "./bots";

/** Probe-board count — sized so probe noise (se ≈ 0.10pp) sits well below
 * the real dead-rate spread across feasible combos (0.27%–1.47% measured at
 * 1500 probes). At 1024 probes the weak-slice tail was probe-lucky fallback
 * picks: slices screened at ~0.2% realized up to 1.3% on acceptance. */
export const SLICE_PROBE_BOARDS = 2048;

/** Early-exit bar: at most this many dead probe boards (~0.2% intrinsic —
 * comfortably inside the 0.5% pooled budget, so the search keeps hunting for
 * genuinely dense slices instead of settling at the budget edge). */
export const SLICE_PROBE_DEAD_MAX = 4;

/** Chaser full-clear ceiling on probes — the P1d band edge itself; the
 * weighted penalty below (not a hard screen) handles excess. Frontier data:
 * no ceiling pooled P1d 26.6% (P0 99.54); hard 21% ceiling pooled 19.7% but
 * P0 ~99.0; hard 24% ceiling pooled 21.4% but P0 99.24. */
export const SLICE_PROBE_CHASER_FC_MAX = Math.floor(0.25 * SLICE_PROBE_BOARDS);

// Weighted trade: one dead probe board is ~7× scarcer than one FC-excess
// board (see header), and triples (≤~1e4) can never outvote either.
const DEAD_UNIT = 1e6;
const FC_UNIT = 1.5e5;

/** The early-exit score target for sliceDeck's `scoreTarget` parameter:
 * reachable only with fcExcess = 0 AND at most SLICE_PROBE_DEAD_MAX dead
 * (any FC excess subtracts ≥ FC_UNIT, more than the triple tie-break adds). */
export const SLICE_SCORE_TARGET = (SLICE_PROBE_BOARDS - SLICE_PROBE_DEAD_MAX) * DEAD_UNIT;

/** Build the pinned joint scorer for a serving config (c13-1 in production). */
export function makeSliceAcceptanceScorer(config: EngineConfig): (slice: Card[]) => number {
  return (slice) => {
    let clear = 0;
    let chaserFc = 0;
    for (let i = 0; i < SLICE_PROBE_BOARDS; i++) {
      const board = generateBoard(`sliceProbe#${i}`, slice, config);
      const ctx = buildContext(board, config);
      if (!detectDeadBoard(ctx)) clear++;
      if (runChaser(ctx).outcome === "fullclear") chaserFc++;
    }
    const fcExcess = Math.max(0, chaserFc - SLICE_PROBE_CHASER_FC_MAX);
    return clear * DEAD_UNIT - fcExcess * FC_UNIT + sliceTripleScore(slice);
  };
}
