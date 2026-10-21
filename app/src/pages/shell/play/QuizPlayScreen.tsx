/**
 * Quiz (solo) on the v2 shell — drives the shared `QuizPlayView` (centered-column
 * "prototype layout") with the server-authoritative `useSoloQuiz` game loop. The
 * answering column owns the question + options; the header and rail carry only
 * score / timer / progress. No correctness logic on this screen — the same view
 * is reused by the Daily challenge (`DailyQuizPlayScreen`) via `useDailyQuiz`.
 *
 * The run ends in place on the shared ResultScreen (VerveQ ONE P3.1): the run
 * component unmounts — taking its timers and tab-switch listener with it — and
 * "Play again" mounts a fresh one, which mints a fresh session.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QuizPlayView } from "@/components/shell/play/QuizPlayView";
import { QuizResult, type QuizResultData } from "@/components/shell/play/result/ModeResults";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useSoloQuiz } from "@/hooks/useSoloQuiz";

function QuizRun({ onFinish, onExit }: { onFinish: (result: QuizResultData) => void; onExit: () => void }) {
  const { t } = useTranslation("play");
  const q = useSoloQuiz(onFinish);
  return <QuizPlayView q={q} mode="quiz" title={q.isCameFirst ? t("quiz.cameFirstBadge") : t("quiz.title")} onExit={onExit} />;
}

export default function QuizPlayScreen() {
  const navigate = useNavigate();
  const [result, setResult] = useState<QuizResultData | null>(null);
  const [run, setRun] = useState(0);
  const exit = () => navigate(SHELL_ROUTES.home);

  if (result) {
    return (
      <QuizResult
        result={result}
        onExit={exit}
        onPlayAgain={() => {
          setResult(null);
          setRun((n) => n + 1);
        }}
      />
    );
  }
  return <QuizRun key={run} onFinish={setResult} onExit={exit} />;
}
