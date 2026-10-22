/**
 * Learn v2 — adaptive mistake-branch + teaching reveal.
 *
 * Both render SERVER-provided teaching (`verdict.teach`) on a `.theme-paper`
 * reading card — the lesson is the one thing in Learn that is read rather than
 * played (VerveQ ONE P4.3). The reveal also collects the spaced-rep
 * self-rating and the "learning or a test?" signal, which feed the server
 * schedule via the seam.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lightbulb, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Badge } from "@/components/ui/badge";
import { VerdictBadge, VerdictSlot } from "@/components/shell/play/StageSignals";
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
    <Card tone="paper" className="theme-paper" data-testid="learn-branch">
      <div className="flex items-center gap-2.5">
        <span className="text-title" aria-hidden>
          🤔
        </span>
        <h2 className="font-heading font-bold text-title-sm">{t("branch.title")}</h2>
      </div>
      <p className="my-3 text-body font-medium leading-snug">{verdict.teach}</p>
      <div className="flex gap-2.5">
        <Button variant="primary" className="flex-1" onClick={onRetry}>
          {t("branch.tryAgain")}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onShowWhy}>
          {t("branch.showWhy")}
        </Button>
      </div>
    </Card>
  );
}

const RATINGS: LearnRating[] = ["again", "hard", "good", "easy"];

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
      <VerdictSlot className="justify-start text-left min-h-0">
        <VerdictBadge right={verdict.correct} testId="learn-verdict">
          {verdict.correct ? t("reveal.gotIt") : t("reveal.notYet")}
        </VerdictBadge>
        {verdict.pendingGrader && <Badge tone="muted">{t("reveal.pending")}</Badge>}
      </VerdictSlot>

      {/* The teaching payload, on a paper reading card. Tighter on mobile so
          the rating below it stays on a no-scroll viewport. Drill rungs carry
          no teach: the card is hidden and the right answer is shown in the
          question renderer instead. */}
      {verdict.teach && (
        <Card tone="paper" padding="sm" className="theme-paper md:p-4" data-testid="learn-teach">
          <Eyebrow>{t("reveal.whyEyebrow")}</Eyebrow>
          <div className="mt-1 mb-1.5 flex items-center gap-2 md:mb-2">
            <Lightbulb size={20} strokeWidth={2.5} aria-hidden="true" />
            <span className="font-heading font-bold text-body">{t("reveal.ideaTitle")}</span>
          </div>
          <p className="m-0 text-body-sm font-medium leading-snug md:text-body md:leading-relaxed">{verdict.teach}</p>
        </Card>
      )}

      {/* Spaced-rep self-rate → feeds the schedule. */}
      <div>
        <Eyebrow className="mb-2">{t("reveal.stickQuestion")}</Eyebrow>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label={t("reveal.stickQuestion")}>
          {RATINGS.map((r) => {
            const active = rated === r;
            return (
              <Button
                key={r}
                variant="secondary"
                size="sm"
                className={cn("px-1", active && "bg-foreground text-background hover:bg-foreground")}
                aria-pressed={active}
                onClick={() => {
                  setRated(r);
                  onRate(r);
                }}
              >
                {t(`reveal.rating.${r}`)}
              </Button>
            );
          })}
        </div>
      </div>

      {/* The learning-or-test loop. Optional, non-gating signal (continue is
          gated only on the rating). Hidden below md so the rating + continue
          both stay on the mobile viewport. Still collected on desktop. */}
      <div className="hidden rounded-lg border-2 border-dashed border-border px-3.5 py-3 md:block">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="text-body-sm font-semibold">{t("reveal.feltQuestion")}</span>
          <div className="flex shrink-0 gap-1.5">
            {(["learn", "test"] as const).map((f) => (
              <Button
                key={f}
                variant="secondary"
                size="sm"
                aria-pressed={felt === f}
                className={cn(felt === f && "bg-foreground text-background hover:bg-foreground")}
                onClick={() => {
                  setFelt(f);
                  onFelt(f);
                }}
              >
                {f === "learn" ? t("reveal.feltLearn") : t("reveal.feltTest")}
              </Button>
            ))}
          </div>
        </div>
        {felt && (
          <p className="mt-2 text-meta text-muted-foreground">
            {felt === "learn" ? t("reveal.feltLearnNote") : t("reveal.feltTestNote")}
          </p>
        )}
      </div>

      <Button variant="primary" size="lg" block disabled={!rated} onClick={onContinue}>
        {last ? t("reveal.finish") : t("reveal.next")}
      </Button>

      {/* Decorative reassurance (no binding) — hidden on mobile to keep the
          rating + continue on the fold; the rail's Learn promise carries the
          same idea. */}
      <div className="hidden items-center gap-3 text-meta text-muted-foreground md:flex">
        <CircleHelp size={14} aria-hidden="true" />
        <span>{t("reveal.scheduleNote")}</span>
      </div>
    </div>
  );
}
