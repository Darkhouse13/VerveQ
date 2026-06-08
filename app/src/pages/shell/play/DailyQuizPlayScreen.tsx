/**
 * Daily Challenge on the v2 shell — REUSES the migrated `QuizPlayView`
 * (centered-column "prototype layout") driven by `useDailyQuiz`, so the Daily
 * quiz looks and plays exactly like solo Quiz on the shell while running the
 * server-authoritative DAILY session (`dailyAttempts`) with its gating intact:
 * one attempt per day, the shared daily set, and the stricter forfeit-on-tab-
 * switch anti-cheat. Quitting forfeits today's attempt (Daily gating), so the
 * exit is wired to the hook's `forfeitAndExit` rather than a plain navigate.
 *
 * Routing + wiring only — no new gameplay, no backend/gating changes.
 */
import { QuizPlayView } from "@/components/shell/play/QuizPlayView";
import { useDailyQuiz } from "@/hooks/useDailyQuiz";

export default function DailyQuizPlayScreen() {
  const q = useDailyQuiz();
  return (
    <QuizPlayView
      q={q}
      title="Daily Challenge"
      onExit={q.forfeitAndExit}
      loadingLabel="Loading daily challenge…"
    />
  );
}
