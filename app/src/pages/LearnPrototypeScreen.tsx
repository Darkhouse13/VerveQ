import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { Check, Lightbulb, ArrowRight, Compass } from "lucide-react";
import {
  buildLadder,
  type BuiltLadder,
  type BuiltLadderQuestion,
} from "../../convex/learnLadderBuilder";

// PROTOTYPE ONLY — Learn-loop feel test, now graph-driven: the loop renders a
// ladder built for a skill node (node -> builder -> loop), not a hardcoded one.
// Answer-checking and reveal-gating happen client-side here purely to keep the
// prototype thin. Production Learn MUST move both server-side to honor the repo's
// server-authoritative game-state invariant (see CLAUDE.md "Session-based game state").

type Phase = "question" | "reveal" | "end";

export function LearnLoop({
  ladder,
  backTo = "/home",
}: {
  ladder: BuiltLadder;
  backTo?: string;
}) {
  const navigate = useNavigate();
  const rungs: BuiltLadderQuestion[] = ladder.questions;
  const total = rungs.length;

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [picked, setPicked] = useState<string | null>(null);
  // First-look correctness per rung — the only "score" we keep, and only to be honest in the summary.
  const [correctFlags, setCorrectFlags] = useState<boolean[]>([]);

  const rung = rungs[index];
  const isCorrect = picked === rung?.correctAnswer;
  const pickedDistractor = useMemo(
    () => rung?.distractors.find((d) => d.text === picked) ?? null,
    [rung, picked],
  );

  const handlePick = (option: string) => {
    if (phase !== "question") return;
    setPicked(option);
    setCorrectFlags((flags) => [...flags, option === rung.correctAnswer]);
    setPhase("reveal");
  };

  const handleContinue = () => {
    if (index + 1 >= total) {
      setPhase("end");
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setPhase("question");
  };

  const handlePlayAgain = () => {
    setIndex(0);
    setPicked(null);
    setCorrectFlags([]);
    setPhase("question");
  };

  if (phase === "end") {
    const correctCount = correctFlags.filter(Boolean).length;
    return (
      <div className="min-h-screen bg-background px-5 py-8 flex flex-col">
        <div className="flex justify-center mb-6">
          <NeoBadge color="blue" rotated size="md" className="animate-badge-land">
            <Compass size={14} className="mr-1.5" /> What you learned
          </NeoBadge>
        </div>

        <NeoCard shadow="lg" color="blue" className="mb-5 animate-slide-up">
          <p className="font-heading font-bold text-xl leading-snug">
            {ladder.conceptLine}
          </p>
        </NeoCard>

        <NeoCard className="mb-6">
          <p className="font-heading font-bold text-base">
            You spotted {correctCount} of {total} on your first look.
          </p>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">
            The other {total - correctCount === 0 ? "none" : total - correctCount} were the
            interesting ones — the cities that look like capitals but aren't.
          </p>
        </NeoCard>

        <div className="flex-1" />

        <div className="space-y-2.5">
          <NeoButton size="full" variant="primary" onClick={handlePlayAgain}>
            Play again
          </NeoButton>
          <NeoButton size="full" variant="secondary" onClick={() => navigate(backTo)}>
            Back
          </NeoButton>
        </div>
      </div>
    );
  }

  const revealed = phase === "reveal";
  const isLast = index + 1 >= total;

  const optionClasses = (option: string) => {
    if (!revealed) return "bg-card text-card-foreground active:neo-shadow-pressed";
    if (option === rung.correctAnswer) return "bg-success text-success-foreground";
    // The picked-but-wrong option is framed as "your guess", not flagged red — this is a
    // discovery, not a penalty. The correct answer (green) is where the eye should land.
    if (option === picked)
      return "bg-card text-card-foreground ring-2 ring-electric-blue";
    return "bg-muted text-muted-foreground opacity-50";
  };

  return (
    <div className="min-h-screen bg-background px-5 py-6 flex flex-col">
      {/* Lightweight progress — no streak, no timer, no pressure. */}
      <div className="flex items-center justify-between mb-3">
        <p className="font-heading font-bold text-sm">
          {index + 1} / {total}
        </p>
        <NeoBadge color="muted" size="sm">
          Learn · prototype
        </NeoBadge>
      </div>
      <div className="flex gap-1.5 mb-6">
        {rungs.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full neo-border ${
              i < index || (i === index && revealed)
                ? "bg-primary"
                : i === index
                  ? "bg-foreground/30"
                  : "bg-muted"
            }`}
          />
        ))}
      </div>

      <NeoCard shadow="lg" className="mb-5">
        <p className="font-heading font-bold text-xl leading-tight">
          {rung.question}
        </p>
      </NeoCard>

      <div className="space-y-2.5">
        {rung.options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={revealed}
            onClick={() => handlePick(option)}
            className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left transition-all ${
              revealed ? "cursor-default" : "cursor-pointer"
            } ${optionClasses(option)}`}
          >
            <span className="font-heading font-bold text-base flex-1">{option}</span>
            {revealed && option === rung.correctAnswer && (
              <Check size={20} strokeWidth={3} className="shrink-0" />
            )}
            {revealed && option === picked && option !== rung.correctAnswer && (
              <span className="text-[10px] font-heading font-bold uppercase tracking-wide text-electric-blue shrink-0">
                You picked
              </span>
            )}
          </button>
        ))}
      </div>

      {revealed && (
        <NeoCard
          shadow="lg"
          color={isCorrect ? "success" : "blue"}
          className="mt-5 animate-slide-up"
        >
          <div className="flex items-center gap-2 mb-2.5">
            {isCorrect ? (
              <Check size={18} strokeWidth={3} />
            ) : (
              <Lightbulb size={18} strokeWidth={2.5} />
            )}
            <span className="font-heading font-bold uppercase tracking-wide text-sm">
              {isCorrect ? "Spot on" : "Here's the thing"}
            </span>
          </div>

          {!isCorrect && pickedDistractor && (
            <p className="font-heading font-bold text-base leading-snug mb-3">
              {pickedDistractor.reveal}
            </p>
          )}

          <p
            className={`leading-snug ${
              isCorrect ? "font-heading font-bold text-base" : "text-sm opacity-95"
            }`}
          >
            {rung.correctReveal}
          </p>
        </NeoCard>
      )}

      {revealed && (
        <div className="mt-5">
          <NeoButton size="full" variant="primary" onClick={handleContinue}>
            {isLast ? "See what you learned" : "Continue"}
            <ArrowRight size={18} strokeWidth={3} />
          </NeoButton>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}

// Kept so the original /learn/prototype link still works — but it now routes the
// non-obvious capitals ladder through the builder (node -> builder -> loop)
// rather than importing a hardcoded ladder.
export default function LearnPrototypeScreen() {
  const ladder = useMemo(() => buildLadder("geo.capitals.nonobvious"), []);
  return <LearnLoop ladder={ladder} backTo="/learn/geography" />;
}
