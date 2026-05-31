/**
 * Learn v2 — spaced-review surface. Two queues: locked-in (resting, long
 * intervals) vs still-learning (active, short intervals), each with due timing.
 */
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LearnShell, Eyebrow, Chip, MasteryBar } from "@/components/learn/LearnPrimitives";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { LEARN_FIXTURE_SUBJECTS } from "@/lib/learn/fixtures";
import type { LearnSubjectMastery } from "@/lib/learn/contract";

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
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
        {items.map((s) => (
          <div
            key={s.id}
            className={`neo-border rounded-xl p-3 ${locked ? "bg-card" : "bg-card"}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">{s.label}</div>
              <Chip>
                {locked
                  ? t("review.reviewIn", { days: Math.round((1 - s.mastery) * 6) + 5 })
                  : s.due > 10
                    ? t("review.dueNow")
                    : t("review.dueIn", { hours: s.due })}
              </Chip>
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
  const locked = LEARN_FIXTURE_SUBJECTS.filter((s) => s.state === "locked");
  const learning = LEARN_FIXTURE_SUBJECTS.filter((s) => s.state === "learning");

  return (
    <LearnShell>
      <div className="flex flex-none items-center justify-between px-4 py-3.5 md:px-6 md:py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(SHELL_ROUTES.learn)}
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
          onClick={() => navigate(SHELL_ROUTES.learnRun)}
          className="neo-border neo-shadow rounded-xl bg-primary px-4 py-2.5 font-heading font-bold text-primary-foreground"
        >
          {t("review.reviewDue")}
        </button>
      </div>

      <div className="grid flex-1 min-h-0 gap-3 px-4 pb-6 md:gap-4 md:px-6 md:pb-6 md:grid-cols-2 md:grid-rows-1 overflow-y-auto md:overflow-hidden auto-rows-[minmax(0,46%)] md:auto-rows-auto">
        <Queue title={t("review.resting")} items={locked} locked />
        <Queue title={t("review.active")} items={learning} locked={false} />
      </div>
    </LearnShell>
  );
}
