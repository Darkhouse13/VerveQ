/**
 * THE WEEKEND — vote card display rules (EYE-TEST-CONTEXT). Pure.
 *
 * The card locates the memory; it never argues. These helpers turn the
 * served payload's stored facts into display atoms — score orientation,
 * the kickoff day tag, the factual event line. Nothing evaluative is
 * derived here BY RULING (docs/DECISIONS.md): no points, no ratings, no
 * derived metrics.
 */

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

// ── Today's Ten ──

/** The device's local midnight — what "today" means to the voter. Sent with
 *  serve/vote so the ten rolls over at his midnight, not Greenwich's; the
 *  server clamps it (lib/fantasyCrowd.todayStartOf). */
export function localDayStart(now: number = Date.now()): number {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}
