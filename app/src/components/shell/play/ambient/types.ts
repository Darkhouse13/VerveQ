/**
 * Sanitized, allowlisted ambient view-model.
 *
 * In-game ambient/side panels (roster, standings, metrics, progress) may consume
 * ONLY these shapes — never raw question or room state. Screens are responsible
 * for mapping raw state down to this view-model; the panels stay content-blind.
 *
 * This is the contract the answer-leak ESLint guard enforces for every file in
 * this directory (see `app/eslint.config.js`). Nothing here names a question's
 * text, options, hint, or answer — by design.
 */

/** Live status of a player while a question is open. Never reveals their pick. */
export type RosterState = "answering" | "answered" | "left" | "idle";

export interface RosterEntry {
  id: string;
  name: string;
  state: RosterState;
  isMe?: boolean;
}

export type PickOutcome = "correct" | "wrong" | "missed";

/**
 * A single player's pick — surfaced ONLY on reveal. `label` is the sanitized
 * pick text the screen chose to show; the panel treats it as opaque display data
 * and never derives it from, or correlates it with, the live option list.
 */
export interface RevealPick {
  id: string;
  name: string;
  label: string;
  outcome: PickOutcome;
  points?: number;
  isMe?: boolean;
}

export interface StandingEntry {
  id: string;
  name: string;
  score: number;
  rank: number;
  isMe?: boolean;
}

/**
 * Right-rail metrics. Every field is optional so each mode lights up only what
 * applies (solo Quiz: score/timer; Arena: score/timer; modes with lives/streak/
 * combo set those).
 */
export interface PlayMetrics {
  /** Whole seconds remaining (server-clocked). Omit for untimed modes. */
  seconds?: number;
  /** 0..1 fraction of the time window remaining, drives the timer bar. */
  timeFraction?: number;
  score?: number;
  lives?: number;
  streak?: number;
  combo?: number;
}

export interface PlayProgress {
  current: number;
  total: number;
  /** Optional round context, e.g. "R2/5". */
  roundLabel?: string;
}
