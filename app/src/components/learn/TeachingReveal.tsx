/**
 * Learn v2 — adaptive mistake-branch + teaching reveal.
 *
 * Both render SERVER-provided teaching (`verdict.teach`); neither restates the
 * answer. The reveal also collects the spaced-rep self-rating and the
 * "learning or a test?" signal, which feed the server schedule via the seam.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lightbulb, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip, Eyebrow } from "./LearnPrimitives";
import type { LearnRating, LearnVerdict } from "@/lib/learn/contract";

/** Teaching detour shown when a wrong answer hit a known trap (verdict.branchId). */
export function MistakeBranch({
  verdict,
  onRetry,
  onShowWhy,
}: {
  verdict: LearnVerdict;
  onRetry: () => void;
  onShowWhy: () => void;
}) {
  const { t } = useTranslation("learn");
  return (
    <div className="neo-border neo-shadow rounded-xl bg-[hsl(36,90%,90%)] p-4">
      <div className="flex items-center gap-2.5">
        <span className="text-2xl" aria-hidden>
          🤔
        </span>
        <div className="font-heading text-lg">{t("branch.title")}</div>
      </div>
      <p className="my-3 text-[15px] font-medium leading-snug">{verdict.teach}</p>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 neo-border neo-shadow-sm rounded-xl bg-foreground px-4 py-3 text-center font-heading font-bold text-background"
        >
          {t("branch.tryAgain")}
        </button>
        <button
          type="button"
          onClick={onShowWhy}
          className="flex-1 neo-border rounded-xl bg-card px-4 py-3 text-center font-heading font-bold"
        >
          {t("branch.showWhy")}
        </button>
      </div>
    </div>
  );
}

const RATINGS: { value: LearnRating; tone: string; activeText?: string }[] = [
  { value: "again", tone: "bg-destructive", activeText: "text-destructive-foreground" },
  { value: "hard", tone: "bg-primary", activeText: "text-primary-foreground" },
  { value: "good", tone: "bg-card" },
  { value: "easy", tone: "bg-success", activeText: "text-success-foreground" },
];

export function TeachingReveal({
  verdict,
  last,
  onRate,
  onFelt,
  onContinue,
}: {
  verdict: LearnVerdict;
  last: boolean;
  onRate: (rating: LearnRating) => void;
  onFelt: (felt: "learn" | "test") => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation("learn");
  const [rated, setRated] = useState<LearnRating | null>(null);
  const [felt, setFelt] = useState<"learn" | "test" | null>(null);

  return (
    <div className="flex flex-col gap-2.5 md:gap-3.5">
      <div className="flex items-center gap-2.5">
        <Chip
          className={cn(
            verdict.correct
              ? "bg-success text-success-foreground"
              : "bg-destructive text-destructive-foreground",
          )}
        >
          {verdict.correct ? t("reveal.gotIt") : t("reveal.notYet")}
        </Chip>
        <Eyebrow>{t("reveal.whyEyebrow")}</Eyebrow>
        {verdict.pendingGrader && (
          <Chip className="bg-primary text-primary-foreground">{t("reveal.pending")}</Chip>
        )}
      </div>

      {/* The teaching payload — the WHY, never the answer. Tighter on mobile so the
          rating below it stays on a no-scroll viewport. */}
      <div className="neo-border neo-shadow rounded-xl bg-card p-3.5 md:p-4">
        <div className="mb-1.5 flex items-center gap-2 md:mb-2">
          <Lightbulb size={20} strokeWidth={2.5} />
          <span className="font-heading text-[15px]">{t("reveal.ideaTitle")}</span>
        </div>
        <p className="m-0 text-[14px] font-medium leading-snug md:text-[15px] md:leading-relaxed">
          {verdict.teach}
        </p>
      </div>

      {/* Spaced-rep self-rate → feeds the schedule. */}
      <div>
        <Eyebrow className="mb-2 block">{t("reveal.stickQuestion")}</Eyebrow>
        <div className="flex gap-2">
          {RATINGS.map((r) => {
            const active = rated === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => {
                  setRated(r.value);
                  onRate(r.value);
                }}
                className={cn(
                  "flex-1 neo-border rounded-xl px-1 py-2.5 font-heading font-extrabold text-[13px] transition-all",
                  active ? cn(r.tone, r.activeText) : "bg-card neo-shadow-sm",
                  active && "translate-x-0.5 translate-y-0.5",
                )}
              >
                {t(`reveal.rating.${r.value}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* The learning-or-test loop. Optional, non-gating signal (continue is gated
          only on the rating). Hidden below md so the rating + continue both stay on
          the no-scroll mobile viewport — "everything else yields" to the rating. The
          recordFeltSignal binding is unchanged and still collected on desktop. */}
      <div className="hidden rounded-xl border-2 border-dashed border-foreground px-3.5 py-3 md:block">
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-[13.5px] font-semibold">{t("reveal.feltQuestion")}</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setFelt("learn");
                onFelt("learn");
              }}
              className={cn(
                "rounded-full border-2 border-foreground px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider",
                felt === "learn" ? "bg-success text-success-foreground" : "bg-card",
              )}
            >
              {t("reveal.feltLearn")}
            </button>
            <button
              type="button"
              onClick={() => {
                setFelt("test");
                onFelt("test");
              }}
              className={cn(
                "rounded-full border-2 border-foreground px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider",
                felt === "test" ? "bg-primary text-primary-foreground" : "bg-card",
              )}
            >
              {t("reveal.feltTest")}
            </button>
          </div>
        </div>
        {felt && (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {felt === "learn" ? t("reveal.feltLearnNote") : t("reveal.feltTestNote")}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={!rated}
        onClick={onContinue}
        className={cn(
          "w-full neo-border neo-shadow rounded-xl bg-primary px-4 py-3 font-heading font-bold text-primary-foreground transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none md:py-3.5",
          !rated && "opacity-50 pointer-events-none",
        )}
      >
        {last ? t("reveal.finish") : t("reveal.next")}
      </button>

      {/* Decorative reassurance (no binding) — hidden on mobile to keep the rating
          + continue on the fold; the rail's Learn-promise carries the same idea. */}
      <div className="hidden items-center gap-3 font-mono text-[11px] text-muted-foreground md:flex">
        <CircleHelp size={14} />
        <span>{t("reveal.scheduleNote")}</span>
      </div>
    </div>
  );
}
