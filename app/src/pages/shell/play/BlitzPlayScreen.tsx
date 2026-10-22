/**
 * Blitz (solo) on the v2 shell — the same centered-column "prototype layout" as
 * QuizPlayScreen, with the 60s countdown on top of the answering column. It is
 * the run's ONE clock, drawn with the shared StageTimer (via BlitzClock): the
 * header carries the score, and no second timer bar repeats the countdown. Grading, scoring, and the
 * clock are fully server-authoritative via `useSoloBlitz` (no correctness
 * logic on this screen).
 *
 * The run ends in place on the shared ResultScreen (VerveQ ONE P3.1); "Play
 * again" mounts a fresh run, which starts a fresh server session.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BlitzClock } from "@/components/BlitzClock";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { StageScore } from "@/components/shell/play/StageParts";
import { AnswerOption } from "@/components/shell/play/AnswerOption";
import { answerState } from "@/components/shell/play/answerState";
import { MetricsPanel } from "@/components/shell/play/ambient";
import { BlitzResult, type BlitzResultData } from "@/components/shell/play/result/ModeResults";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useSoloBlitz } from "@/hooks/useSoloBlitz";

const LETTERS = ["A", "B", "C", "D"];

function BlitzRun({ onFinish, onExit }: { onFinish: (result: BlitzResultData) => void; onExit: () => void }) {
  const { t } = useTranslation("play");
  const b = useSoloBlitz(onFinish);

  if (b.loading) {
    return (
      <PlayStage mode="blitz" title={t("blitz.title")} onExit={onExit}>
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-title-sm animate-pulse motion-reduce:animate-none">
            {t("blitz.starting")}
          </p>
        </div>
      </PlayStage>
    );
  }

  return (
    <PlayStage
      mode="blitz"
      title={t("blitz.title")}
      subtitle={t("blitz.subtitle")}
      onExit={onExit}
      exitLabel={t("blitz.quit")}
      score={
        <StageScore
          icon={<Zap size={16} strokeWidth={3} />}
          value={b.score}
          label={t("stage.scoreLabel", { value: b.score })}
        />
      }
      right={<MetricsPanel metrics={{ score: b.score }} />}
    >
      <div className={`flex flex-col ${b.shaking ? "animate-shake" : ""}`}>
        <div className="mb-3">
          <BlitzClock endTimeMs={b.endTimeMs} onExpired={b.onExpired} penaltyFlash={b.penaltyFlash} />
        </div>

        <Card elevation="lifted" className="mb-3">
          {b.question?.imageUrl && (
            <div className="mb-3">
              <QuestionImage
                imageUrl={b.question.imageUrl}
                alt={t("blitz.imageAlt", { question: b.question.question })}
                onZoom={() => b.setZoomImage(b.question!.imageUrl!)}
              />
            </div>
          )}
          <p className="font-heading font-bold text-title-sm leading-tight">
            {b.question?.question}
          </p>
        </Card>

        <div className="space-y-2" aria-live="polite">
          {b.question?.options.map((opt, idx) => (
            <AnswerOption
              key={idx}
              letter={LETTERS[idx]}
              label={opt}
              // Before the verdict lands the pick is "pending" — flat and
              // neutral, never red and never a lit button; grading colours
              // only apply once the server answer is known.
              state={answerState(idx, b)}
              disabled={b.revealed || b.checking}
              onClick={() => b.onOption(idx)}
            />
          ))}
        </div>
      </div>

      {b.zoomImage && (
        <ImageZoomModal
          imageUrl={b.zoomImage}
          open={!!b.zoomImage}
          onClose={() => b.setZoomImage(null)}
        />
      )}
    </PlayStage>
  );
}

export default function BlitzPlayScreen() {
  const navigate = useNavigate();
  const [result, setResult] = useState<BlitzResultData | null>(null);
  const [run, setRun] = useState(0);
  const exit = () => navigate(SHELL_ROUTES.home);

  if (result) {
    return (
      <BlitzResult
        result={result}
        onExit={exit}
        onPlayAgain={() => {
          setResult(null);
          setRun((n) => n + 1);
        }}
      />
    );
  }
  return <BlitzRun key={run} onFinish={setResult} onExit={exit} />;
}
