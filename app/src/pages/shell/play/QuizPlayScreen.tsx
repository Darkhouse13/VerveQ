/**
 * Quiz (solo) on the v2 shell — the centered-column "prototype layout" skeleton
 * that the other solo modes (Blitz, Survival, …) will follow. The answering
 * column owns the question and options; the lighter ambient rail carries only
 * score / timer / progress. Grading stays fully server-authoritative via
 * `useSoloQuiz` (no correctness logic on this screen).
 */
import { useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { MetricsPanel, ProgressPanel, AmbientStrip } from "@/components/shell/play/ambient";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useSoloQuiz } from "@/hooks/useSoloQuiz";

const LETTERS = ["A", "B", "C", "D"];

export default function QuizPlayScreen() {
  const navigate = useNavigate();
  const q = useSoloQuiz();

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
      <PlayStage title="Quiz" onExit={() => navigate(SHELL_ROUTES.home)}>
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-lg animate-pulse">
            {q.isCameFirst ? "Loading Which Came First…" : "Loading quiz…"}
          </p>
        </div>
      </PlayStage>
    );
  }

  return (
    <PlayStage
      title="Quiz"
      subtitle={`Q ${q.questionNum}/${q.maxQuestions}`}
      onExit={() => navigate(SHELL_ROUTES.home)}
      exitLabel="Quit"
      strip={<AmbientStrip metrics={metrics} progress={progress} />}
      right={
        <>
          <MetricsPanel metrics={metrics} />
          <ProgressPanel progress={progress} />
        </>
      }
    >
      <div className="flex flex-col">
        <div className="flex justify-center mb-4">
          <NeoBadge color="primary" rotated size="md">
            {q.badgeLabel}
          </NeoBadge>
        </div>

        <NeoCard shadow="lg" className="mb-4">
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

        <div className="space-y-2.5">
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
            className="mt-4 text-sm leading-snug"
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
