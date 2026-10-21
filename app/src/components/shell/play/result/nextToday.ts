/**
 * "Next today" on a daily's result screen: the OTHER daily, until both are
 * done — then Home, whose Today row holds the rest of the day's games.
 */
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import type { DailyGame } from "@/components/shell/play/whosOlder/WhosOlderRetention";

export type NextToday =
  | { kind: "game"; game: DailyGame; route: string }
  | { kind: "home"; route: string };

const DAILY_ROUTE: Record<DailyGame, string> = {
  older: SHELL_ROUTES.whosOlderPlay,
  letters: SHELL_ROUTES.missingLettersPlay,
};

const OTHER: Record<DailyGame, DailyGame> = { older: "letters", letters: "older" };

/**
 * @param current   the daily whose result is on screen
 * @param otherDone whether today's edition of the other daily is finished;
 *                  `undefined` (still loading, or no account yet) points at it.
 */
export function nextTodayTarget(current: DailyGame, otherDone: boolean | undefined): NextToday {
  if (otherDone) return { kind: "home", route: SHELL_ROUTES.home };
  const game = OTHER[current];
  return { kind: "game", game, route: DAILY_ROUTE[game] };
}
