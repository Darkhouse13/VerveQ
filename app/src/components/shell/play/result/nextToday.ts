/**
 * "Next today" on a result screen: the next of today's dailies the player has
 * not finished, in Home's Today-row order — then Home, whose Today row holds
 * the rest of the day's games.
 *
 * Two entry points:
 *  - `nextTodayTarget` — the twin dailies (Who's Older / Missing Letters),
 *    which point at each other and then Home;
 *  - `nextTodayFrom` — all four dailies (P3.1 added the Daily Quiz and Daily
 *    Survival), walking the Today row from the one just played. The solo
 *    modes pass `null` and get the first unfinished daily.
 */
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import type { DailyGame } from "@/components/shell/play/whosOlder/WhosOlderRetention";

/** Every daily on Home's Today row: the twins plus the Daily Quiz / Survival. */
export type TodayGame = DailyGame | "quiz" | "survival";

export type NextToday =
  | { kind: "game"; game: TodayGame; route: string }
  | { kind: "home"; route: string };

/** Home's Today row, left to right. */
export const TODAY_ORDER: ReadonlyArray<TodayGame> = ["older", "letters", "quiz", "survival"];

const TODAY_ROUTE: Record<TodayGame, string> = {
  older: SHELL_ROUTES.whosOlderPlay,
  letters: SHELL_ROUTES.missingLettersPlay,
  quiz: SHELL_ROUTES.dailyPlay,
  survival: "/daily-survival",
};

const OTHER: Record<DailyGame, DailyGame> = { older: "letters", letters: "older" };

const HOME: NextToday = { kind: "home", route: SHELL_ROUTES.home };

/**
 * @param current   the daily whose result is on screen
 * @param otherDone whether today's edition of the other daily is finished;
 *                  `undefined` (still loading, or no account yet) points at it.
 */
export function nextTodayTarget(current: DailyGame, otherDone: boolean | undefined): NextToday {
  if (otherDone) return HOME;
  const game = OTHER[current];
  return { kind: "game", game, route: TODAY_ROUTE[game] };
}

/**
 * @param current the daily whose result is on screen, or `null` for a non-daily
 * @param done    per daily, whether today's edition is finished; a missing or
 *                `undefined` entry (still loading, no account yet) counts as
 *                not finished, so the card points at it rather than skipping it.
 */
export function nextTodayFrom(
  current: TodayGame | null,
  done: Partial<Record<TodayGame, boolean | undefined>>,
): NextToday {
  const start = current ? TODAY_ORDER.indexOf(current) + 1 : 0;
  for (let i = 0; i < TODAY_ORDER.length; i++) {
    const game = TODAY_ORDER[(start + i) % TODAY_ORDER.length];
    if (game === current) continue;
    if (done[game] !== true) return { kind: "game", game, route: TODAY_ROUTE[game] };
  }
  return HOME;
}
