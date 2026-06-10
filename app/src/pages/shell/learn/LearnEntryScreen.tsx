/**
 * Learn v2 — entry. Today's session hero + "pick up where you left off" +
 * learning streak. Navigation/presentation only; no scoring here.
 */
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { LearnShell, Eyebrow } from "@/components/learn/LearnPrimitives";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { pickTodaysSessionNode } from "@/lib/learn/todaysSession";

const TYPE_KEYS = ["mcq", "text", "numeric", "order"] as const;

export default function LearnEntryScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("learn");
  const plan = useQuery(api.learn.getLearnReviewPlan, { subject: "geography" });
  const subjects = plan?.nodes ?? [];
  const todaysNode = pickTodaysSessionNode(subjects);
  const start = () => {
    if (todaysNode) navigate(`${SHELL_ROUTES.learnRun}?node=${todaysNode}`);
  };
  const resume = subjects.filter((s) => s.state === "learning").slice(0, 3);
  const dueToday = subjects.reduce((sum, s) => sum + (s.due ?? 0), 0);
  const learningCount = subjects.filter((s) => s.state === "learning").length;

  return (
    <LearnShell>
      {/* Header */}
      <div className="flex flex-none items-center justify-between px-4 py-3.5 md:px-6 md:py-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate(SHELL_ROUTES.home)}
            aria-label={t("common.back")}
            className="rounded-xl border-[3px] border-foreground bg-card px-3 py-1.5 font-heading font-bold"
          >
            ←
          </button>
          <div className="font-heading text-xl">{t("entry.title")}</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(SHELL_ROUTES.learnMastery)}
            className="font-heading text-[13px] font-bold text-muted-foreground"
          >
            {t("entry.mastery")}
          </button>
          <button
            type="button"
            onClick={() => navigate(SHELL_ROUTES.learnReview)}
            className="font-heading text-[13px] font-bold text-muted-foreground"
          >
            {t("entry.review")}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-4 pb-6 md:px-6 md:pb-6 overflow-y-auto md:overflow-hidden md:grid md:grid-rows-[1.25fr_1fr] md:gap-4">
        {/* Hero band */}
        <div className="neo-border neo-shadow rounded-xl bg-primary text-primary-foreground p-5 md:p-7 flex flex-col md:flex-row md:gap-6 min-h-0 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-16 text-[220px] leading-none opacity-10 select-none" aria-hidden>
            🌱
          </div>
          <div className="flex flex-1 flex-col min-w-0 z-10">
            <span className="self-start rounded-full border-2 border-current bg-background/20 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider">
              {t("entry.todaysSession")}
            </span>
            <div className="font-heading font-black text-4xl md:text-5xl leading-[0.95] mt-4 md:mt-auto">
              {t("entry.heroLine1")}
              <br />
              {t("entry.heroLine2")}
            </div>
            <p className="text-[15px] font-medium opacity-90 mt-3 md:max-w-md">
              {t("entry.heroBody")}
            </p>
          </div>
          <div className="z-10 mt-4 md:mt-0 md:w-56 flex-none flex flex-col gap-2.5">
            <Eyebrow className="text-primary-foreground/85">{t("entry.metaLine")}</Eyebrow>
            {TYPE_KEYS.map((k, i) => (
              <div
                key={k}
                className="flex items-center gap-2.5 rounded-xl border-2 border-current bg-background/15 px-3 py-2"
              >
                <span className="font-heading text-sm w-4">{i + 1}</span>
                <span className="font-bold text-[13.5px]">{t(`type.${k}`)}</span>
              </div>
            ))}
            <button
              type="button"
              onClick={start}
              disabled={!todaysNode}
              className="mt-auto w-full neo-border rounded-xl bg-foreground px-4 py-3 font-heading font-bold text-background disabled:opacity-60"
            >
              {t("entry.start")}
            </button>
          </div>
        </div>

        {/* Bottom band */}
        <div className="mt-4 md:mt-0 grid gap-4 md:grid-cols-[1.4fr_1fr] min-h-0">
          <div className="neo-border rounded-xl bg-card p-4 md:p-5 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <Eyebrow>{t("entry.resumeTitle")}</Eyebrow>
              <button
                type="button"
                onClick={() => navigate(SHELL_ROUTES.learnMastery)}
                className="font-heading text-xs font-bold text-muted-foreground"
              >
                {t("entry.allSubjects")}
              </button>
            </div>
            <div className="mt-3 flex flex-1 flex-col justify-center gap-2.5">
              {resume.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("entry.resumeEmpty")}</p>
              ) : (
                resume.map((s) => (
                  <div key={s.id}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold">{s.label}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {Math.round(s.mastery * 100)}% · {t("state.learning")}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full border-2 border-foreground bg-card">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.round(s.mastery * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="neo-border rounded-xl bg-card p-4 md:p-5 flex flex-col min-h-0">
            <Eyebrow>{t("entry.dueTitle")}</Eyebrow>
            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="font-heading font-black text-5xl text-primary">{dueToday}</span>
              <span className="text-[13.5px] font-semibold">{t("entry.dueItems")}</span>
            </div>
            <p className="mt-3.5 text-sm text-muted-foreground">
              {t("entry.rotationNote", { count: learningCount })}
            </p>
            <p className="mt-auto pt-3 font-mono text-[11px] text-muted-foreground">
              {dueToday === 0 ? t("entry.dueNoteEmpty") : t("entry.dueNote", { count: dueToday })}
            </p>
          </div>
        </div>
      </div>
    </LearnShell>
  );
}
