/**
 * useNextToday — reads today's state of the four dailies (the same queries
 * Home's Today row reads) and resolves the "Next today" target for a result
 * screen. The daily on screen is not queried: it is the one just finished.
 */
import { useQuery } from "convex/react";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferredDailySport } from "@/hooks/usePreferredDailySport";
import { api } from "../../../../../convex/_generated/api";
import { nextTodayFrom, type NextToday, type TodayGame } from "./nextToday";

type AttemptStatus = { completed: boolean; forfeited: boolean } | null | undefined;
type GameToday = { daily?: { status: string } | null } | null | undefined;

/** A spent attempt (finished or forfeited) is done for the day; none yet is not. */
function attemptDone(status: AttemptStatus): boolean | undefined {
  if (status === undefined) return undefined;
  return status ? status.completed || status.forfeited : false;
}

function gameDone(today: GameToday): boolean | undefined {
  if (today === undefined) return undefined;
  return today?.daily?.status === "completed";
}

export function useNextToday(current: TodayGame | null): NextToday {
  const { accountState } = useAuth();
  const hasSession = accountState !== "loggedOut" && accountState !== "loading";
  const dailySport = usePreferredDailySport();
  const ask = (game: TodayGame) => hasSession && game !== current;

  const quiz = useQuery(
    api.dailyChallenge.getAttemptStatus,
    ask("quiz") ? { sport: dailySport, mode: "quiz" } : "skip",
  );
  const survival = useQuery(
    api.dailyChallenge.getAttemptStatus,
    ask("survival") ? { sport: "football", mode: "survival" } : "skip",
  );
  const older = useQuery(api.whosOlder.getToday, ask("older") ? {} : "skip");
  const letters = useQuery(api.missingLetters.getToday, ask("letters") ? {} : "skip");

  return nextTodayFrom(current, {
    quiz: attemptDone(quiz),
    survival: attemptDone(survival),
    older: gameDone(older as GameToday),
    letters: gameDone(letters as GameToday),
  });
}
