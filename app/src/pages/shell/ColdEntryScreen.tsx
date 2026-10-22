/**
 * Cold-entry landing — what a signed-out visitor with NO context sees at a
 * bare `/` (someone tapping a generic verveq.com link from a post).
 *
 * One glance orients them ("Settle it." + a one-liner), one tap drops them
 * into an instant, account-free taste round (see `lib/tasteRound.ts` — bundled
 * questions, client scoring, no Convex session, no signup wall). Only AFTER
 * the round do we ask for anything: the claim card mirrors the duel
 * guest-claim pattern and routes into the existing `/welcome` username-only
 * onboarding. "Maybe later" keeps them playing fresh rounds, and the result
 * card cross-sells Career Path (the guest-playable marketed mode) with
 * `?ref=taste` so those hops stay visible in funnel.careerPathMetrics.
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
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { StaticSeoSlot } from "@/components/seo/StaticSeoSlot";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useMutation } from "convex/react";
import {
  localizeTasteQuestion,
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
      <ShellLayout hideNav scroll>
        {/* The hero still owns the first screen (centered in it); the
            homepage's server-rendered games/quiz/grid-answer links follow
            below it, inside this scroll area (StaticSeoSlot). */}
        <div className="min-h-full flex flex-col justify-center">
        {/* Phone: one centered column. Desktop (md+): a split hero — the
            pitch on the left, the play card on the right — instead of a
            380px column floating on an empty canvas. */}
        <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center md:max-w-5xl md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-center md:gap-12 lg:gap-16 md:text-left">
          <div className="flex flex-col items-center md:items-start">
          <BrandMark variant="lockup" size="md" />
          <NeoBadge color="primary" rotated size="md" className="mt-6">
            {t("landing.eyebrow")}
          </NeoBadge>
          <h1 className="font-heading font-bold text-display md:text-score mt-4 leading-none">
            {t("landing.headline")}
          </h1>
          <p className="text-body-sm md:text-title-sm text-muted-foreground mt-3 md:mt-5 text-balance">
            {t("landing.subline")}
          </p>
          </div>
          <div className="w-full flex flex-col items-center md:neo-border md:neo-shadow-lg md:rounded-lg md:bg-card md:p-8">
          <NeoButton
            variant="primary"
            size="full"
            className="mt-8 md:mt-0"
            onClick={startRound}
          >
            <ArrowRight size={18} strokeWidth={3} />
            {t("landing.play")}
          </NeoButton>
          <p className="text-meta text-muted-foreground mt-3">
            {t("landing.freeNote")}
          </p>
          <p className="mt-6 text-body-sm font-heading text-muted-foreground">
            {t("landing.haveAccount")}{" "}
            <Button variant="link" onClick={goSignIn}>
              {t("landing.signIn")}
            </Button>
          </p>
          </div>
        </div>
        </div>
        <StaticSeoSlot className="w-full mt-6" />
      </ShellLayout>
    );
  }

  if (phase === "playing") {
    const question = round[qIndex]
      ? localizeTasteQuestion(round[qIndex], (key, options) => String(t(key, options)))
      : undefined;
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
      return "bg-muted text-muted-foreground is-dimmed";
    };

    return (
      <ShellLayout hideNav>
        <div className="w-full max-w-md md:max-w-2xl mx-auto flex flex-col min-h-full pt-2 md:pt-6">
          <div className="flex items-center justify-between mb-3">
            <NeoBadge color="primary" size="sm">
              {t("landing.roundBadge")}
            </NeoBadge>
            <p className="font-heading font-bold text-meta">
              {t("landing.progress", {
                current: qIndex + 1,
                total: round.length,
              })}
            </p>
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono font-bold text-body-sm">
              {t("landing.score", { score })}
            </p>
            <p className="text-meta text-muted-foreground">
              {t("landing.speedHint")}
            </p>
          </div>

          <NeoCard shadow="lg" className="mb-5">
            <p className="font-heading font-bold text-title-sm leading-tight">
              {question.question}
            </p>
          </NeoCard>

          <div className="space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
            {question.options.map((opt, idx) => (
              <Card
                key={idx}
                interactive
                data-testid="taste-option"
                disabled={revealed}
                onClick={() => pick(idx)}
                className={cn("flex items-center gap-3", optionStyle(idx))}
              >
                <span className="neo-border rounded-full w-8 h-8 flex items-center justify-center font-heading font-bold text-meta bg-background text-foreground shrink-0">
                  {revealed && idx === correctIdx ? (
                    <Check size={16} strokeWidth={3} />
                  ) : revealed && idx === picked ? (
                    <X size={16} strokeWidth={3} />
                  ) : (
                    OPTION_LETTERS[idx]
                  )}
                </span>
                <span className="font-heading font-bold text-body-sm">{opt}</span>
              </Card>
            ))}
          </div>

          {revealed && (
            <NeoCard
              color={picked === correctIdx ? "success" : "default"}
              className="mt-4 text-body-sm leading-snug"
            >
              <p className="font-heading font-bold text-body-sm">
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
      <div className="w-full max-w-sm mx-auto flex flex-col items-center md:max-w-3xl md:grid md:grid-cols-2 md:items-center md:gap-x-10">
        <NeoCard shadow="lg" className="w-full text-center py-8">
          <Sparkles size={28} strokeWidth={2.5} className="mx-auto mb-3" />
          <NeoBadge color="success" rotated size="md" className="text-body px-4">
            {t("landing.resultBadge")}
          </NeoBadge>
          <p className="font-mono font-bold text-display mt-4">{score}</p>
          <p className="text-meta text-muted-foreground mt-1">
            {t("landing.resultCorrect", {
              correct: correctCount,
              total: TASTE_ROUND_SIZE,
            })}
          </p>
          <p className="font-heading font-bold text-title-sm mt-5">
            {t("landing.claimTitle")}
          </p>
          <p className="text-body-sm text-muted-foreground mt-1">
            {t("landing.claimBody")}
          </p>
        </NeoCard>

        <div className="w-full mt-6 space-y-3 md:mt-0">
          <NeoButton variant="primary" size="full" onClick={goClaim}>
            {t("landing.claimCta")}
          </NeoButton>
          {/* Cross-sell the marketed mode — guest-playable, so this never
              hits a login wall. ?ref=taste keeps the hop attributable. */}
          <NeoButton
            variant="secondary"
            size="full"
            onClick={() => navigate(`${SHELL_ROUTES.careerPathPlay}?ref=taste`)}
          >
            {t("landing.careerPathCta")}
          </NeoButton>
          <NeoButton variant="ghost" size="full" onClick={startRound}>
            {t("landing.maybeLater")}
          </NeoButton>
        </div>
        <p className="mt-4 text-body-sm font-heading text-muted-foreground md:col-span-2 md:text-center md:mt-6">
          <Button variant="link" onClick={() => navigate(SHELL_ROUTES.home)}>
            {t("landing.explore")}
          </Button>
          {" · "}
          <Button variant="link" onClick={goSignIn}>
            {t("landing.signIn")}
          </Button>
        </p>
      </div>
    </ShellLayout>
  );
}
