import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { Check, Lightbulb, ArrowRight, Compass, CalendarClock, Trophy } from "lucide-react";

// PROTOTYPE ONLY — Learn-loop feel test, now SERVER-AUTHORITATIVE: the loop plays
// a sanitized ladder (stems + options, no answers) fetched from the server, asks
// the server to grade every pick (submitLearnRung), and drives its end card from
// the server's mastery transition (completeLearnLadder). The client never decides
// right/wrong — it only renders what the server returns. Not wired into home, nav,
// or any scored mode.

type Phase = "question" | "reveal" | "end";

// Sanitized rung shape returned by getLearnLadder — carries NO answers.
export type LearnRung = {
  questionId: string;
  type: "mcq" | "text" | "numeric" | "order";
  stem: string;
  options: string[];
};

// Verdict returned by submitLearnRung — the server's grading of one pick.
// `teach` is absent on drill rungs; those return `correctAnswer` on a miss.
type RungVerdict = {
  correct: boolean;
  branchId?: string;
  teach?: string;
  correctAnswer?: string;
  masteryDelta?: number;
  nextReview?: number;
};

// Mastery transition returned by completeLearnLadder — drives the end card.
type CompletionResult = {
  state: "untouched" | "learning" | "proficient" | "mastered";
  justChanged: boolean;
  reviewDueAt?: number;
  masteredAt?: number;
  firstTryCorrect: number;
  total: number;
};

function formatReviewDay(reviewDueAt: number | undefined): string {
  if (!reviewDueAt) return "soon";
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = now - (now % dayMs);
  const days = Math.round((reviewDueAt - startOfToday) / dayMs);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function LearnLoop({
  sessionId,
  rungs,
  conceptLine,
  backTo = "/home",
  onPlayAgain,
}: {
  sessionId: Id<"learnSessions">;
  rungs: LearnRung[];
  conceptLine: string;
  backTo?: string;
  onPlayAgain: () => void;
}) {
  const navigate = useNavigate();
  const submitRung = useMutation(api.learn.submitLearnRung);
  const completeLadder = useMutation(api.learn.completeLearnLadder);
  const total = rungs.length;

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [picked, setPicked] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<RungVerdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [completion, setCompletion] = useState<CompletionResult | null>(null);

  // A fresh session (play-again) resets the loop to the first rung.
  useEffect(() => {
    setIndex(0);
    setPhase("question");
    setPicked(null);
    setVerdict(null);
    setBusy(false);
    setCompletion(null);
  }, [sessionId]);

  const rung = rungs[index];

  const handlePick = async (option: string) => {
    if (phase !== "question" || busy) return;
    setBusy(true);
    try {
      const result = await submitRung({
        sessionId,
        questionId: rung.questionId,
        answer: option,
      });
      setPicked(option);
      setVerdict(result);
      setPhase("reveal");
    } catch (err) {
      console.error("Failed to submit Learn rung:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleContinue = async () => {
    if (busy) return;
    if (index + 1 >= total) {
      setBusy(true);
      try {
        const result = await completeLadder({ sessionId });
        setCompletion(result);
        setPhase("end");
      } catch (err) {
        console.error("Failed to complete Learn ladder:", err);
      } finally {
        setBusy(false);
      }
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setVerdict(null);
    setPhase("question");
  };

  if (phase === "end") {
    const justMastered = completion?.state === "mastered" && completion.justChanged;
    const justProficient =
      completion?.state === "proficient" && completion.justChanged;
    const firstTryCorrect = completion?.firstTryCorrect ?? 0;
    const completedTotal = completion?.total ?? total;

    return (
      <div className="min-h-screen bg-background px-5 py-8 flex flex-col">
        <div className="flex justify-center mb-6">
          <NeoBadge
            color={justMastered ? "success" : "blue"}
            rotated
            size="md"
            className="animate-badge-land"
          >
            {justMastered ? (
              <Trophy size={14} className="mr-1.5" />
            ) : (
              <Compass size={14} className="mr-1.5" />
            )}
            {justMastered ? "Mastered" : "What you learned"}
          </NeoBadge>
        </div>

        <NeoCard
          shadow="lg"
          color={justMastered ? "success" : "blue"}
          className="mb-5 animate-slide-up"
        >
          <p className="font-heading font-bold text-xl leading-snug">{conceptLine}</p>
        </NeoCard>

        <NeoCard className="mb-4">
          <p className="font-heading font-bold text-base">
            You spotted {firstTryCorrect} of {completedTotal} on your first look.
          </p>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">
            {completedTotal - firstTryCorrect === 0
              ? "Clean run — you had every one of them first try."
              : "The misses were the interesting ones — the cases that look one way but aren't."}
          </p>
        </NeoCard>

        {/* Honest spacing line — driven entirely by the server's mastery transition. */}
        {justProficient && (
          <NeoCard color="blue" className="mb-4 animate-slide-up">
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarClock size={18} strokeWidth={2.5} />
              <span className="font-heading font-bold uppercase tracking-wide text-sm">
                You've got the pattern
              </span>
            </div>
            <p className="text-sm leading-snug opacity-95">
              Come back {formatReviewDay(completion?.reviewDueAt)} to lock it in.
            </p>
          </NeoCard>
        )}

        {justMastered && (
          <NeoCard color="success" className="mb-4 animate-slide-up">
            <div className="flex items-center gap-2 mb-1.5">
              <Trophy size={18} strokeWidth={2.5} />
              <span className="font-heading font-bold uppercase tracking-wide text-sm">
                Locked in
              </span>
            </div>
            <p className="text-sm leading-snug opacity-95">
              You came back and nailed it again. This one's yours.
            </p>
          </NeoCard>
        )}

        <div className="flex-1" />

        <div className="space-y-2.5">
          <NeoButton size="full" variant="primary" onClick={onPlayAgain}>
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
  const isCorrect = verdict?.correct ?? false;

  const optionClasses = (option: string) => {
    if (!revealed || !verdict)
      return "bg-card text-card-foreground active:neo-shadow-pressed";
    if (option === picked && verdict.correct)
      return "bg-success text-success-foreground";
    // Drill rungs return the correct answer on a miss — show it green so the
    // recall drill stays learnable. Curated reveal rungs send no correctAnswer.
    if (verdict.correctAnswer && option === verdict.correctAnswer)
      return "bg-success text-success-foreground";
    // Wrong picks are framed as "your guess", not flagged red. Curated rungs keep
    // the correct answer private and return only the verified teaching reveal.
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
        <p className="font-heading font-bold text-xl leading-tight">{rung.stem}</p>
      </NeoCard>

      <div className="space-y-2.5">
        {rung.options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={revealed || busy}
            onClick={() => handlePick(option)}
            className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left transition-all ${
              revealed ? "cursor-default" : "cursor-pointer"
            } ${optionClasses(option)}`}
          >
            <span className="font-heading font-bold text-base flex-1">{option}</span>
            {revealed && verdict && option === picked && verdict.correct && (
              <Check size={20} strokeWidth={3} className="shrink-0" />
            )}
            {revealed &&
              verdict &&
              option === picked &&
              !verdict.correct && (
                <span className="text-[10px] font-heading font-bold uppercase tracking-wide text-electric-blue shrink-0">
                  You picked
                </span>
              )}
          </button>
        ))}
      </div>

      {revealed && verdict && (
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

          <p className="font-heading font-bold text-base leading-snug">
            {verdict.teach ??
              (isCorrect
                ? "Nice — that's right."
                : verdict.correctAnswer
                  ? `The answer is ${verdict.correctAnswer}.`
                  : "")}
          </p>
        </NeoCard>
      )}

      {revealed && (
        <div className="mt-5">
          <NeoButton
            size="full"
            variant="primary"
            disabled={busy}
            onClick={handleContinue}
          >
            {isLast ? "See what you learned" : "Continue"}
            <ArrowRight size={18} strokeWidth={3} />
          </NeoButton>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}

// Owns the server session lifecycle for one playable node: starts a session via
// getLearnLadder (a mutation — it inserts the session), plays it through LearnLoop,
// and restarts a fresh session on "play again". Assumes the node is playable; the
// route screen handles coming-soon / not-found before mounting this.
export function LearnLadderHost({
  nodeId,
  backTo = "/learn/geography",
}: {
  nodeId: string;
  backTo?: string;
}) {
  const navigate = useNavigate();
  const getLadder = useMutation(api.learn.getLearnLadder);
  const [session, setSession] = useState<{
    sessionId: Id<"learnSessions">;
    rungs: LearnRung[];
    conceptLine: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  const startSession = useCallback(async () => {
    setFailed(false);
    setSession(null);
    try {
      const res = await getLadder({ nodeId });
      setSession({
        sessionId: res.sessionId,
        rungs: res.rungs,
        conceptLine: res.conceptLine,
      });
    } catch (err) {
      console.error("Failed to start Learn session:", err);
      setFailed(true);
    }
  }, [getLadder, nodeId]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  if (failed) {
    return (
      <div className="min-h-screen bg-background px-5 py-8 flex flex-col">
        <NeoCard shadow="lg" className="mb-6">
          <p className="font-heading font-bold text-xl leading-snug">
            Couldn't start this lesson right now.
          </p>
          <p className="text-sm text-muted-foreground mt-2 leading-snug">
            Try again, or head back to the node list.
          </p>
        </NeoCard>
        <div className="flex-1" />
        <div className="space-y-2.5">
          <NeoButton size="full" variant="primary" onClick={startSession}>
            Try again
          </NeoButton>
          <NeoButton size="full" variant="secondary" onClick={() => navigate(backTo)}>
            Back to nodes
          </NeoButton>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background px-5 py-8 flex items-center justify-center">
        <NeoBadge color="muted" size="md">
          <Compass size={14} className="mr-1.5" /> Loading lesson…
        </NeoBadge>
      </div>
    );
  }

  return (
    <LearnLoop
      key={session.sessionId}
      sessionId={session.sessionId}
      rungs={session.rungs}
      conceptLine={session.conceptLine}
      backTo={backTo}
      onPlayAgain={startSession}
    />
  );
}

// Kept so the original /learn/prototype link still works — it now starts a real
// server session for the non-obvious capitals ladder and plays it server-side.
export default function LearnPrototypeScreen() {
  return <LearnLadderHost nodeId="geo.capitals.nonobvious" backTo="/learn/geography" />;
}
