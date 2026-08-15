/**
 * THE WEEKEND — vote card display rules (EYE-TEST-CONTEXT). Pure.
 *
 * The card locates the memory; it never argues. These helpers turn the
 * served payload's stored facts into display atoms — score orientation,
 * the kickoff day tag, the factual event line. Nothing evaluative is
 * derived here BY RULING (docs/DECISIONS.md): no points, no ratings, no
 * derived metrics.
 */

import { CROWD_UNDO_WINDOW_MS } from "../../convex/lib/fantasyCrowd";

export interface OrientedScore {
  us: number;
  them: number;
}

/** The scoreline read from the player's side — his team's goals first.
 *  Null while the feed carries no goals (absent is absent, never 0). */
export function orientedScore(player: {
  isHome: boolean;
  fixture: { homeGoals: number | null; awayGoals: number | null };
}): OrientedScore | null {
  const { homeGoals, awayGoals } = player.fixture;
  if (homeGoals === null || awayGoals === null) return null;
  return player.isHome ? { us: homeGoals, them: awayGoals } : { us: awayGoals, them: homeGoals };
}

/** "SUN"-style kickoff day, in the device's locale and timezone (the
 *  fixtures-screen convention). `timeZone` is injectable for tests only. */
export function kickoffDayTag(kickoffAt: number, locale: string, timeZone?: string): string {
  return new Date(kickoffAt)
    .toLocaleDateString(locale, {
      weekday: "short",
      ...(timeZone === undefined ? {} : { timeZone }),
    })
    .toUpperCase();
}

export interface VoteCardEvent {
  kind: "goal" | "assist" | "red";
  count: number;
}

/** Factual events only (EYE-TEST-CONTEXT): goals, assists, a red card.
 *  No yellows (noise), nothing derived — excluded by ruling. */
export function voteCardEvents(player: {
  goals: number;
  assists: number;
  redCard: boolean;
}): VoteCardEvent[] {
  const events: VoteCardEvent[] = [];
  if (player.goals > 0) events.push({ kind: "goal", count: player.goals });
  if (player.assists > 0) events.push({ kind: "assist", count: player.assists });
  if (player.redCard) events.push({ kind: "red", count: 1 });
  return events;
}

// ── the consensus reveal (EYE-TEST-TEN) ──

/**
 * Which sentence the reveal speaks. The number itself is always the voter's
 * OWN share — only the framing changes — so the surface never has two
 * percentages to confuse.
 *
 *   first   — below the sample threshold: no percentage exists to show
 *   with    — the voter is in the larger share
 *   against — the voter is in the smaller share
 *
 * Reveal copy is POST-VOTE only (docs/DECISIONS.md): nothing here is ever
 * rendered before the tap, because a crowd number in front of the ballot is
 * the card arguing.
 */
export type RevealTone = "first" | "with" | "against";

export function revealTone(reveal: {
  percent: number | null;
  lowSample: boolean;
  majority: boolean;
}): RevealTone {
  if (reveal.lowSample || reveal.percent === null) return "first";
  return reveal.majority ? "with" : "against";
}

// ── the didn't-see undo (EYE-TEST-SERVE) ──

/**
 * How long the undo toast may live: what is LEFT of the server's offer, not a
 * fresh five seconds. The round trip has already spent some of the window, and
 * a toast that outlives the offer would put an Undo button on screen that the
 * server has decided to refuse.
 *
 * Clamped above by the window itself, so a clock-skewed client cannot leave
 * the toast up indefinitely, and floored at 0 — a caller showing nothing is
 * the honest answer to an offer that has already died in flight.
 */
export function undoToastMs(expiresAt: number, now: number = Date.now()): number {
  if (!Number.isFinite(expiresAt)) return 0;
  const remaining = expiresAt - now;
  if (remaining <= 0) return 0;
  return Math.min(remaining, CROWD_UNDO_WINDOW_MS);
}

/** The toast's subject: the retired game(s), as the server labelled them.
 *  Two only when a combined didn't-see spanned two fixtures. */
export function undoFixtureLine(fixtures: readonly { label: string }[]): string {
  return fixtures.map((fixture) => fixture.label).join(" · ");
}

// ── Today's Ten ──

/** The device's local midnight — what "today" means to the voter. Sent with
 *  serve/vote so the ten rolls over at his midnight, not Greenwich's; the
 *  server clamps it (lib/fantasyCrowd.todayStartOf). */
export function localDayStart(now: number = Date.now()): number {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}
