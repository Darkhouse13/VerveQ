/**
 * Blitz (solo) on the v2 shell — the same centered-column "prototype layout" as
 * QuizPlayScreen, with Blitz's signature 60s countdown as the hero of the
 * answering column. The ambient rail stays light: score + a depleting timer bar
 * that mirrors the server clock. Grading, scoring, and the clock are fully
 * server-authoritative via `useSoloBlitz` (no correctness logic on this screen).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { BlitzClock } from "@/components/BlitzClock";
import { QuestionImage } from "@/components/QuestionImage";
import { ImageZoomModal } from "@/components/ImageZoomModal";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { MetricsPanel, AmbientStrip } from "@/components/shell/play/ambient";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useSoloBlitz } from "@/hooks/useSoloBlitz";

const LETTERS = ["A", "B", "C", "D"];
// The Blitz window is 60s; the ambient bar shows the live fraction remaining.
const BLITZ_WINDOW_SECONDS = 60;

export default function BlitzPlayScreen() {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const b = useSoloBlitz();
  const [remaining, setRemaining] = useState(BLITZ_WINDOW_SECONDS);

  const optionStyle = (idx: number) => {
    // Before the verdict lands, show the picked option as "selected" (primary),
    // never red — grading colours only apply once the server answer is known.
    if (!b.revealed)
      return b.selected === idx
        ? "bg-primary text-primary-foreground"
        : "bg-card text-card-foreground";
    if (idx === b.correctIdx) return "bg-success text-success-foreground";
    if (idx === b.selected) return "bg-destructive text-destructive-foreground";
    return "bg-muted text-muted-foreground opacity-50";
  };

  const metrics = {
    score: b.score,
    timeFraction: Math.max(0, Math.min(1, remaining / BLITZ_WINDOW_SECONDS)),
  };

  if (b.loading) {
    return (
      <PlayStage title="Blitz" onExit={() => navigate(SHELL_ROUTES.home)}>
        <div className="flex items-center justify-center py-16">
          <p className="font-heading font-bold text-lg animate-pulse">
            {t("blitz.starting")}
          </p>
        </div>
      </PlayStage>
    );
  }

  return (
    <PlayStage
      title="Blitz"
      subtitle={t("blitz.subtitle")}
      onExit={() => navigate(SHELL_ROUTES.home)}
      exitLabel={t("blitz.quit")}
      strip={<AmbientStrip metrics={metrics} />}
      right={<MetricsPanel metrics={metrics} />}
    >
      <div className={`flex flex-col ${b.shaking ? "animate-shake" : ""}`}>
        <div className="mb-3">
          <BlitzClock
            endTimeMs={b.endTimeMs}
            onExpired={b.onExpired}
            penaltyFlash={b.penaltyFlash}
            onTick={setRemaining}
          />
        </div>

        <NeoCard shadow="lg" className="mb-3">
          {b.question?.imageUrl && (
            <div className="mb-3">
              <QuestionImage
                imageUrl={b.question.imageUrl}
                alt={t("blitz.imageAlt", { question: b.question.question })}
                onZoom={() => b.setZoomImage(b.question!.imageUrl!)}
              />
            </div>
          )}
          <p className="font-heading font-bold text-xl leading-tight">
            {b.question?.question}
          </p>
        </NeoCard>

        <div className="space-y-2">
          {b.question?.options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={b.revealed || b.checking}
              onClick={() => b.onOption(idx)}
              className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left transition-all cursor-pointer ${!b.revealed && !b.checking ? "active:neo-shadow-pressed" : ""} ${optionStyle(idx)}`}
            >
              <span className="neo-border rounded-full w-8 h-8 flex items-center justify-center font-heading font-bold text-xs bg-background text-foreground shrink-0">
                {b.revealed && idx === b.correctIdx ? (
                  <Check size={16} strokeWidth={3} />
                ) : b.revealed && idx === b.selected ? (
                  <X size={16} strokeWidth={3} />
                ) : (
                  LETTERS[idx]
                )}
              </span>
              <span className="font-heading font-bold text-sm">{opt}</span>
            </button>
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
