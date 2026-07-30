/**
 * Weekend Fantasy — reclamation court rules (RECLAMATION_COURT_SPEC v1.0.1).
 * PURE.
 *
 * The court hears POSITION VERDICTS only. Everything rule-shaped — the
 * timeline instants, the endorsement threshold, the trial pass test, the
 * argument bounds — lives here, testable without a database; the Convex
 * module is the authorized wrapper.
 *
 * Timeline (per gameweek, all Europe/Paris; finality is Tuesday 23:59):
 *   filing + endorsement close Monday 23:59  = finality − 24h
 *   trial voting closes        Tuesday 21:00 = finality − 2h59m
 *   verdicts + re-score        Tuesday 21:00–23:59
 * The leads are exact offsets from the gameweek's own finalityAt: Monday →
 * Tuesday never crosses a DST change (those land on Sundays), so wall-clock
 * arithmetic and epoch arithmetic agree.
 *
 * Constants marked [placeholder] are the spec's own placeholders — LOCKED as
 * principles, numbers pending live data, changed by owner ticket.
 */

/** Filings per user per gameweek. [placeholder 2] No stake, no currency. */
export const COURT_FILINGS_PER_GAMEWEEK = 2;

/** One-line argument / rebuttal budget, in characters. */
export const COURT_ARGUMENT_MAX_CHARS = 280;

/** Filing + endorsement close this long before finality (Monday 23:59). */
export const COURT_FILING_CLOSE_LEAD_MS = 24 * 60 * 60 * 1000;

/** Trial voting closes this long before finality (Tuesday 21:00). */
export const COURT_VOTING_CLOSE_LEAD_MS = (2 * 60 + 59) * 60 * 1000;

/** Endorsement floor and fraction: max(15, 0.5% of gameweek actives).
 *  [placeholders] */
export const COURT_ENDORSEMENT_FLOOR = 15;
export const COURT_ENDORSEMENT_FRACTION = 0.005;

/** Trial quorum floor and fraction: max(30, 1% of gameweek actives), and the
 *  weighted-yes share a claim must reach. [placeholders] */
export const COURT_QUORUM_FLOOR = 30;
export const COURT_QUORUM_FRACTION = 0.01;
export const COURT_PASS_SHARE = 0.6;

export function filingClosesAt(finalityAt: number): number {
  return finalityAt - COURT_FILING_CLOSE_LEAD_MS;
}

export function votingClosesAt(finalityAt: number): number {
  return finalityAt - COURT_VOTING_CLOSE_LEAD_MS;
}

/**
 * The endorsement threshold for a gameweek.
 *
 * "Gameweek active users" is not defined by the spec (parked as an owner
 * decision); until ~3,000 actives the floor dominates under ANY reading, so
 * the number passed here — distinct squad-holding users — cannot change the
 * outcome at launch scale.
 */
export function endorsementThresholdOf(activeUsers: number): number {
  return Math.max(COURT_ENDORSEMENT_FLOOR, Math.ceil(activeUsers * COURT_ENDORSEMENT_FRACTION));
}

export function quorumOf(activeUsers: number): number {
  return Math.max(COURT_QUORUM_FLOOR, Math.ceil(activeUsers * COURT_QUORUM_FRACTION));
}

/**
 * The trial verdict: passes at quorum AND ≥ 60% weighted yes. Quorum counts
 * RAW voters (a head is a head); the share is weighted (proven eyes count
 * slightly more — the one place rater accuracy has teeth). Fails otherwise;
 * no appeals.
 */
export function trialPasses(args: {
  rawVotes: number;
  weightedYes: number;
  weightedNo: number;
  quorum: number;
}): boolean {
  const { rawVotes, weightedYes, weightedNo, quorum } = args;
  if (rawVotes < quorum) return false;
  const weightedTotal = weightedYes + weightedNo;
  if (weightedTotal <= 0) return false;
  return weightedYes / weightedTotal >= COURT_PASS_SHARE;
}

/** A one-line argument: non-empty, within budget. */
export function validArgument(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= COURT_ARGUMENT_MAX_CHARS;
}
