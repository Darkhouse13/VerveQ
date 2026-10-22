/**
 * Daily Challenge on the v2 shell — REUSES the migrated `QuizPlayView`
 * (centered-column "prototype layout") driven by `useDailyQuiz`, so the Daily
 * quiz looks and plays exactly like solo Quiz on the shell while running the
 * server-authoritative DAILY session (`dailyAttempts`) with its gating intact:
 * one attempt per day, the shared daily set, and the stricter forfeit-on-tab-
 * switch anti-cheat. Quitting forfeits today's attempt (Daily gating), so the
 * exit is wired to the hook's `forfeitAndExit` rather than a plain navigate.
 *
 * The result shows in place (VerveQ ONE P3.1). Coming back to /daily after
 * finishing shows today's result again, rebuilt from the stored attempt,
 * instead of bouncing to Home.
 *
 * Routing + wiring only — no new gameplay, no backend/gating changes.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { QuizPlayView } from "@/components/shell/play/QuizPlayView";
import { PlayStage } from "@/components/shell/play/PlayStage";
import {
  DailyQuizResult,
  type AnswerRow,
  type DailyQuizResultData,
} from "@/components/shell/play/result/ModeResults";
import { useDailyQuiz } from "@/hooks/useDailyQuiz";
import { usePreferredDailySport } from "@/hooks/usePreferredDailySport";
import { useAuth } from "@/contexts/AuthContext";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { api } from "../../../../convex/_generated/api";

function DailyRun({ onFinish }: { onFinish: (result: DailyQuizResultData) => void }) {
  const { t } = useTranslation("play");
  const q = useDailyQuiz(onFinish);
  return (
    <QuizPlayView
      q={q}
      mode="daily-quiz"
      title={t("dailyQuiz.title")}
      onExit={q.forfeitAndExit}
      loadingLabel={t("dailyQuiz.loadingLabel")}
    />
  );
}

function isAnswerRow(r: unknown): r is AnswerRow {
  return (
    typeof r === "object" &&
    r !== null &&
    typeof (r as AnswerRow).correct === "boolean" &&
    typeof (r as AnswerRow).timeTaken === "number" &&
    typeof (r as AnswerRow).score === "number"
  );
}

export default function DailyQuizPlayScreen() {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const sport = usePreferredDailySport();
  const { accountState } = useAuth();
  const hasSession = accountState !== "loggedOut" && accountState !== "loading";
  const [result, setResult] = useState<DailyQuizResultData | null>(null);
  // Today's attempt, read once on arrival: a finished one is shown, anything
  // else starts (or resumes, or refuses) the run exactly as before. Latched so
  // the attempt this visit starts never swaps the run out mid-game.
  const status = useQuery(api.dailyChallenge.getAttemptStatus, hasSession ? { sport, mode: "quiz" } : "skip");
  const [arrival, setArrival] = useState<DailyQuizResultData | "play" | null>(null);
  // No server identity (a tab-local guest) has no stored attempt to show.
  if (arrival === null && (status !== undefined || accountState === "loggedOut")) {
    const rows = Array.isArray(status?.results) ? (status.results as unknown[]).filter(isAnswerRow) : [];
    setArrival(
      status?.completed && !status.forfeited && rows.length > 0
        ? {
            score: status.score,
            total: rows.length,
            correctCount: rows.filter((r) => r.correct).length,
            sport,
            breakdown: rows,
          }
        : "play",
    );
  }

  const exit = () => navigate(SHELL_ROUTES.home);
  const shown = result ?? (arrival !== "play" ? arrival : null);
  if (shown) return <DailyQuizResult result={shown} onExit={exit} />;
  if (arrival === "play") return <DailyRun onFinish={setResult} />;
  return (
    <PlayStage mode="daily-quiz" title={t("dailyQuiz.title")} onExit={exit}>
      <div className="flex items-center justify-center py-16">
        <p className="font-heading font-bold text-title-sm animate-pulse motion-reduce:animate-none">
          {t("dailyQuiz.loadingLabel")}
        </p>
      </div>
    </PlayStage>
  );
}
