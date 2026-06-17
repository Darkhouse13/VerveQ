/**
 * Quiz (solo) on the v2 shell — drives the shared `QuizPlayView` (centered-column
 * "prototype layout") with the server-authoritative `useSoloQuiz` game loop. The
 * answering column owns the question + options; the ambient rail carries only
 * score / timer / progress. No correctness logic on this screen — the same view
 * is reused by the Daily challenge (`DailyQuizPlayScreen`) via `useDailyQuiz`.
 */
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QuizPlayView } from "@/components/shell/play/QuizPlayView";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useSoloQuiz } from "@/hooks/useSoloQuiz";

export default function QuizPlayScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("play");
  const q = useSoloQuiz();
  return <QuizPlayView q={q} title={t("quiz.title")} onExit={() => navigate(SHELL_ROUTES.home)} />;
}
