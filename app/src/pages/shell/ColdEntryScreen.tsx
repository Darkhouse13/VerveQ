/**
 * Cold-entry landing — what a signed-out visitor with NO context sees at a
 * bare `/` (someone tapping a generic verveq.com link from a post).
 *
 * One glance orients them ("Settle it." + a one-liner), one tap drops them
 * into an instant, account-free taste round (see `lib/tasteRound.ts` — bundled
 * questions, client scoring, no Convex session, no signup wall). Only AFTER
 * the round do we ask for anything: the claim card mirrors the duel
 * guest-claim pattern and routes into the existing `/v2/welcome` username-only
 * onboarding. "Maybe later" keeps them playing fresh rounds.
 *
 * Reached ONLY from `EntryRoute` when the account state is logged out — the
 * signed-in path, the duel share-link path (`/duel/:linkCode`), and the auth
 * deep links (`?mode=`, `?from=`, `?next=`) never render this screen.
 */
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoLogo } from "@/components/neo/NeoLogo";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useMutation } from "convex/react";
import {
  sampleTasteRound,
  scoreTasteAnswer,
  TASTE_ROUND_SIZE,
  type TasteQuestion,
} from "@/lib/tasteRound";
import {
  getOrCreateColdSessionToken,
  readColdSource,
} from "@/lib/coldSession";
import { api } from "../../../convex/_generated/api";

type Phase = "orient" | "playing" | "done";

const OPTION_LETTERS = ["A", "B", "C", "D"];

export default function ColdEntryScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("shell");
  const recordTasteRound = useMutation(api.funnel.recordTasteRoundEvent);

  const [phase, setPhase] = useState<Phase>("orient");
  const [round, setRound] = useState<TasteQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [lastPoints, setLastPoints] = useState(0);
  // Per-visit memory so "keep playing" deals fresh questions until the pool
  // runs dry; intentionally not persisted — a returning visitor starts clean.
  const seenIds = useRef<Set<string>>(new Set());
  const questionStartedAt = useRef(0);
  // Cold-path funnel instrumentation. Fired at most once per mount via these
  // refs; the server also dedupes per session token across reloads/tabs, so a
  // replay ("Maybe later") or a re-render never double-counts. Best-effort —
  // a failed call must never block or break the serverless taste round.
  const tasteStartedFired = useRef(false);
  const tasteCompletedFired = useRef(false);

  const startRound = useCallback(() => {
    if (!tasteStartedFired.current) {
      tasteStartedFired.current = true;
      const source = readColdSource();
      void recordTasteRound({
        sessionToken: getOrCreateColdSessionToken(),
        stage: "started",
        ...(source ? { source } : {}),
      }).catch(() => {});
    }
    const sample = sampleTasteRound(seenIds.current);
    for (const q of sample) seenIds.current.add(q.id);
    setRound(sample);
    setQIndex(0);
    setScore(0);
    setCorrectCount(0);
    setPicked(null);
    questionStartedAt.current = performance.now();
    setPhase("playing");
  }, [recordTasteRound]);

  const goSignIn = () => navigate("/?mode=signin");
  const goClaim = () =>
    navigate(
      `${SHELL_ROUTES.welcome}?next=${encodeURIComponent(SHELL_ROUTES.home)}`,
    );

  if (phase === "orient") {
    return (
      <ShellLayout hideNav center>
        <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center">
          <NeoLogo size="sm" />
          <NeoBadge color="primary" rotated size="md" className="mt-6">
            {t("landing.eyebrow")}
          </NeoBadge>
          <h1 className="font-heading font-bold text-5xl md:text-6xl mt-4 leading-none">
            {t("landing.headline")}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-3 text-balance">
            {t("landing.subline")}
          </p>
          <NeoButton
            variant="primary"
            size="full"
            className="mt-8"
            onClick={startRound}
          >
            <ArrowRight size={18} strokeWidth={3} />
            {t("landing.play")}
          </NeoButton>
          <p className="text-[11px] text-muted-foreground mt-3">
            {t("landing.freeNote")}
          </p>
          <p className="mt-6 text-sm font-heading text-muted-foreground">
            {t("landing.haveAccount")}{" "}
            <button
              type="button"
              onClick={goSignIn}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {t("landing.signIn")}
            </button>
          </p>
        </div>
      </ShellLayout>
    );
  }

  if (phase === "playing") {
    const question = round[qIndex];
    if (!question) return null;
    const revealed = picked !== null;
    const correctIdx = question.correctIndex;
    const isLast = qIndex + 1 >= round.length;

    const pick = (idx: number) => {
      if (revealed) return;
      const correct = idx === correctIdx;
      const points = scoreTasteAnswer(
        correct,
        performance.now() - questionStartedAt.current,
      );
      setPicked(idx);
      setLastPoints(points);
      setScore((s) => s + points);
      if (correct) setCorrectCount((c) => c + 1);
    };

    const advance = () => {
      if (isLast) {
        if (!tasteCompletedFired.current) {
          tasteCompletedFired.current = true;
          void recordTasteRound({
            sessionToken: getOrCreateColdSessionToken(),
            stage: "completed",
          }).catch(() => {});
        }
        setPhase("done");
        return;
      }
      setQIndex((i) => i + 1);
      setPicked(null);
      questionStartedAt.current = performance.now();
    };

    const optionStyle = (idx: number) => {
      if (!revealed) return "bg-card text-card-foreground";
      if (idx === correctIdx) return "bg-success text-success-foreground";
      if (idx === picked) return "bg-destructive text-destructive-foreground";
      return "bg-muted text-muted-foreground opacity-50";
    };

    return (
      <ShellLayout hideNav>
        <div className="w-full max-w-md mx-auto flex flex-col min-h-full pt-2 md:pt-6">
          <div className="flex items-center justify-between mb-3">
            <NeoBadge color="primary" size="sm">
              {t("landing.roundBadge")}
            </NeoBadge>
            <p className="font-heading font-bold text-xs">
              {t("landing.progress", {
                current: qIndex + 1,
                total: round.length,
              })}
            </p>
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono font-bold text-sm">
              {t("landing.score", { score })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("landing.speedHint")}
            </p>
          </div>

          <NeoCard shadow="lg" className="mb-5">
            <p className="font-heading font-bold text-xl leading-tight">
              {question.question}
            </p>
          </NeoCard>

          <div className="space-y-2.5">
            {question.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                data-testid="taste-option"
                disabled={revealed}
                onClick={() => pick(idx)}
                className={`w-full neo-border neo-shadow rounded-lg p-4 flex items-center gap-3 text-left transition-all cursor-pointer ${!revealed ? "active:neo-shadow-pressed" : ""} ${optionStyle(idx)}`}
              >
                <span className="neo-border rounded-full w-8 h-8 flex items-center justify-center font-heading font-bold text-xs bg-background text-foreground shrink-0">
                  {revealed && idx === correctIdx ? (
                    <Check size={16} strokeWidth={3} />
                  ) : revealed && idx === picked ? (
                    <X size={16} strokeWidth={3} />
                  ) : (
                    OPTION_LETTERS[idx]
                  )}
                </span>
                <span className="font-heading font-bold text-sm">{opt}</span>
              </button>
            ))}
          </div>

          {revealed && (
            <NeoCard
              color={picked === correctIdx ? "success" : "default"}
              className="mt-4 text-sm leading-snug"
            >
              <p className="font-heading font-bold text-sm">
                {picked === correctIdx
                  ? t("landing.correct", { points: lastPoints })
                  : t("landing.wrong")}
              </p>
              <p className="mt-1">{question.explanation}</p>
            </NeoCard>
          )}

          <div className="mt-5 pb-2">
            <NeoButton
              variant="primary"
              size="full"
              disabled={!revealed}
              onClick={advance}
            >
              {isLast ? t("landing.seeScore") : t("landing.next")}
            </NeoButton>
          </div>
        </div>
      </ShellLayout>
    );
  }

  // done — the DEFERRED username ask, mirroring the duel guest-claim pattern.
  return (
    <ShellLayout hideNav center>
      <div className="w-full max-w-sm mx-auto flex flex-col items-center">
        <NeoCard shadow="lg" className="w-full text-center py-8">
          <Sparkles size={28} strokeWidth={2.5} className="mx-auto mb-3" />
          <NeoBadge color="success" rotated size="md" className="text-base px-4">
            {t("landing.resultBadge")}
          </NeoBadge>
          <p className="font-mono font-bold text-4xl mt-4">{score}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("landing.resultCorrect", {
              correct: correctCount,
              total: TASTE_ROUND_SIZE,
            })}
          </p>
          <p className="font-heading font-bold text-lg mt-5">
            {t("landing.claimTitle")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("landing.claimBody")}
          </p>
        </NeoCard>

        <div className="w-full mt-6 space-y-3">
          <NeoButton variant="primary" size="full" onClick={goClaim}>
            {t("landing.claimCta")}
          </NeoButton>
          <NeoButton variant="ghost" size="full" onClick={startRound}>
            {t("landing.maybeLater")}
          </NeoButton>
        </div>
        <p className="mt-4 text-sm font-heading text-muted-foreground">
          <button
            type="button"
            onClick={() => navigate(SHELL_ROUTES.home)}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t("landing.explore")}
          </button>
          {" · "}
          <button
            type="button"
            onClick={goSignIn}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t("landing.signIn")}
          </button>
        </p>
      </div>
    </ShellLayout>
  );
}
