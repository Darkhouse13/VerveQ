/**
 * Learn v2 — entry. Today's session hero + "pick up where you left off" +
 * learning streak. Navigation/presentation only; no scoring here. The subject
 * comes from the server's subjects registry (via useLearnSubject) — never
 * hardcoded — and every served subject is offered in the switcher.
 *
 * VerveQ ONE P4.3: on the ink ground with the ui primitives; Start is the
 * screen's one lime action. Learn is reached from Profile → Labs, so Back
 * returns there.
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
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { pickTodaysSessionNode } from "@/lib/learn/todaysSession";
import { learnPath, useLearnSubject } from "@/lib/learn/useLearnSubject";

const TYPE_KEYS = ["mcq", "text", "numeric", "order"] as const;

export default function LearnEntryScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("learn");
  const { subject, subjects, setSubject } = useLearnSubject();
  const plan = useQuery(
    api.learn.getLearnReviewPlan,
    subject ? { subject } : {},
  );
  const nodes = plan?.nodes ?? [];
  const todaysNode = pickTodaysSessionNode(nodes);
  const start = () => {
    if (todaysNode) {
      navigate(learnPath(SHELL_ROUTES.learnRun, subject, { node: todaysNode }));
    }
  };
  const resume = nodes.filter((s) => s.state === "learning").slice(0, 3);
  const dueToday = nodes.reduce((sum, s) => sum + (s.due ?? 0), 0);
  const learningCount = nodes.filter((s) => s.state === "learning").length;

  return (
    <LearnShell>
      {/* Header */}
      <div className="flex flex-none items-center justify-between gap-2 px-2 py-2 md:px-6 md:py-3">
        <div className="flex items-center gap-1">
          <BackButton onClick={() => navigate(SHELL_ROUTES.profile)} aria-label={t("common.back")} />
          <h1 className="font-heading font-bold text-title">{t("entry.title")}</h1>
        </div>
        <div className="flex">
          <Button variant="ghost" size="sm" onClick={() => navigate(learnPath(SHELL_ROUTES.learnMastery, subject))}>
            {t("entry.mastery")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate(learnPath(SHELL_ROUTES.learnReview, subject))}>
            {t("entry.review")}
          </Button>
        </div>
      </div>

      {/* Subject switcher — one chip per served subject, straight from the
          server registry. Selection rides the ?subject= param. */}
      {subjects && subjects.length > 0 && (
        <div
          role="group"
          aria-label={t("entry.subjectsLabel")}
          className="flex flex-none gap-2 overflow-x-auto px-4 pb-3 md:flex-wrap md:px-6"
        >
          {subjects.map((s) => (
            <Chip
              key={s.subject}
              selected={s.subject === subject}
              onClick={() => setSubject(s.subject)}
              className={cn(s.subject === subject && "shadow-none")}
            >
              {t(`subjects.${s.subject}`, { defaultValue: s.name })}
              {s.dueCount > 0 ? ` · ${s.dueCount}` : ""}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 px-4 pb-6 md:px-6 md:pb-6 overflow-y-auto md:overflow-hidden md:grid md:grid-rows-[1.25fr_1fr] md:gap-4">
        {/* Hero */}
        <Card padding="lg" className="flex flex-col md:flex-row md:gap-6 min-h-0">
          <div className="flex flex-1 flex-col min-w-0">
            <Badge tone="neutral" className="self-start shadow-none">
              {t("entry.todaysSession")}
            </Badge>
            <h2 className="font-heading font-bold text-title-lg md:text-display mt-3 md:mt-auto">
              {t("entry.heroLine1")}
              <br />
              {t("entry.heroLine2")}
            </h2>
            <p className="text-body-sm md:text-body text-muted-foreground mt-2.5 md:mt-3 md:max-w-md">
              {t("entry.heroBody")}
            </p>
          </div>
          <div className="mt-4 md:mt-0 md:w-56 flex-none flex flex-col gap-2.5">
            <Eyebrow>{t("entry.metaLine")}</Eyebrow>
            {/* The four answer types: one wrapping line of tags. */}
            <div className="flex flex-wrap gap-1.5">
              {TYPE_KEYS.map((k) => (
                <Badge key={k} tone="muted" className="shadow-none normal-case">
                  {t(`type.${k}`)}
                </Badge>
              ))}
            </div>
            <Button variant="primary" size="lg" block className="mt-auto" onClick={start} disabled={!todaysNode}>
              {t("entry.start")}
            </Button>
          </div>
        </Card>

        {/* Bottom band */}
        <div className="mt-4 md:mt-0 grid gap-4 md:grid-cols-[1.4fr_1fr] min-h-0">
          <Card elevation="flat" className="flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2">
              <Eyebrow>{t("entry.resumeTitle")}</Eyebrow>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 px-2"
                onClick={() => navigate(learnPath(SHELL_ROUTES.learnMastery, subject))}
              >
                {t("entry.allSubjects")}
              </Button>
            </div>
            <div className="mt-2 flex flex-1 flex-col justify-center gap-2.5">
              {resume.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">{t("entry.resumeEmpty")}</p>
              ) : (
                resume.map((s) => (
                  <div key={s.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-body-sm font-semibold">{s.label}</span>
                      <span className="font-mono text-eyebrow text-muted-foreground">
                        {Math.round(s.mastery * 100)}% · {t("state.learning")}
                      </span>
                    </div>
                    <MasteryBar value={s.mastery} />
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card elevation="flat" className="flex flex-col min-h-0">
            <Eyebrow>{t("entry.dueTitle")}</Eyebrow>
            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="font-mono font-bold text-display">{dueToday}</span>
              <span className="text-body-sm font-semibold">{t("entry.dueItems")}</span>
            </div>
            <p className="mt-3 text-body-sm text-muted-foreground">
              {t("entry.rotationNote", { count: learningCount })}
            </p>
            <p className="mt-auto pt-3 text-meta text-muted-foreground">
              {dueToday === 0 ? t("entry.dueNoteEmpty") : t("entry.dueNote", { count: dueToday })}
            </p>
          </Card>
        </div>
      </div>
    </LearnShell>
  );
}
