/**
 * Learn v2 — session runner. Server-authoritative: it submits the player's
 * answer through the grading seam and renders the returned verdict. It contains
 * no correctness logic of its own.
 *
 * Stage machine per question: answer → (branch) → reveal.
 *
 * VerveQ ONE P4.3: a run is played inside the shared StageFrame — ink ground,
 * VERVEQ eyebrow, a 44px Quit back to Learn, the progress dots under the
 * header — with the lesson itself on paper cards (TeachingReveal).
 */
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LearnShell } from "@/components/learn/LearnPrimitives";
import { QuestionRenderer } from "@/components/learn/QuestionTypes";
import { canSubmit, draftToAnswer, type LearnDraft } from "@/lib/learn/draft";
import { MistakeBranch, TeachingReveal } from "@/components/learn/TeachingReveal";
import { useLearnSession } from "@/lib/learn/useLearnSession";
import { useLearnGrading } from "@/lib/learn/useLearnGrading";
import { learnPath, LEARN_SUBJECT_PARAM } from "@/lib/learn/useLearnSubject";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { StageFrame } from "@/components/shell/play/PlayStage";
import { StepDots } from "@/components/shell/play/StageParts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
import type { LearnFelt, LearnQuestion, LearnRating, LearnVerdict } from "@/lib/learn/contract";

type Stage = "answer" | "branch" | "reveal";

function SessionSummary({
  total,
  firstTry,
  subject,
}: {
  total: number;
  firstTry: number;
  subject: string | undefined;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation("learn");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-2 text-center" data-testid="learn-summary">
      <span className="text-display" aria-hidden>
        🌱
      </span>
      <h1 className="font-heading font-bold text-title-lg">{t("summary.title")}</h1>
      <p className="m-0 text-body-sm text-muted-foreground">{t("summary.body", { count: total })}</p>
      <div className="grid w-full grid-cols-3 gap-2.5">
        <Card padding="sm" elevation="flat">
          <div className="font-heading font-bold text-title-lg">
            {firstTry}/{total}
          </div>
          <Eyebrow>{t("summary.firstTry")}</Eyebrow>
        </Card>
        <Card padding="sm" elevation="flat">
          <div className="font-heading font-bold text-title-lg">+{firstTry}</div>
          <Eyebrow>{t("summary.lockedIn")}</Eyebrow>
        </Card>
        <Card padding="sm" elevation="flat">
          <div className="font-heading font-bold text-title-lg">{total - firstTry}</div>
          <Eyebrow>{t("summary.scheduled")}</Eyebrow>
        </Card>
      </div>
      <div className="flex w-full gap-2.5">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => navigate(learnPath(SHELL_ROUTES.learnMastery, subject))}
        >
          {t("summary.seeMastery")}
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={() => navigate(learnPath(SHELL_ROUTES.learnReview, subject))}
        >
          {t("summary.reviewPlan")}
        </Button>
      </div>
    </div>
  );
}

/**
 * The play column — prompt, the active question renderer, and (post-answer) the
 * teaching reveal with its spaced-rep rating. Presentational: it owns no session
 * or grading logic; the runner threads state and the graded handlers in. Exported
 * so the dev render harness can mount the real markup at mobile viewports.
 */
export interface RunnerColumnProps {
  q: LearnQuestion;
  total: number;
  idx: number;
  stage: Stage;
  typeLabel: string;
  draft: LearnDraft;
  setDraft: (next: LearnDraft) => void;
  verdict: LearnVerdict | null;
  grading: boolean;
  onSubmit: () => void;
  onBranchRetry: () => void;
  onBranchShowWhy: () => void;
  onRate: (rating: LearnRating) => void;
  onFelt: (felt: LearnFelt) => void;
  onContinue: () => void;
}

export function RunnerColumn({
  q,
  stage,
  draft,
  setDraft,
  verdict,
  grading,
  onSubmit,
  onBranchRetry,
  onBranchShowWhy,
  onRate,
  onFelt,
  onContinue,
  idx,
  total,
}: RunnerColumnProps) {
  const { t } = useTranslation("learn");
  return (
    <div className="flex flex-col gap-3 md:gap-3.5">
      {/* The concept line is desktop-only context. On the mobile runner it
          pushes the post-answer rating past the fold and is redundant with the
          reveal, so it's hidden below md. */}
      <Eyebrow className="hidden break-words md:block">{q.subject}</Eyebrow>
      <h1 className="font-heading font-bold text-title leading-tight md:text-title-lg">{q.prompt}</h1>

      {stage !== "branch" && (
        <QuestionRenderer
          question={q}
          draft={draft}
          setDraft={setDraft}
          reveal={stage === "reveal"}
          verdict={verdict}
        />
      )}

      {stage === "branch" && verdict && (
        <>
          <QuestionRenderer question={q} draft={draft} setDraft={setDraft} reveal={false} verdict={null} />
          <MistakeBranch verdict={verdict} onRetry={onBranchRetry} onShowWhy={onBranchShowWhy} />
        </>
      )}

      {stage === "answer" && (
        <Button
          variant="primary"
          size="lg"
          block
          className="mt-1"
          disabled={!canSubmit(q, draft)}
          loading={grading}
          onClick={onSubmit}
          data-testid="learn-check"
        >
          {grading ? t("run.checking") : t("run.check")}
        </Button>
      )}

      {stage === "reveal" && verdict && (
        <TeachingReveal
          verdict={verdict}
          last={idx + 1 >= total}
          onRate={onRate}
          onFelt={onFelt}
          onContinue={onContinue}
        />
      )}
    </div>
  );
}

export default function LearnRunnerScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("learn");
  const [params] = useSearchParams();
  const nodeId = params.get("node") ?? undefined;
  const subject = params.get(LEARN_SUBJECT_PARAM) ?? undefined;
  const session = useLearnSession({ nodeId, subject });
  const {
    submitLearnAnswer,
    rateCard,
    recordFeltSignal,
    completeLearnSession,
  } = useLearnGrading(session.ref);

  const [idx, setIdx] = useState(0);
  const [stage, setStage] = useState<Stage>("answer");
  const [draft, setDraft] = useState<LearnDraft>(null);
  const [verdict, setVerdict] = useState<LearnVerdict | null>(null);
  const [grading, setGrading] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);

  const questions = session.questions;
  const q = questions[idx];
  const total = questions.length;
  const typeLabel = q ? t(`type.${q.type}`) : "";
  const leave = () => navigate(learnPath(SHELL_ROUTES.learn, subject));

  const recordFirstTry = (correct: boolean) =>
    setResults((prev) => {
      if (prev[idx] !== undefined) return prev;
      const next = [...prev];
      next[idx] = correct;
      return next;
    });

  const submit = async () => {
    if (!q || grading) return;
    setGrading(true);
    try {
      const v = await submitLearnAnswer(q, draftToAnswer(q, draft));
      setVerdict(v);
      if (stage === "answer") recordFirstTry(v.correct);
      if (!v.correct && v.branchId && stage === "answer") {
        setStage("branch");
      } else {
        setStage("reveal");
      }
    } catch (err) {
      console.error("Failed to grade Learn answer:", err);
    } finally {
      setGrading(false);
    }
  };

  const next = async () => {
    if (idx + 1 >= total) {
      try {
        await completeLearnSession();
      } catch (err) {
        console.error("Failed to complete Learn session:", err);
      }
      setDone(true);
      return;
    }
    setIdx(idx + 1);
    setDraft(null);
    setVerdict(null);
    setStage("answer");
  };

  const firstTryCount = useMemo(() => results.filter(Boolean).length, [results]);

  if (session.status === "loading") {
    return (
      <LearnShell>
        <div className="flex flex-1 items-center justify-center">
          <p className="animate-pulse font-heading font-bold">{t("run.loading")}</p>
        </div>
      </LearnShell>
    );
  }

  // Nothing resolvable to run — back to the entry's honest "nothing due" state.
  if (session.status === "empty") {
    return <Navigate to={learnPath(SHELL_ROUTES.learn, subject)} replace />;
  }

  if (session.status === "error") {
    return (
      <LearnShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-heading font-bold text-title">{t("run.errorTitle")}</h1>
          <p className="m-0 max-w-sm text-body-sm text-muted-foreground">{t("run.errorBody")}</p>
          <Button variant="primary" onClick={session.retry}>
            {t("run.retry")}
          </Button>
          <Button variant="ghost" onClick={leave}>
            {t("run.backToLearn")}
          </Button>
        </div>
      </LearnShell>
    );
  }

  if (done || !q) {
    return (
      <StageFrame title={t("entry.title")} onExit={leave} exitLabel={t("run.quit")}>
        <SessionSummary total={total} firstTry={firstTryCount} subject={subject} />
      </StageFrame>
    );
  }

  const onRate = (r: LearnRating) => void rateCard(q.id, r);
  const onFelt = (f: LearnFelt) => void recordFeltSignal(q.id, f);

  // Left context rail (desktop only): what kind of question, where you are,
  // and the Learn promise.
  const rail = (
    <Card className="flex flex-col gap-4 min-h-0" padding="md">
      <div className="flex items-start">
        <Badge tone="neutral">{typeLabel}</Badge>
      </div>
      <div>
        <Eyebrow className="mb-1">{t("run.progress")}</Eyebrow>
        <p className="font-mono text-body-sm">{t("run.questionOf", { current: idx + 1, total })}</p>
      </div>
      <div className="h-0.5 bg-border/20" />
      <div className="mt-auto">
        <Eyebrow className="mb-1.5">{t("run.promiseTitle")}</Eyebrow>
        <p className="m-0 text-body-sm font-medium leading-relaxed text-muted-foreground">{t("run.promiseBody")}</p>
      </div>
    </Card>
  );

  return (
    <StageFrame
      title={t("entry.title")}
      subtitle={typeLabel}
      onExit={leave}
      exitLabel={t("run.quit")}
      progress={
        <StepDots
          total={total}
          results={results}
          current={idx}
          label={t("run.questionOf", { current: idx + 1, total })}
        />
      }
      left={rail}
    >
      <RunnerColumn
        q={q}
        total={total}
        idx={idx}
        stage={stage}
        typeLabel={typeLabel}
        draft={draft}
        setDraft={setDraft}
        verdict={verdict}
        grading={grading}
        onSubmit={submit}
        onBranchRetry={() => {
          setDraft(null);
          setVerdict(null);
          setStage("answer");
        }}
        onBranchShowWhy={() => setStage("reveal")}
        onRate={onRate}
        onFelt={onFelt}
        onContinue={() => void next()}
      />
    </StageFrame>
  );
}
