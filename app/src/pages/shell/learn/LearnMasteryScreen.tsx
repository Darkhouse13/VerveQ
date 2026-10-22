/**
 * Learn v2 — topic-mastery dashboard. Overall mastery + per-topic rows with
 * state (locked-in vs learning) and due counts. Presentation only. The subject
 * rides the ?subject= param (server-resolved default when absent).
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

export default function LearnMasteryScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("learn");
  const { subject } = useLearnSubject();
  const plan = useQuery(
    api.learn.getLearnReviewPlan,
    subject ? { subject } : {},
  );
  const subjects = plan?.nodes ?? [];
  const todaysNode = pickTodaysSessionNode(subjects);
  const startSession = () => {
    if (todaysNode) {
      navigate(learnPath(SHELL_ROUTES.learnRun, subject, { node: todaysNode }));
    }
  };
  const overall = Math.round(
    (subjects.reduce((a, s) => a + s.mastery, 0) / subjects.length) * 100,
  );
  const lockedCount = subjects.filter((s) => s.state === "locked").length;
  const learningCount = subjects.filter((s) => s.state === "learning").length;
  const dueCount = subjects.reduce((a, s) => a + s.due, 0);

  return (
    <LearnShell>
      <div className="flex flex-none items-center justify-between gap-2 px-2 py-2 md:px-6 md:py-3">
        <div className="flex items-center gap-1 min-w-0">
          <BackButton onClick={() => navigate(learnPath(SHELL_ROUTES.learn, subject))} aria-label={t("common.back")} />
          <div className="min-w-0">
            <Eyebrow>{t("mastery.eyebrow")}</Eyebrow>
            <h1 className="font-heading font-bold text-title-sm md:text-title">{t("mastery.title")}</h1>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => navigate(learnPath(SHELL_ROUTES.learnReview, subject))}
        >
          {t("mastery.reviewSchedule")}
        </Button>
      </div>

      <div className="grid flex-1 min-h-0 gap-4 px-4 pb-6 md:px-6 md:pb-6 md:grid-cols-[300px_1fr] overflow-y-auto scrollbar-none md:overflow-hidden">
        {/* Summary card */}
        <Card className="flex flex-col gap-3.5 min-h-0">
          <Eyebrow>{t("mastery.overall")}</Eyebrow>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono font-bold text-score">{Number.isFinite(overall) ? overall : 0}</span>
            <span className="font-mono font-bold text-title">%</span>
          </div>
          <MasteryBar value={(Number.isFinite(overall) ? overall : 0) / 100} />
          <div className="h-0.5 bg-border/20 my-1" />
          <div className="grid grid-cols-3 gap-2.5">
            {[
              [lockedCount, t("mastery.lockedIn")],
              [learningCount, t("mastery.learning")],
              [dueCount, t("mastery.due")],
            ].map(([n, label]) => (
              <div key={String(label)}>
                <div className="font-mono font-bold text-title">{n}</div>
                <Eyebrow>{label}</Eyebrow>
              </div>
            ))}
          </div>
          <Button variant="primary" size="lg" block className="mt-auto" onClick={startSession} disabled={!todaysNode}>
            {t("mastery.startSession")}
          </Button>
        </Card>

        {/* Per-subject */}
        <div className="flex flex-col gap-3 min-h-0 md:overflow-y-auto scrollbar-none">
          {subjects.map((s) => (
            <Card key={s.id} elevation="flat" padding="sm" className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md neo-border bg-muted font-mono font-bold text-title-sm">
                {Math.round(s.mastery * 100)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-heading font-bold text-body truncate">{s.label}</div>
                  <Badge tone={s.state === "locked" ? "neutral" : "muted"} className="shadow-none shrink-0">
                    {s.state === "locked" ? t("state.lockedIn") : t("state.learningUpper")}
                  </Badge>
                </div>
                <div className="mt-2">
                  <MasteryBar value={s.mastery} locked={s.state === "locked"} />
                </div>
                <div className="mt-1.5 text-meta text-muted-foreground">{t("mastery.dueLine", { count: s.due })}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </LearnShell>
  );
}
