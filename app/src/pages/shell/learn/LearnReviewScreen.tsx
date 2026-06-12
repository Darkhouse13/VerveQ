/**
 * Learn v2 — spaced-review surface. Two queues: locked-in (resting, long
 * intervals) vs still-learning (active, short intervals), each with due timing.
 */
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { LearnShell, Eyebrow, Chip, MasteryBar } from "@/components/learn/LearnPrimitives";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { pickTodaysSessionNode } from "@/lib/learn/todaysSession";
import { learnPath, useLearnSubject } from "@/lib/learn/useLearnSubject";
import type { LearnSubjectMastery } from "@/lib/learn/contract";

function dueLabel(
  item: LearnSubjectMastery,
  locked: boolean,
  t: (key: string, values?: Record<string, number>) => string,
) {
  if (item.due > 0) return t("review.dueNow");
  if (!item.nextReview) return t("review.notScheduled");
  const hours = Math.max(1, Math.ceil((item.nextReview - Date.now()) / (60 * 60 * 1000)));
  if (hours < 24) return t("review.dueIn", { hours });
  return t("review.reviewIn", { days: Math.ceil(hours / 24) });
}

function Queue({
  title,
  items,
  locked,
}: {
  title: string;
  items: LearnSubjectMastery[];
  locked: boolean;
}) {
  const { t } = useTranslation("learn");
  return (
    <div className="neo-border neo-shadow rounded-xl bg-card p-4 flex flex-col min-h-0 h-full">
      <div className="flex flex-none items-center justify-between">
        <div>
          <Eyebrow className={locked ? "text-accent-foreground" : "text-primary"}>
            {locked ? t("review.lockedIn") : t("review.stillLearning")}
          </Eyebrow>
          <div className="font-heading text-xl">{title}</div>
        </div>
        <Chip
          className={
            locked ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"
          }
        >
          {items.length}
        </Chip>
      </div>
      <p className="my-2 flex-none text-[12.5px] text-muted-foreground">
        {locked ? t("review.lockedBlurb") : t("review.learningBlurb")}
      </p>
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto scrollbar-none">
        {items.map((s) => (
          <div
            key={s.id}
            className={`neo-border rounded-xl p-3 ${locked ? "bg-card" : "bg-card"}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">{s.label}</div>
              <Chip>{dueLabel(s, locked, t)}</Chip>
            </div>
            <div className="mt-2">
              <MasteryBar value={s.mastery} tone={locked ? "success" : "primary"} />
            </div>
            <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] text-muted-foreground">
              <span>{t("review.masteryPct", { pct: Math.round(s.mastery * 100) })}</span>
              <span>{t("review.inQueue", { count: s.due })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LearnReviewScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("learn");
  const { subject } = useLearnSubject();
  const plan = useQuery(
    api.learn.getLearnReviewPlan,
    subject ? { subject } : {},
  );
  const subjects = plan?.nodes ?? [];
  const locked = subjects.filter((s) => s.state === "locked");
  const learning = subjects.filter((s) => s.state === "learning");
  const todaysNode = pickTodaysSessionNode(subjects);
  const reviewDue = () => {
    if (todaysNode) {
      navigate(learnPath(SHELL_ROUTES.learnRun, subject, { node: todaysNode }));
    }
  };

  return (
    <LearnShell>
      <div className="flex flex-none items-center justify-between px-4 py-3.5 md:px-6 md:py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(learnPath(SHELL_ROUTES.learn, subject))}
            aria-label={t("common.back")}
            className="rounded-xl border-[3px] border-foreground bg-card px-3 py-1.5 font-heading font-bold"
          >
            ←
          </button>
          <div>
            <Eyebrow>{t("review.eyebrow")}</Eyebrow>
            <div className="font-heading text-xl md:text-2xl">{t("review.title")}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={reviewDue}
          disabled={!todaysNode}
          className="neo-border neo-shadow rounded-xl bg-primary px-4 py-2.5 font-heading font-bold text-primary-foreground disabled:opacity-60"
        >
          {t("review.reviewDue")}
        </button>
      </div>

      <div className="grid flex-1 min-h-0 gap-3 px-4 pb-6 md:gap-4 md:px-6 md:pb-6 md:grid-cols-2 md:grid-rows-1 overflow-y-auto scrollbar-none md:overflow-hidden auto-rows-[minmax(0,46%)] md:auto-rows-auto">
        <Queue title={t("review.resting")} items={locked} locked />
        <Queue title={t("review.active")} items={learning} locked={false} />
      </div>
    </LearnShell>
  );
}
