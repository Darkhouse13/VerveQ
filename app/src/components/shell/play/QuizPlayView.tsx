/**
 * QuizPlayView — the shared centered-column presentation for the MCQ solo modes
 * on the v2 shell. It is driven entirely by the server-authoritative
 * `SoloQuizState` view-model, so any backend that fills that shape (regular solo
 * Quiz via `useSoloQuiz`, the Daily challenge via `useDailyQuiz`) reuses the
 * exact same layout — the answering column owns the question + options; the
 * StageFrame header carries the score (with the question clock under it) and
 * the per-question verdict dots, and the desktop rail mirrors them
 * (content-blind by contract).
 *
 * Presentation only: no grading, gating, or session logic lives here. The driving
 * hook owns all of that and the `onExit` behaviour (e.g. Daily forfeits on quit).
 */
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import { PlayStage, type StageMode } from "@/components/shell/play/PlayStage";
import { StageScore, StepDots } from "@/components/shell/play/StageParts";
import { AnswerOption } from "@/components/shell/play/AnswerOption";
import { answerState } from "@/components/shell/play/answerState";
import { MetricsPanel, ProgressPanel } from "@/components/shell/play/ambient";
import type { SoloQuizState } from "@/hooks/useSoloQuiz";

const LETTERS = ["A", "B", "C", "D"];

interface QuizPlayViewProps {
  q: SoloQuizState;
  /** Header title (e.g. "Quiz", "Daily Challenge"). */
  title: string;
  /** The frame's mode accent. */
  mode: StageMode;
  /** Exit handler — the driving hook decides what quitting means. */
  onExit: () => void;
  exitLabel?: string;
  /** Loading copy override; defaults to the quiz/Which-Came-First wording. */
  loadingLabel?: string;
}

export function QuizPlayView({ q, title, mode, onExit, exitLabel, loadingLabel }: QuizPlayViewProps) {
  const { t } = useTranslation("play");
  const resolvedExitLabel = exitLabel ?? t("quizView.quit");

  const metrics = { score: q.totalScore, seconds: q.timer };
  const progress = { current: q.questionNum, total: q.maxQuestions };

  if (q.loading && !q.question) {
    return (
      <PlayStage mode={mode} title={title} onExit={onExit}>
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-title-sm animate-pulse motion-reduce:animate-none">
            {loadingLabel ?? (q.isCameFirst ? t("quizView.loadingCameFirst") : t("quizView.loadingQuiz"))}
          </p>
        </div>
      </PlayStage>
    );
  }

  return (
    <PlayStage
      mode={mode}
      title={title}
      subtitle={t("quizView.questionProgress", { current: q.questionNum, total: q.maxQuestions })}
      onExit={onExit}
      exitLabel={resolvedExitLabel}
      score={
        <StageScore
          icon={<Star size={16} strokeWidth={3} />}
          value={q.totalScore}
          label={t("stage.scoreLabel", { value: q.totalScore })}
          // The question clock, as m:ss (the slot sets its line in caps).
          detail={`${Math.floor(q.timer / 60)}:${String(q.timer % 60).padStart(2, "0")}`}
        />
      }
      progress={
        <StepDots
          total={q.maxQuestions}
          results={q.verdicts}
          current={q.questionNum - 1}
          label={t("stage.roundLabel", { current: q.questionNum, total: q.maxQuestions })}
        />
      }
      right={
        <>
          <MetricsPanel metrics={metrics} />
          <ProgressPanel progress={progress} />
        </>
      }
    >
      <div className="flex flex-col">
        <div className="flex justify-center mb-3">
          <Badge tone="mode" shape="tag" size="md" stamp>
            {q.badgeLabel}
          </Badge>
        </div>

        <Card elevation="lifted" className="mb-3">
          {q.question?.imageUrl && (
            <div className="mb-3">
              <QuestionImage
                imageUrl={q.question.imageUrl}
                alt={t("quizView.imageAlt", { question: q.question.question })}
                onZoom={() => q.setZoomImage(q.question!.imageUrl!)}
              />
            </div>
          )}
          <p className="font-heading font-bold text-title-sm leading-tight">
            {q.question?.question}
          </p>
        </Card>

        <div className="space-y-2" aria-live="polite">
          {q.question?.options.map((opt, idx) => (
            <AnswerOption
              key={idx}
              letter={LETTERS[idx]}
              label={opt}
              state={answerState(idx, q)}
              disabled={q.revealed || q.checking}
              onClick={() => q.onOption(idx)}
            />
          ))}
        </div>

        {/* The explanation is reading matter, so it sits on the paper card;
            the verdict itself is already on the options. */}
        {q.revealed && q.checkResult?.explanation && (
          <Card tone="paper" padding="sm" elevation="flat" className="mt-3 text-body-sm leading-snug">
            {q.checkResult.explanation}
          </Card>
        )}
      </div>

      {q.zoomImage && (
        <ImageZoomModal
          imageUrl={q.zoomImage}
          open={!!q.zoomImage}
          onClose={() => q.setZoomImage(null)}
        />
      )}
    </PlayStage>
  );
}
