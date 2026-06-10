/**
 * Learn v2 — session runner. Server-authoritative: it submits the player's
 * answer through the grading seam and renders the returned verdict. It contains
 * no correctness logic of its own.
 *
 * Stage machine per question: answer → (branch) → reveal.
 */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LearnShell, LadderDots, Eyebrow, Chip } from "@/components/learn/LearnPrimitives";
import { QuestionRenderer } from "@/components/learn/QuestionTypes";
import { canSubmit, draftToAnswer, type LearnDraft } from "@/lib/learn/draft";
import { MistakeBranch, TeachingReveal } from "@/components/learn/TeachingReveal";
import { useLearnSession } from "@/lib/learn/useLearnSession";
import { useLearnGrading } from "@/lib/learn/useLearnGrading";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import type { LearnFelt, LearnRating, LearnVerdict } from "@/lib/learn/contract";

type Stage = "answer" | "branch" | "reveal";

function SessionSummary({
  total,
  firstTry,
}: {
  total: number;
  firstTry: number;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation("learn");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 pt-2 text-center">
      <span className="text-5xl" aria-hidden>
        🌱
      </span>
      <div className="font-heading text-3xl leading-none">{t("summary.title")}</div>
      <p className="m-0 text-[15px] text-muted-foreground">
        {t("summary.body", { count: total })}
      </p>
      <div className="flex w-full gap-2.5">
        <div className="flex-1 neo-border rounded-xl bg-card p-3.5">
          <div className="font-heading text-3xl">
            {firstTry}/{total}
          </div>
          <div className="font-mono text-[10px] uppercase">{t("summary.firstTry")}</div>
        </div>
        <div className="flex-1 neo-border rounded-xl bg-success p-3.5 text-success-foreground">
          <div className="font-heading text-3xl">+{firstTry}</div>
          <div className="font-mono text-[10px] uppercase">{t("summary.lockedIn")}</div>
        </div>
        <div className="flex-1 neo-border rounded-xl bg-card p-3.5">
          <div className="font-heading text-3xl">{total - firstTry}</div>
          <div className="font-mono text-[10px] uppercase">{t("summary.scheduled")}</div>
        </div>
      </div>
      <div className="flex w-full gap-2.5">
        <button
          type="button"
          onClick={() => navigate(SHELL_ROUTES.learnMastery)}
          className="flex-1 neo-border neo-shadow-sm rounded-xl bg-card px-4 py-3 font-heading font-bold"
        >
          {t("summary.seeMastery")}
        </button>
        <button
          type="button"
          onClick={() => navigate(SHELL_ROUTES.learnReview)}
          className="flex-1 neo-border neo-shadow rounded-xl bg-primary px-4 py-3 font-heading font-bold text-primary-foreground"
        >
          {t("summary.reviewPlan")}
        </button>
      </div>
    </div>
  );
}

export default function LearnRunnerScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("learn");
  const [params] = useSearchParams();
  const nodeId = params.get("node") ?? undefined;
  const session = useLearnSession(nodeId ? { nodeId } : undefined);
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
          <p className="animate-pulse font-heading font-bold uppercase tracking-wide">
            {t("run.loading")}
          </p>
        </div>
      </LearnShell>
    );
  }

  if (done || !q) {
    return (
      <LearnShell>
        <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-8 md:px-6">
          <SessionSummary total={total} firstTry={firstTryCount} />
        </div>
      </LearnShell>
    );
  }

  const onRate = (r: LearnRating) => void rateCard(q.id, r);
  const onFelt = (f: LearnFelt) => void recordFeltSignal(q.id, f);

  // Left context rail (desktop only).
  const rail = (
    <div className="neo-border neo-shadow rounded-xl bg-card p-5 flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between gap-2">
        <Chip className="bg-foreground text-background min-w-0 max-w-full truncate">
          {q.subject}
        </Chip>
        <Chip className="shrink-0">{typeLabel}</Chip>
      </div>
      <div>
        <Eyebrow className="mb-2 block">{t("run.progress")}</Eyebrow>
        <LadderDots total={total} current={idx + (stage === "reveal" ? 1 : 0)} />
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {t("run.questionOf", { current: idx + 1, total })}
        </p>
      </div>
      <div className="h-[3px] bg-foreground" />
      <div className="mt-auto">
        <Eyebrow className="mb-1.5 block">{t("run.promiseTitle")}</Eyebrow>
        <p className="m-0 text-[13.5px] font-medium leading-relaxed text-muted-foreground">
          {t("run.promiseBody")}
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate(SHELL_ROUTES.learn)}
        className="text-left font-heading text-[13px] font-bold text-muted-foreground"
      >
        {t("run.leave")}
      </button>
    </div>
  );

  const column = (
    <div className="flex min-h-0 flex-col gap-3.5 overflow-y-auto pr-0.5">
      <div className="flex items-center justify-between gap-2 md:hidden">
        <Chip className="bg-foreground text-background">{typeLabel}</Chip>
        <LadderDots total={total} current={idx + (stage === "reveal" ? 1 : 0)} />
      </div>
      <Eyebrow className="truncate">{q.subject}</Eyebrow>
      <div className="font-heading text-2xl leading-tight md:text-[27px]">{q.prompt}</div>

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
          <QuestionRenderer
            question={q}
            draft={draft}
            setDraft={setDraft}
            reveal={false}
            verdict={null}
          />
          <MistakeBranch
            verdict={verdict}
            onRetry={() => {
              setDraft(null);
              setVerdict(null);
              setStage("answer");
            }}
            onShowWhy={() => setStage("reveal")}
          />
        </>
      )}

      {stage === "answer" && (
        <button
          type="button"
          disabled={!canSubmit(q, draft) || grading}
          onClick={submit}
          className="mt-1 w-full neo-border neo-shadow rounded-xl bg-primary px-4 py-3.5 font-heading font-bold text-primary-foreground transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
        >
          {grading ? t("run.checking") : t("run.check")}
        </button>
      )}

      {stage === "reveal" && verdict && (
        <TeachingReveal
          verdict={verdict}
          last={idx + 1 >= total}
          onRate={onRate}
          onFelt={onFelt}
          onContinue={() => void next()}
        />
      )}
    </div>
  );

  return (
    <LearnShell>
      <div className="flex-1 min-h-0 p-4 md:p-6">
        <div className="grid h-full min-h-0 gap-4 md:grid-cols-[340px_1fr] md:gap-5">
          <div className="hidden md:block min-h-0">{rail}</div>
          <div className="min-h-0 w-full md:max-w-3xl">{column}</div>
        </div>
      </div>
    </LearnShell>
  );
}
