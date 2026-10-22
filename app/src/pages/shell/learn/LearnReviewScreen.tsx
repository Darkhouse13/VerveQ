/**
 * Learn v2 — spaced-review surface. Two queues: locked-in (resting, long
 * intervals) vs still-learning (active, short intervals), each with due timing.
 * VerveQ ONE P4.3: ink ground, ui primitives, one lime action.
 */
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { LearnShell, MasteryBar } from "@/components/learn/LearnPrimitives";
import { BackButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { pickTodaysSessionNode } from "@/lib/learn/todaysSession";
import { learnPath, useLearnSubject } from "@/lib/learn/useLearnSubject";
import type { LearnSubjectMastery } from "@/lib/learn/contract";

function dueLabel(
  item: LearnSubjectMastery,
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
    <Card className="flex flex-col min-h-0 h-full">
      <div className="flex flex-none items-center justify-between gap-2">
        <div>
          <Eyebrow>{locked ? t("review.lockedIn") : t("review.stillLearning")}</Eyebrow>
          <h2 className="font-heading font-bold text-title-sm">{title}</h2>
        </div>
        <Badge tone="neutral" className="shadow-none">
          {items.length}
        </Badge>
      </div>
      <p className="my-2 flex-none text-meta text-muted-foreground">
        {locked ? t("review.lockedBlurb") : t("review.learningBlurb")}
      </p>
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto scrollbar-none">
        {items.map((s) => (
          <div key={s.id} className="neo-border rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-body-sm font-bold">{s.label}</div>
              <Badge tone="muted" className="shadow-none shrink-0">
                {dueLabel(s, t)}
              </Badge>
            </div>
            <div className="mt-2">
              <MasteryBar value={s.mastery} locked={locked} />
            </div>
            <div className="mt-1.5 flex items-center justify-between font-mono text-eyebrow text-muted-foreground">
              <span>{t("review.masteryPct", { pct: Math.round(s.mastery * 100) })}</span>
              <span>{t("review.inQueue", { count: s.due })}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
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
      <div className="flex flex-none items-center justify-between gap-2 px-2 py-2 md:px-6 md:py-3">
        <div className="flex items-center gap-1 min-w-0">
          <BackButton onClick={() => navigate(learnPath(SHELL_ROUTES.learn, subject))} aria-label={t("common.back")} />
          <div className="min-w-0">
            <Eyebrow>{t("review.eyebrow")}</Eyebrow>
            <h1 className="font-heading font-bold text-title-sm md:text-title">{t("review.title")}</h1>
          </div>
        </div>
        <Button variant="primary" size="sm" className="shrink-0" onClick={reviewDue} disabled={!todaysNode}>
          {t("review.reviewDue")}
        </Button>
      </div>

      <div className="grid flex-1 min-h-0 gap-3 px-4 pb-6 md:gap-4 md:px-6 md:pb-6 md:grid-cols-2 md:grid-rows-1 overflow-y-auto scrollbar-none md:overflow-hidden auto-rows-[minmax(0,46%)] md:auto-rows-auto">
        <Queue title={t("review.resting")} items={locked} locked />
        <Queue title={t("review.active")} items={learning} locked={false} />
      </div>
    </LearnShell>
  );
}
