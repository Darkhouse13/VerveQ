/**
 * QuizPlayView — the shared centered-column presentation for the MCQ solo modes
 * on the v2 shell. It is driven entirely by the server-authoritative
 * `SoloQuizState` view-model, so any backend that fills that shape (regular solo
 * Quiz via `useSoloQuiz`, the Daily challenge via `useDailyQuiz`) reuses the
 * exact same layout — the answering column owns the question + options, the
 * ambient rail carries only score / timer / progress (content-blind by contract).
 *
 * Presentation only: no grading, gating, or session logic lives here. The driving
 * hook owns all of that and the `onExit` behaviour (e.g. Daily forfeits on quit).
 */
import { Check, X } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { MetricsPanel, ProgressPanel, AmbientStrip } from "@/components/shell/play/ambient";
import type { SoloQuizState } from "@/hooks/useSoloQuiz";

const LETTERS = ["A", "B", "C", "D"];

interface QuizPlayViewProps {
  q: SoloQuizState;
  /** Header title (e.g. "Quiz", "Daily Challenge"). */
  title: string;
  /** Exit handler — the driving hook decides what quitting means. */
  onExit: () => void;
  exitLabel?: string;
  /** Loading copy override; defaults to the quiz/Which-Came-First wording. */
  loadingLabel?: string;
}

export function QuizPlayView({ q, title, onExit, exitLabel = "Quit", loadingLabel }: QuizPlayViewProps) {
  const optionStyle = (idx: number) => {
    if (!q.revealed)
      return q.selected === idx
        ? "bg-primary text-primary-foreground"
        : "bg-card text-card-foreground";
    if (idx === q.correctIdx) return "bg-success text-success-foreground";
    if (idx === q.selected) return "bg-destructive text-destructive-foreground";
    return "bg-muted text-muted-foreground opacity-50";
  };

  const metrics = { score: q.totalScore, seconds: q.timer };
  const progress = { current: q.questionNum, total: q.maxQuestions };

  if (q.loading && !q.question) {
    return (
      <PlayStage title={title} onExit={onExit}>
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-lg animate-pulse">
            {loadingLabel ?? (q.isCameFirst ? "Loading Which Came First…" : "Loading quiz…")}
          </p>
        </div>
      </PlayStage>
    );
  }

  return (
    <PlayStage
      title={title}
      subtitle={`Q ${q.questionNum}/${q.maxQuestions}`}
      onExit={onExit}
      exitLabel={exitLabel}
      strip={<AmbientStrip metrics={metrics} progress={progress} />}
      right={
        <>
          <MetricsPanel metrics={metrics} />
          <ProgressPanel progress={progress} />
        </>
      }
    >
      <div className="flex flex-col">
        <div className="flex justify-center mb-3">
          <NeoBadge color="primary" rotated size="md">
            {q.badgeLabel}
          </NeoBadge>
        </div>

        <NeoCard shadow="lg" className="mb-3">
          {q.question?.imageUrl && (
            <div className="mb-3">
              <QuestionImage
                imageUrl={q.question.imageUrl}
                alt={`Image for: ${q.question.question}`}
                onZoom={() => q.setZoomImage(q.question!.imageUrl!)}
              />
            </div>
          )}
          <p className="font-heading font-bold text-xl leading-tight">
            {q.question?.question}
          </p>
        </NeoCard>

        <div className="space-y-2">
          {q.question?.options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={q.revealed || q.checking}
              onClick={() => q.onOption(idx)}
              className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left transition-all cursor-pointer ${!q.revealed ? "active:neo-shadow-pressed" : ""} ${optionStyle(idx)}`}
            >
              <span className="neo-border rounded-full w-8 h-8 flex items-center justify-center font-heading font-bold text-xs bg-background text-foreground shrink-0">
                {q.revealed && idx === q.correctIdx ? (
                  <Check size={16} strokeWidth={3} />
                ) : q.revealed && idx === q.selected ? (
                  <X size={16} strokeWidth={3} />
                ) : (
                  LETTERS[idx]
                )}
              </span>
              <span className="font-heading font-bold text-sm">{opt}</span>
            </button>
          ))}
        </div>

        {q.revealed && q.checkResult?.explanation && (
          <NeoCard
            color={q.checkResult.correct ? "success" : "default"}
            className="mt-3 text-sm leading-snug"
          >
            {q.checkResult.explanation}
          </NeoCard>
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
