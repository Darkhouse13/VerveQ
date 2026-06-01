/**
 * Learn v2 — subject-mastery dashboard. Overall mastery + per-subject rows with
 * state (locked-in vs learning) and due counts. Presentation only.
 */
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { LearnShell, Eyebrow, Chip, MasteryBar } from "@/components/learn/LearnPrimitives";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { LEARN_FIXTURE_SUBJECTS } from "@/lib/learn/fixtures";

export default function LearnMasteryScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("learn");
  const plan = useQuery(api.learn.getLearnReviewPlan, { subject: "geography" });
  const subjects = plan?.nodes ?? LEARN_FIXTURE_SUBJECTS;
  const overall = Math.round(
    (subjects.reduce((a, s) => a + s.mastery, 0) / subjects.length) * 100,
  );
  const lockedCount = subjects.filter((s) => s.state === "locked").length;
  const learningCount = subjects.filter((s) => s.state === "learning").length;
  const dueCount = subjects.reduce((a, s) => a + s.due, 0);

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
            <Eyebrow>{t("mastery.eyebrow")}</Eyebrow>
            <div className="font-heading text-xl md:text-2xl">{t("mastery.title")}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(SHELL_ROUTES.learnReview)}
          className="font-heading text-[13px] font-bold text-muted-foreground"
        >
          {t("mastery.reviewSchedule")}
        </button>
      </div>

      <div className="grid flex-1 min-h-0 gap-4 px-4 pb-6 md:px-6 md:pb-6 md:grid-cols-[300px_1fr] overflow-y-auto md:overflow-hidden">
        {/* Summary card */}
        <div className="neo-border neo-shadow rounded-xl bg-card p-4 md:p-5 flex flex-col gap-3.5 min-h-0">
          <Eyebrow>{t("mastery.overall")}</Eyebrow>
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-black text-6xl leading-none text-primary">
              {overall}
            </span>
            <span className="font-heading font-black text-2xl">%</span>
          </div>
          <MasteryBar value={overall / 100} tone="primary" />
          <div className="h-[3px] bg-foreground my-1" />
          <div className="flex gap-2.5">
            <div className="flex-1">
              <div className="font-heading text-2xl">{lockedCount}</div>
              <div className="font-mono text-[10.5px] text-muted-foreground uppercase">
                {t("mastery.lockedIn")}
              </div>
            </div>
            <div className="flex-1">
              <div className="font-heading text-2xl">{learningCount}</div>
              <div className="font-mono text-[10.5px] text-muted-foreground uppercase">
                {t("mastery.learning")}
              </div>
            </div>
            <div className="flex-1">
              <div className="font-heading text-2xl">{dueCount}</div>
              <div className="font-mono text-[10.5px] text-muted-foreground uppercase">
                {t("mastery.due")}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(SHELL_ROUTES.learnRun)}
            className="mt-auto w-full neo-border neo-shadow rounded-xl bg-primary px-4 py-3 font-heading font-bold text-primary-foreground"
          >
            {t("mastery.startSession")}
          </button>
        </div>

        {/* Per-subject */}
        <div className="flex flex-col gap-3 min-h-0 md:overflow-y-auto">
          {subjects.map((s) => (
            <div
              key={s.id}
              className="neo-border rounded-xl bg-card p-3.5 flex items-center gap-4"
            >
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border-[3px] border-foreground bg-primary text-primary-foreground font-heading font-black text-lg">
                {Math.round(s.mastery * 100)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-heading text-base truncate">{s.label}</div>
                  <Chip
                    className={
                      s.state === "locked" ? "bg-success text-success-foreground" : "bg-card"
                    }
                  >
                    {s.state === "locked" ? t("state.lockedIn") : t("state.learningUpper")}
                  </Chip>
                </div>
                <div className="mt-2">
                  <MasteryBar value={s.mastery} tone={s.state === "locked" ? "success" : "primary"} />
                </div>
                <div className="mt-1.5 font-mono text-[10.5px] text-muted-foreground">
                  {t("mastery.dueLine", { count: s.due })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </LearnShell>
  );
}
